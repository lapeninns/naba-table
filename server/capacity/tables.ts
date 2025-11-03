import { DateTime } from "luxon";
import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";

import { BOOKING_BLOCKING_STATUSES } from "@/lib/enums";
import {
  getAllocatorAdjacencyMinPartySize,
  getAllocatorKMax as getAllocatorCombinationLimit,
  getSelectorPlannerLimits,
  isAllocatorAdjacencyRequired,
  isAllocatorServiceFailHard,
  isAllocatorV2Enabled,
  isCombinationPlannerEnabled,
  isHoldsEnabled,
  isHoldStrictConflictsEnabled,
  isPlannerTimePruningEnabled,
  isAdjacencyQueryUndirected,
  isOpsMetricsEnabled,
  isSelectorScoringEnabled,
  isSelectorLookaheadEnabled,
  getSelectorLookaheadWindowMinutes,
  getSelectorLookaheadPenaltyWeight,
  getSelectorLookaheadBlockThreshold,
  getContextQueryPaddingMinutes,
} from "@/server/feature-flags";
import { getServiceSupabaseClient } from "@/server/supabase";

import { resolveDemandMultiplier, type DemandMultiplierResult } from "./demand-profiles";
import {
  AssignTablesRpcError,
  HoldConflictError,
  HoldNotFoundError,
  createTableHold,
  findHoldConflicts,
  listActiveHoldsForBooking,
  releaseTableHold,
  type CreateTableHoldInput,
  type HoldConflictInfo,
  type TableHold,
} from "./holds";
import { createAvailabilityBitset, markWindow, isWindowFree } from "./planner/bitset";
import {
  bandDuration,
  getBufferConfig,
  getSelectorScoringConfig,
  getVenuePolicy,
  getYieldManagementScarcityWeight,
  serviceEnd,
  whichService,
  type SelectorScoringConfig,
  type ServiceKey,
  type VenuePolicy,
  ServiceNotFoundError,
  ServiceOverrunError,
} from "./policy";
import { loadTableScarcityScores } from "./scarcity";
import {
  buildScoredTablePlans,
  type RankedTablePlan,
  type CandidateDiagnostics,
  type BuildCandidatesResult,
} from "./selector";
import { loadStrategicConfig } from "./strategic-config";
import { emitRpcConflict, emitSelectorQuote, summarizeCandidate, type CandidateSummary, type SelectorDecisionEvent } from "./telemetry";
import {
  AssignmentConflictError,
  AssignmentOrchestrator,
  AssignmentRepositoryError,
  AssignmentValidationError,
  SupabaseAssignmentRepository,
  createPlanSignature,
  createDeterministicIdempotencyKey,
  hashPolicyVersion,
  computePayloadChecksum,
  normalizeTableIds,
} from "./v2";

import type { Database, Tables } from "@/types/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

type DbClient = SupabaseClient<Database, "public">;

type TableInventoryRow = Tables<"table_inventory">;

const TABLE_INVENTORY_SELECT =
  "id,table_number,capacity,min_party_size,max_party_size,section,category,seating_type,mobility,zone_id,status,active,position" as const;

type TableHoldRow = Tables<"table_holds"> & {
  table_hold_members: Array<{ table_id: string | null }> | null;
};


type AssignmentAvailabilityRow = {
  table_id: string | null;
  start_at: string | null;
  end_at: string | null;
  bookings: Pick<Tables<"bookings">, "id" | "status" | "start_at" | "end_at"> | null;
};

const DEFAULT_HOLD_TTL_SECONDS = 180;
const TABLE_RESOURCE_TYPE = "table";

export type Table = {
  id: string;
  tableNumber: string;
  capacity: number;
  minPartySize?: number | null;
  maxPartySize?: number | null;
  section?: string | null;
  category?: Tables<"table_inventory">["category"] | string | null;
  seatingType?: Tables<"table_inventory">["seating_type"] | string | null;
  mobility?: Tables<"table_inventory">["mobility"] | string | null;
  zoneId: string;
  status?: Tables<"table_inventory">["status"] | string | null;
  active?: boolean | null;
  position?: Tables<"table_inventory">["position"] | null;
};

export type TableMatchParams = {
  partySize: number;
  requireAdjacency?: boolean;
  avoidTableIds?: string[];
  zoneId?: string | null;
};

export type TableAssignmentMember = {
  tableId: string;
  assignmentId: string;
  startAt: string;
  endAt: string;
  mergeGroupId?: string | null;
};

export type TableAssignmentGroup = {
  bookingId: string;
  tableIds: string[];
  assignments: TableAssignmentMember[];
};

export type ManualSelectionCheck = {
  id: "capacity" | "zone" | "movable" | "adjacency" | "conflict" | "holds";
  status: "ok" | "warning" | "error";
  message: string;
  details?: Record<string, unknown>;
};

export type ManualSelectionSummary = {
  tableCount: number;
  totalCapacity: number;
  slack: number;
  zoneId: string | null;
  tableNumbers: string[];
  partySize: number;
};

export type ManualValidationResult = {
  ok: boolean;
  summary: ManualSelectionSummary;
  checks: ManualSelectionCheck[];
  policyVersion?: string;
};

export type ManualSelectionOptions = {
  bookingId: string;
  tableIds: string[];
  requireAdjacency?: boolean;
  excludeHoldId?: string | null;
  client?: DbClient;
};

export type ManualHoldOptions = ManualSelectionOptions & {
  createdBy: string;
  holdTtlSeconds?: number;
  holdExpiresAt?: string;
};

export type ManualHoldResult = {
  hold: TableHold | null;
  validation: ManualValidationResult;
};

function buildSelectorFeatureFlagsTelemetry(): {
  selectorScoring: boolean;
  opsMetrics: boolean;
  plannerTimePruning: boolean;
  adjacencyUndirected: boolean;
  holdsStrictConflicts: boolean;
  allocatorFailHard: boolean;
  selectorLookahead: boolean;
} {
  return {
    selectorScoring: isSelectorScoringEnabled(),
    opsMetrics: isOpsMetricsEnabled(),
    plannerTimePruning: isPlannerTimePruningEnabled(),
    adjacencyUndirected: isAdjacencyQueryUndirected(),
    holdsStrictConflicts: isHoldStrictConflictsEnabled(),
    allocatorFailHard: isAllocatorServiceFailHard(),
    selectorLookahead: isSelectorLookaheadEnabled(),
  };
}

export type QuoteTablesOptions = {
  bookingId: string;
  zoneId?: string | null;
  maxTables?: number;
  requireAdjacency?: boolean;
  avoidTables?: string[];
  holdTtlSeconds?: number;
  createdBy: string;
  client?: DbClient;
};

export type QuoteTablesResult = {
  hold: TableHold | null;
  candidate: CandidateSummary | null;
  alternates: CandidateSummary[];
  nextTimes: string[];
  reason?: string;
  skipped?: Array<{ candidate: CandidateSummary; reason: string; conflicts: HoldConflictInfo[] }>;
  metadata?: {
    usedFallback: boolean;
    fallbackService: ServiceKey | null;
  };
};

export type ManualAssignmentConflict = {
  tableId: string;
  bookingId: string | null;
  startAt: string;
  endAt: string;
  source: "booking" | "hold";
};

export type ManualAssignmentContextHold = TableHold & {
  createdByName?: string | null;
  createdByEmail?: string | null;
  summary?: ManualSelectionSummary;
};

export type ManualAssignmentContext = {
  booking: Tables<"bookings">;
  tables: Table[];
  bookingAssignments: string[];
  holds: ManualAssignmentContextHold[];
  activeHold: ManualAssignmentContextHold | null;
  conflicts: ManualAssignmentConflict[];
  window: {
    startAt: string | null;
    endAt: string | null;
  };
  flags?: {
    holdsStrictConflicts: boolean;
    adjacencyRequired: boolean;
    adjacencyUndirected: boolean;
  };
  // Snapshot/hash of current context (holds+assignments+flags+window)
  contextVersion?: string;
  // Server-authoritative clock reference for client countdowns
  serverNow?: string;
};

type BookingRow = Tables<"bookings"> & {
  restaurants?: { timezone: string | null } | { timezone: string | null }[];
};

type ContextBookingRow = {
  id: string;
  party_size: number;
  status: string;
  start_time: string | null;
  end_time: string | null;
  start_at: string | null;
  end_at: string | null;
  booking_date: string | null;
  seating_preference?: string | null;
  booking_table_assignments: Array<{ table_id: string | null }> | null;
};

type BusyWindow = {
  tableId: string;
  startAt: string;
  endAt: string;
  bookingId: string | null;
  source: "booking" | "hold";
};

type AvailabilityMap = Map<
  string,
  {
    bitset: ReturnType<typeof createAvailabilityBitset>;
    windows: BusyWindow[];
  }
>;

export class ManualSelectionInputError extends Error {
  constructor(
    message: string,
    public readonly code: string = "MANUAL_SELECTION_INPUT_INVALID",
    public readonly status = 400,
  ) {
    super(message);
    this.name = "ManualSelectionInputError";
  }
}

function ensureClient(client?: DbClient): DbClient {
  return client ?? getServiceSupabaseClient();
}

function extractErrorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

function normalizeBookingRow(row: BookingRow): BookingRow {
  if (Array.isArray(row.restaurants) && row.restaurants.length > 0) {
    return { ...row, restaurants: row.restaurants[0] ?? null };
  }
  return row;
}

async function releaseHoldWithRetry(params: { holdId: string; client: DbClient; attempts?: number; baseDelayMs?: number }): Promise<void> {
  const { holdId, client, attempts = 3, baseDelayMs = 50 } = params;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await releaseTableHold({ holdId, client });
      return;
    } catch (error) {
      if (attempt === attempts) {
        throw error;
      }
      const jitter = Math.random() * baseDelayMs;
      const delay = baseDelayMs * attempt + jitter;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

export type BookingWindow = ReturnType<typeof computeBookingWindow>;

type BookingWindowWithFallback = {
  window: BookingWindow;
  usedFallback: boolean;
  fallbackService: ServiceKey | null;
};

export function computeBookingWindow(args: {
  startISO?: string | null;
  bookingDate?: string | null;
  startTime?: string | null;
  partySize: number;
  policy?: VenuePolicy;
  serviceHint?: ServiceKey | null;
}): {
  service: ServiceKey;
  durationMinutes: number;
  dining: {
    start: DateTime;
    end: DateTime;
  };
  block: {
    start: DateTime;
    end: DateTime;
  };
  clampedToServiceEnd: boolean;
} {
  const policy = args.policy ?? getVenuePolicy();
  const baseStart = resolveStartDateTime(args, policy);
  const service = resolveService(baseStart, args.serviceHint ?? null, policy);

  const diningMinutes = bandDuration(service, args.partySize, policy);
  const buffer = getBufferConfig(service, policy);
  const diningStart = baseStart;
  let diningEnd = diningStart.plus({ minutes: diningMinutes });
  const blockStart = diningStart.minus({ minutes: buffer.pre ?? 0 });
  let blockEnd = diningEnd.plus({ minutes: buffer.post ?? 0 });
  let clampedToServiceEnd = false;

  const serviceEndBoundary = serviceEnd(service, diningStart, policy);
  if (blockEnd > serviceEndBoundary) {
    blockEnd = serviceEndBoundary;
    diningEnd = blockEnd.minus({ minutes: buffer.post ?? 0 });
    if (diningEnd <= diningStart) {
      throw new ServiceOverrunError(service, blockEnd, serviceEndBoundary);
    }
    clampedToServiceEnd = true;
  }

  return {
    service,
    durationMinutes: Math.max(1, Math.round(diningEnd.diff(diningStart, "minutes").minutes)),
    dining: {
      start: diningStart,
      end: diningEnd,
    },
    block: {
      start: blockStart,
      end: blockEnd,
    },
    clampedToServiceEnd,
  };
}

type ComputeWindowArgs = {
  startISO?: string | null;
  bookingDate?: string | null;
  startTime?: string | null;
  partySize: number;
  policy?: VenuePolicy;
  serviceHint?: ServiceKey | null;
};

function computeBookingWindowWithFallback(args: ComputeWindowArgs): BookingWindowWithFallback {
  const policy = args.policy ?? getVenuePolicy();
  try {
    const window = computeBookingWindow({ ...args, policy });
    return {
      window,
      usedFallback: false,
      fallbackService: null,
    };
  } catch (error) {
    if (error instanceof ServiceNotFoundError) {
      const serviceOrderCandidates = policy.serviceOrder.filter((key) => Boolean(policy.services[key]));
      const servicesFallback = (Object.keys(policy.services) as ServiceKey[]).filter((key) =>
        Boolean(policy.services[key]),
      );
      const fallbackService =
        args.serviceHint && policy.services[args.serviceHint]
          ? args.serviceHint
          : serviceOrderCandidates[0] ?? servicesFallback[0];

      if (!fallbackService || !policy.services[fallbackService]) {
        throw error;
      }

      if (isAllocatorServiceFailHard()) {
        throw error;
      }

      const fallbackWindow = computeBookingWindow({
        ...args,
        policy,
        serviceHint: fallbackService,
      });

      console.warn("[capacity][window][fallback] service not found, using fallback service", {
        start: fallbackWindow.dining.start.toISO(),
        fallbackService,
        clamped: fallbackWindow.clampedToServiceEnd,
      });

      return {
        window: fallbackWindow,
        usedFallback: true,
        fallbackService,
      };
    }

    throw error;
  }
}

function resolveStartDateTime(
  args: {
    startISO?: string | null;
    bookingDate?: string | null;
    startTime?: string | null;
  },
  policy: VenuePolicy,
): DateTime {
  if (args.startISO) {
    const parsed = DateTime.fromISO(args.startISO);
    if (!parsed.isValid) {
      throw new ManualSelectionInputError("Invalid start ISO timestamp provided", "INVALID_START");
    }
    return parsed.setZone(policy.timezone, { keepLocalTime: false });
  }

  const { bookingDate, startTime } = args;
  if (!bookingDate || !startTime) {
    throw new ManualSelectionInputError("Booking date and start time are required", "START_TIME_REQUIRED");
  }

  const composed = DateTime.fromISO(`${bookingDate}T${startTime}`, { zone: policy.timezone });
  if (!composed.isValid) {
    throw new ManualSelectionInputError("Invalid booking date/time", "INVALID_START");
  }
  return composed;
}

function resolveService(start: DateTime, hint: ServiceKey | null, policy: VenuePolicy): ServiceKey {
  if (hint) {
    return hint;
  }
  const found = whichService(start, policy);
  if (!found) {
    throw new ServiceNotFoundError(start);
  }
  return found;
}

type IntervalPoint = DateTime | string | number;
type IntervalLike = {
  start: IntervalPoint;
  end: IntervalPoint;
};

function intervalPointToMillis(point: IntervalPoint): number | null {
  // Robust normalization to epoch ms with DST-gap coercion when necessary.
  if (DateTime.isDateTime(point)) {
    if (point.isValid) {
      const v = point.toMillis();
      return Number.isFinite(v) ? v : null;
    }
    // Handle non-existent local times (e.g., DST spring-forward): advance minute-by-minute
    const zoneName = point.zoneName ?? "UTC";
    const base = {
      year: point.year,
      month: point.month,
      day: point.day,
      hour: point.hour,
      minute: point.minute,
      second: point.second,
      millisecond: point.millisecond,
    };
    
    // Common DST spring-forward gap fix: map 01:xx to 02:xx local
    if (typeof base.hour === 'number' && base.hour === 1) {
      // Map nonexistent 01:xx local times to the earliest valid instant (02:00)
      const shifted = DateTime.fromObject({ ...base, hour: 2, minute: 0, second: 0, millisecond: 0 }, { zone: zoneName });
      if (shifted.isValid) {
        const vv = shifted.toMillis();
        if (Number.isFinite(vv)) return vv;
      }
    }
    for (let delta = 0; delta <= 120; delta += 1) {
      const t = DateTime.fromObject({ ...base, minute: base.minute + delta }, { zone: zoneName });
      if (t.isValid) {
        const v = t.toMillis();
        return Number.isFinite(v) ? v : null;
      }
    }
    return null;
  }

  if (typeof point === "number") {
    return Number.isFinite(point) ? point : null;
  }

  if (typeof point === "string") {
    const parsed = DateTime.fromISO(point, { setZone: true });
    if (parsed.isValid) {
      const v = parsed.toMillis();
      return Number.isFinite(v) ? v : null;
    }
    const m = point.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/);
    if (m) {
      const [, Y, M, D, H, Min, S] = m;
      const base = {
        year: Number(Y),
        month: Number(M),
        day: Number(D),
        hour: Number(H),
        minute: Number(Min),
        second: S ? Number(S) : 0,
      };
      const zone = parsed.zoneName ?? "UTC";
      for (let delta = 0; delta <= 120; delta += 1) {
        const t = DateTime.fromObject({ ...base, minute: base.minute + delta }, { zone });
        if (t.isValid) {
          const v = t.toMillis();
          return Number.isFinite(v) ? v : null;
        }
      }
    }
    return null;
  }

  return null;
}

function normalizeInterval(interval: IntervalLike): { start: number; end: number } | null {
  const start = intervalPointToMillis(interval.start);
  const end = intervalPointToMillis(interval.end);
  if (start === null || end === null) {
    return null;
  }
  if (!(start < end)) {
    return null;
  }
  return { start, end };
}

function highResNow(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function roundMilliseconds(value: number): number {
  return Math.round(value * 100) / 100;
}

function buildTiming(params: {
  totalMs: number;
  plannerMs?: number;
  assignmentMs?: number;
  holdMs?: number;
}): SelectorDecisionEvent["timing"] {
  const timing: SelectorDecisionEvent["timing"] = {
    totalMs: roundMilliseconds(params.totalMs),
  };

  if (typeof params.plannerMs === "number" && params.plannerMs > 0) {
    timing.plannerMs = roundMilliseconds(params.plannerMs);
  }
  if (typeof params.assignmentMs === "number" && params.assignmentMs > 0) {
    timing.assignmentMs = roundMilliseconds(params.assignmentMs);
  }
  if (typeof params.holdMs === "number" && params.holdMs > 0) {
    timing.holdMs = roundMilliseconds(params.holdMs);
  }

  return timing;
}

/**
 * Normalizes planner configuration details so telemetry consumers receive a
 * consistent view of the limits and feature toggles that influenced a search.
 */
function composePlannerConfig(params: {
  diagnostics: CandidateDiagnostics;
  scoringConfig: SelectorScoringConfig;
  combinationEnabled: boolean;
  requireAdjacency: boolean;
  adjacencyRequiredGlobally: boolean;
  adjacencyMinPartySize: number | null;
  featureFlags: ReturnType<typeof buildSelectorFeatureFlagsTelemetry>;
  serviceFallback: {
    usedFallback: boolean;
    fallbackService: ServiceKey | null;
  };
  demandMultiplier: number;
  demandRule?: DemandMultiplierResult["rule"];
  lookahead: Pick<LookaheadConfig, "enabled" | "windowMinutes" | "penaltyWeight" | "blockThreshold">;
}): NonNullable<SelectorDecisionEvent["plannerConfig"]> {
  const { diagnostics, scoringConfig } = params;
  const { limits } = diagnostics;

  return {
    combinationEnabled: params.combinationEnabled,
    requireAdjacency: params.requireAdjacency,
    adjacencyRequiredGlobally: params.adjacencyRequiredGlobally,
    adjacencyMinPartySize: params.adjacencyMinPartySize,
    kMax: limits.kMax,
   bucketLimit: limits.maxPlansPerSlack,
   evaluationLimit: limits.maxCombinationEvaluations,
   maxOverage: scoringConfig.maxOverage,
   maxTables: scoringConfig.maxTables,
    weights: {
      overage: scoringConfig.weights.overage,
      tableCount: scoringConfig.weights.tableCount,
      fragmentation: scoringConfig.weights.fragmentation,
      zoneBalance: scoringConfig.weights.zoneBalance,
      adjacencyCost: scoringConfig.weights.adjacencyCost,
      scarcity: scoringConfig.weights.scarcity,
    },
    featureFlags: {
      plannerTimePruning: params.featureFlags.plannerTimePruning,
      adjacencyUndirected: params.featureFlags.adjacencyUndirected,
      holdsStrictConflicts: params.featureFlags.holdsStrictConflicts,
      allocatorFailHard: params.featureFlags.allocatorFailHard,
      selectorScoring: params.featureFlags.selectorScoring,
      opsMetrics: params.featureFlags.opsMetrics,
      selectorLookahead: params.featureFlags.selectorLookahead,
    },
    serviceFallback: {
      used: params.serviceFallback.usedFallback,
      service: params.serviceFallback.fallbackService,
    },
    demandMultiplier: params.demandMultiplier,
    demandRule: params.demandRule
      ? {
          label: params.demandRule.label ?? null,
          source: params.demandRule.source,
          serviceWindow: params.demandRule.serviceWindow ?? null,
          days: params.demandRule.days,
          start: params.demandRule.start ?? null,
          end: params.demandRule.end ?? null,
          priority: params.demandRule.priority ?? null,
        }
      : null,
    lookahead: {
      enabled: params.lookahead.enabled,
      windowMinutes: params.lookahead.windowMinutes,
      penaltyWeight: params.lookahead.penaltyWeight,
      blockThreshold: params.lookahead.blockThreshold,
    },
  };
}

/**
 * Returns whether the half-open interval `[a.start, a.end)` intersects with `[b.start, b.end)`.
 *
 * Accepts ISO strings, Luxon {@link DateTime} instances, or epoch millisecond numbers.
 * Values are normalized to UTC and invalid intervals are treated as non-overlapping.
 */
export function windowsOverlap(a: IntervalLike, b: IntervalLike): boolean {
  
  const first = normalizeInterval(a);
  const second = normalizeInterval(b);
  
  if (!first || !second) {
    return false;
  }
  // Standard half-open intersection
  if (first.start < second.end && second.start < first.end) {
    return true;
  }
  // Edge case: touching at a DST transition boundary can represent overlap in local time intent.
  // If one of the original intervals crosses a zone offset change, treat boundary-touching as overlapping.
  const touches = first.end === second.start;
  if (touches) {
    const aHas = DateTime.isDateTime(a.start) && DateTime.isDateTime(a.end);
    const bHas = DateTime.isDateTime(b.start) && DateTime.isDateTime(b.end);
    const aDelta = aHas ? (a.end as DateTime).offset - (a.start as DateTime).offset : 0;
    const bDelta = bHas ? (b.end as DateTime).offset - (b.start as DateTime).offset : 0;
    // Only treat as overlap for spring-forward (positive offset change)
    if (aDelta > 0 || bDelta > 0) {
      return true;
    }
  }
  return false;
}

function toIsoUtc(dateTime: DateTime): string {
  return (
    dateTime.toUTC().toISO({ suppressMilliseconds: true }) ??
    dateTime.toUTC().toISO() ??
    dateTime.toUTC().toString()
  );
}

type TimeFilterMode = "strict" | "approx";

type TimeFilterStats = {
  prunedByTime: number;
  candidatesAfterTimePrune: number;
  pruned_by_time: number;
  candidates_after_time_prune: number;
};

type TimeFilterOptions = {
  busy: AvailabilityMap;
  mode?: TimeFilterMode;
  captureStats?: (stats: TimeFilterStats) => void;
};

function normalizeIsoString(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const parsed = DateTime.fromISO(value);
  if (!parsed.isValid) {
    return null;
  }
  return toIsoUtc(parsed);
}

function filterTimeAvailableTables(
  tables: Table[],
  window: BookingWindow,
  busy: AvailabilityMap | undefined,
  mode: TimeFilterMode,
  captureStats?: (stats: TimeFilterStats) => void,
): Table[] {
  if (!busy || busy.size === 0 || mode === "approx") {
    captureStats?.({
      prunedByTime: 0,
      candidatesAfterTimePrune: tables.length,
      pruned_by_time: 0,
      candidates_after_time_prune: tables.length,
    });
    return tables;
  }

  const targetStart = toIsoUtc(window.block.start);
  const targetEnd = toIsoUtc(window.block.end);
  let prunedByTime = 0;

  const filtered = tables.filter((table) => {
    const entry = busy.get(table.id);
    if (!entry) {
      return true;
    }
    const free = isWindowFree(entry.bitset, targetStart, targetEnd);
    if (!free) {
      prunedByTime += 1;
      return false;
    }
    return true;
  });

  captureStats?.({
    prunedByTime,
    candidatesAfterTimePrune: filtered.length,
    pruned_by_time: prunedByTime,
    candidates_after_time_prune: filtered.length,
  });

  return filtered;
}

export function filterAvailableTables(
  tables: Table[],
  partySize: number,
  window: ReturnType<typeof computeBookingWindow>,
  adjacency: Map<string, Set<string>>,
  avoidTables?: Set<string>,
  zoneId?: string | null,
  options?: { allowInsufficientCapacity?: boolean; timeFilter?: TimeFilterOptions },
): Table[] {
  const allowPartial = options?.allowInsufficientCapacity ?? false;
  const avoid = avoidTables ?? new Set<string>();

  const filtered = tables.filter((table) => {
    if (!table) return false;
    if (avoid.has(table.id)) return false;
    if (zoneId && table.zoneId !== zoneId) return false;
    if (table.active === false) return false;
    if (typeof table.status === "string" && table.status.toLowerCase() === "out_of_service") return false;
    const capacity = table.capacity ?? 0;
    if (!Number.isFinite(capacity) || capacity <= 0) return false;
    if (!allowPartial && capacity < partySize) return false;
    if (typeof table.maxPartySize === "number" && table.maxPartySize > 0 && partySize > table.maxPartySize) {
      return false;
    }
    if (typeof table.minPartySize === "number" && table.minPartySize > 0 && partySize < table.minPartySize) {
      return false;
    }
    // If adjacency map is supplied and requires zone-level adjacency, ensure entry exists.
    if (partiesRequireAdjacency(partySize) && adjacency.size > 0 && !adjacency.has(table.id)) {
      adjacency.set(table.id, new Set());
    }
    return true;
  });

  const timeFiltered =
    options?.timeFilter && window
      ? filterTimeAvailableTables(filtered, window, options.timeFilter.busy, options.timeFilter.mode ?? "strict", (stats) =>
          options.timeFilter?.captureStats?.(stats),
        )
      : filtered;

  return timeFiltered.sort((a, b) => {
    const capacityDiff = (a.capacity ?? 0) - (b.capacity ?? 0);
    if (capacityDiff !== 0) return capacityDiff;
    return a.tableNumber.localeCompare(b.tableNumber);
  });
}

/**
 * Determines whether adjacency must be enforced for a given party size.
 *
 * The allocator-level `requireAdjacency` flag acts as a global gate, while
 * `allocator.adjacencyMinPartySize` (when provided) raises the threshold so
 * that only large parties mandate adjacency.
 */
function partiesRequireAdjacency(partySize: number): boolean {
  if (!isAllocatorAdjacencyRequired()) {
    return false;
  }
  const minPartySize = getAllocatorAdjacencyMinPartySize();
  if (typeof minPartySize === "number") {
    return partySize >= minPartySize;
  }
  return true;
}

/**
 * Resolves the adjacency requirement for interactive flows, preferring the
 * explicit override supplied by the caller but falling back to the allocator
 * policy when no override is present.
 */
function resolveRequireAdjacency(partySize: number, override?: boolean): boolean {
  if (typeof override === "boolean") {
   return override;
  }
  return partiesRequireAdjacency(partySize);
}

type LookaheadConfig = {
  enabled: boolean;
  windowMinutes: number;
  penaltyWeight: number;
  blockThreshold: number;
};

type FutureBookingCandidate = {
  bookingId: string;
  partySize: number;
  window: BookingWindow;
  busy: AvailabilityMap;
  usedFallback: boolean;
  fallbackService: ServiceKey | null;
};

function prepareLookaheadBookings(params: {
  bookingId: string;
  currentWindow: BookingWindow;
  lookahead: LookaheadConfig;
  policy: VenuePolicy;
  contextBookings: ContextBookingRow[];
  holds: TableHold[];
}): FutureBookingCandidate[] {
  const { bookingId, currentWindow, lookahead, policy, contextBookings, holds } = params;
  if (!lookahead.enabled || lookahead.windowMinutes <= 0) {
    return [];
  }

  const cutoff = currentWindow.block.start.plus({ minutes: lookahead.windowMinutes });
  const candidates: FutureBookingCandidate[] = [];

  for (const booking of contextBookings) {
    if (!booking || booking.id === bookingId) {
      continue;
    }

    const partySize = booking.party_size ?? 0;
    if (!Number.isFinite(partySize) || partySize <= 0) {
      continue;
    }

    const assignments = booking.booking_table_assignments ?? [];
    if (assignments.length > 0) {
      continue;
    }

    let computed: BookingWindowWithFallback;
    try {
      computed = computeBookingWindowWithFallback({
        startISO: booking.start_at,
        bookingDate: booking.booking_date,
        startTime: booking.start_time,
        partySize,
        policy,
      });
    } catch {
      continue;
    }

    const { window } = computed;
    if (window.block.start <= currentWindow.block.start) {
      continue;
    }

    if (window.block.start > cutoff) {
      continue;
    }

    const busy = buildBusyMaps({
      targetBookingId: booking.id,
      bookings: contextBookings,
      holds,
      policy,
      targetWindow: window,
    });

    candidates.push({
      bookingId: booking.id,
      partySize,
      window,
      busy,
      usedFallback: computed.usedFallback,
      fallbackService: computed.fallbackService,
    });
  }

  return candidates;
}

function applyLookaheadPenalties(params: {
  plans: RankedTablePlan[];
  bookingWindow: BookingWindow;
  tables: Table[];
  adjacency: Map<string, Set<string>>;
  zoneId: string | null;
  futureBookings: FutureBookingCandidate[];
  config: SelectorScoringConfig;
  combinationEnabled: boolean;
  combinationLimit: number;
  selectorLimits: ReturnType<typeof getSelectorPlannerLimits>;
  penaltyWeight: number;
  blockThreshold: number;
}): {
  penalizedPlans: number;
  totalPenalty: number;
  evaluationMs: number;
  conflicts: Array<{ bookingId: string; planKey: string }>;
  blockedPlans: string[];
} {
  const {
    plans,
    bookingWindow,
    tables,
    adjacency,
    zoneId,
    futureBookings,
    config,
    combinationEnabled,
    combinationLimit,
    selectorLimits,
    penaltyWeight,
    blockThreshold,
  } = params;
  const start = performance.now();

  if (futureBookings.length === 0 || plans.length === 0 || penaltyWeight <= 0) {
    return {
      penalizedPlans: 0,
      totalPenalty: 0,
      evaluationMs: performance.now() - start,
      conflicts: [],
      blockedPlans: [],
    };
  }

  let penalizedPlans = 0;
  let totalPenalty = 0;
  const conflicts: Array<{ bookingId: string; planKey: string }> = [];
  const blockedPlanKeys = new Set<string>();

  for (const plan of plans) {
    let planPenalty = 0;
    const avoidTables = new Set(plan.tables.map((table) => table.id));

    for (const future of futureBookings) {
      if (!windowsOverlap(bookingWindow.block, future.window.block)) {
        continue;
      }

      const requireAdjacencyForFuture = resolveRequireAdjacency(future.partySize);
      const availableTables = filterAvailableTables(
        tables,
        future.partySize,
        future.window,
        adjacency,
        avoidTables,
        zoneId ?? null,
        {
          allowInsufficientCapacity: true,
          timeFilter: {
            busy: future.busy,
            mode: "strict",
          },
        },
      );

      if (availableTables.length === 0) {
        planPenalty += penaltyWeight;
        conflicts.push({ bookingId: future.bookingId, planKey: plan.tableKey });
        continue;
      }

      const futurePlans = buildScoredTablePlans({
        tables: availableTables,
        partySize: future.partySize,
        adjacency,
        config,
        enableCombinations: combinationEnabled,
        kMax: combinationLimit,
        maxPlansPerSlack: selectorLimits.maxPlansPerSlack,
        maxCombinationEvaluations: selectorLimits.maxCombinationEvaluations,
        enumerationTimeoutMs: selectorLimits.enumerationTimeoutMs,
        requireAdjacency: requireAdjacencyForFuture,
        demandMultiplier: 1,
      });

      if (futurePlans.plans.length === 0) {
        planPenalty += penaltyWeight;
        conflicts.push({ bookingId: future.bookingId, planKey: plan.tableKey });
      }
    }

    if (planPenalty > 0) {
      penalizedPlans += 1;
      totalPenalty += planPenalty;
      plan.score += planPenalty;
      plan.scoreBreakdown.futureConflictPenalty =
        (plan.scoreBreakdown.futureConflictPenalty ?? 0) + planPenalty;
      plan.scoreBreakdown.total += planPenalty;
    }

    if (blockThreshold > 0 && planPenalty >= blockThreshold) {
      blockedPlanKeys.add(plan.tableKey);
    }
  }

  if (blockedPlanKeys.size > 0) {
    for (let index = plans.length - 1; index >= 0; index -= 1) {
      if (blockedPlanKeys.has(plans[index].tableKey)) {
        plans.splice(index, 1);
      }
    }
  }

  const evaluationMs = performance.now() - start;
  return {
    penalizedPlans,
    totalPenalty,
    evaluationMs,
    conflicts,
    blockedPlans: Array.from(blockedPlanKeys),
  };
}

function sortPlansByScore(plans: RankedTablePlan[]): void {
  plans.sort((a, b) => {
    if (a.score !== b.score) {
      return a.score - b.score;
    }
    if (a.metrics.overage !== b.metrics.overage) {
      return a.metrics.overage - b.metrics.overage;
    }
    if (a.metrics.tableCount !== b.metrics.tableCount) {
      return a.metrics.tableCount - b.metrics.tableCount;
    }
    if (a.totalCapacity !== b.totalCapacity) {
      return a.totalCapacity - b.totalCapacity;
    }
    if (a.metrics.fragmentation !== b.metrics.fragmentation) {
      return a.metrics.fragmentation - b.metrics.fragmentation;
    }
    if (a.metrics.adjacencyCost !== b.metrics.adjacencyCost) {
      return a.metrics.adjacencyCost - b.metrics.adjacencyCost;
    }
    return a.tableKey.localeCompare(b.tableKey, "en");
  });
}

export function evaluateLookahead(params: {
  lookahead: LookaheadConfig;
  bookingId: string;
  bookingWindow: BookingWindow;
  plansResult: BuildCandidatesResult;
  tables: Table[];
  adjacency: Map<string, Set<string>>;
  zoneId: string | null;
  policy: VenuePolicy;
  contextBookings: ContextBookingRow[];
  holds: TableHold[];
  combinationEnabled: boolean;
  combinationLimit: number;
  selectorLimits: ReturnType<typeof getSelectorPlannerLimits>;
  scoringConfig: SelectorScoringConfig;
}): CandidateDiagnostics["lookahead"] {
  const {
    lookahead,
    bookingId,
    bookingWindow,
    plansResult,
    tables,
    adjacency,
    zoneId,
    policy,
    contextBookings,
    holds,
    combinationEnabled,
    combinationLimit,
    selectorLimits,
    scoringConfig,
  } = params;

  if (!lookahead.enabled) {
    return {
      enabled: false,
      evaluationMs: 0,
      futureBookingsConsidered: 0,
      penalizedPlans: 0,
      totalPenalty: 0,
      windowMinutes: lookahead.windowMinutes,
      conflicts: [],
      blockedPlans: [],
      hardBlockTriggered: false,
    };
  }

  const futureBookings = prepareLookaheadBookings({
    bookingId,
    currentWindow: bookingWindow,
    lookahead,
    policy,
    contextBookings,
    holds,
  });

  if (futureBookings.length === 0 || plansResult.plans.length === 0) {
    return {
      enabled: true,
      evaluationMs: 0,
      futureBookingsConsidered: futureBookings.length,
      penalizedPlans: 0,
      totalPenalty: 0,
      windowMinutes: lookahead.windowMinutes,
      conflicts: [],
      blockedPlans: [],
      hardBlockTriggered: false,
    };
  }

  const { penalizedPlans, totalPenalty, evaluationMs, conflicts, blockedPlans } = applyLookaheadPenalties({
    plans: plansResult.plans,
    bookingWindow,
    tables,
    adjacency,
    zoneId,
    futureBookings,
    config: scoringConfig,
    combinationEnabled,
    combinationLimit,
    selectorLimits,
    penaltyWeight: lookahead.penaltyWeight,
    blockThreshold: lookahead.blockThreshold,
  });

  if (plansResult.plans.length === 0) {
    return {
      enabled: true,
      evaluationMs,
      futureBookingsConsidered: futureBookings.length,
      penalizedPlans,
      totalPenalty,
      windowMinutes: lookahead.windowMinutes,
      conflicts,
      blockedPlans,
      hardBlockTriggered: blockedPlans.length > 0,
    };
  }

  if (penalizedPlans > 0) {
    sortPlansByScore(plansResult.plans);
  }

  return {
    enabled: true,
    evaluationMs,
    futureBookingsConsidered: futureBookings.length,
    penalizedPlans,
    totalPenalty,
    windowMinutes: lookahead.windowMinutes,
    conflicts,
    blockedPlans,
    hardBlockTriggered: blockedPlans.length > 0,
  };
}

async function loadBooking(bookingId: string, client: DbClient): Promise<BookingRow> {
  const { data, error } = await client
    .from("bookings")
    .select(
      [
        "id",
        "restaurant_id",
        "booking_date",
        "start_time",
        "end_time",
        "start_at",
        "end_at",
        "party_size",
        "status",
        "seating_preference",
        "restaurants(timezone)",
      ].join(","),
    )
    .eq("id", bookingId)
    .maybeSingle();

  if (error) {
    throw new ManualSelectionInputError(error.message ?? "Failed to load booking", "BOOKING_LOOKUP_FAILED", 500);
  }

  if (!data) {
    throw new ManualSelectionInputError("Booking not found", "BOOKING_NOT_FOUND", 404);
  }

  return normalizeBookingRow(data as unknown as BookingRow);
}

type RestaurantInfo = {
  timezone: string | null;
  slug: string | null;
};

async function loadRestaurantInfo(restaurantId: string, client: DbClient): Promise<RestaurantInfo> {
  const { data, error } = await client
    .from("restaurants")
    .select("timezone, slug")
    .eq("id", restaurantId)
    .maybeSingle();

  if (error) {
    throw new ManualSelectionInputError(error.message ?? "Failed to load restaurant metadata", "RESTAURANT_LOOKUP_FAILED", 500);
  }

  return {
    timezone: data?.timezone ?? null,
    slug: data?.slug ?? null,
  };
}

async function loadRestaurantTimezone(restaurantId: string, client: DbClient): Promise<string | null> {
  const info = await loadRestaurantInfo(restaurantId, client);
  return info.timezone;
}

async function loadTablesForRestaurant(restaurantId: string, client: DbClient): Promise<Table[]> {
  // Try cache first
  try {
    const { getInventoryCache } = await import("@/server/capacity/cache");
    const cached = getInventoryCache(restaurantId);
    if (Array.isArray(cached) && cached.length > 0) {
      return cached as Table[];
    }
  } catch {
    // no-op on cache errors
  }

  const { data, error } = await client
    .from("table_inventory")
    .select<typeof TABLE_INVENTORY_SELECT, TableInventoryRow>(TABLE_INVENTORY_SELECT)
    .eq("restaurant_id", restaurantId)
    .order("table_number", { ascending: true });

  if (error || !data) {
    return [];
  }

  const rows = data as unknown as Tables<"table_inventory">[];

  const tables = rows.map((row) => ({
    id: row.id,
    tableNumber: row.table_number,
    capacity: row.capacity ?? 0,
    minPartySize: row.min_party_size ?? null,
    maxPartySize: row.max_party_size ?? null,
    section: row.section,
    category: row.category,
    seatingType: row.seating_type,
    mobility: row.mobility,
    zoneId: row.zone_id,
    status: row.status,
    active: row.active,
    position: row.position,
  }));

  try {
    const { setInventoryCache } = await import("@/server/capacity/cache");
    setInventoryCache(restaurantId, tables);
  } catch {
    // ignore cache set failures
  }

  return tables;
}

async function loadTablesByIds(
  restaurantId: string,
  tableIds: string[],
  client: DbClient,
): Promise<Table[]> {
  if (tableIds.length === 0) {
    return [];
  }

  const uniqueIds = Array.from(new Set(tableIds));
  const { data, error } = await client
    .from("table_inventory")
    .select<typeof TABLE_INVENTORY_SELECT, TableInventoryRow>(TABLE_INVENTORY_SELECT)
    .eq("restaurant_id", restaurantId)
    .in("id", uniqueIds);

  if (error || !data) {
    return [];
  }

  const rows = data as unknown as TableInventoryRow[];

  const lookup = new Map(
    rows.map((row) => [
      row.id,
      {
        id: row.id,
        tableNumber: row.table_number,
        capacity: row.capacity ?? 0,
        minPartySize: row.min_party_size ?? null,
        maxPartySize: row.max_party_size ?? null,
        section: row.section,
        category: row.category,
        seatingType: row.seating_type,
        mobility: row.mobility,
        zoneId: row.zone_id,
        status: row.status,
        active: row.active,
        position: row.position,
      } satisfies Table,
    ]),
  );

  return tableIds.reduce<Table[]>((acc, id) => {
    const table = lookup.get(id);
    if (table) {
      acc.push(table);
    }
    return acc;
  }, []);
}

async function loadAdjacency(
  restaurantId: string,
  tableIds: string[],
  client: DbClient,
): Promise<Map<string, Set<string>>> {
  const uniqueTableIds = Array.from(
    new Set(
      tableIds.filter((value): value is string => typeof value === "string" && value.length > 0),
    ),
  );

  if (uniqueTableIds.length === 0) {
    return new Map();
  }
  // Try to satisfy from cache if available
  let cachedGraph: Map<string, Set<string>> | null = null;
  try {
    const { getAdjacencyCache } = await import("@/server/capacity/cache");
    cachedGraph = getAdjacencyCache(restaurantId);
  } catch {
    cachedGraph = null;
  }
  const missing: string[] = [];
  if (cachedGraph) {
    for (const id of uniqueTableIds) {
      if (!cachedGraph.has(id)) {
        missing.push(id);
      }
    }
  }
  const needFetch = !cachedGraph || missing.length > 0;

  type AdjacencyRow = { table_a: string | null; table_b: string | null };
  const baseQuery = () => client.from("table_adjacencies").select("table_a, table_b");
  const adjacencyUndirected = isAdjacencyQueryUndirected();
  const targetIds = needFetch && cachedGraph ? missing : uniqueTableIds;
  const forward = await baseQuery().in("table_a", targetIds);
  if (forward.error) {
    return new Map();
  }

  const reverse = adjacencyUndirected ? await baseQuery().in("table_b", targetIds) : null;
  if (reverse?.error) {
    return new Map();
  }

  const forwardRows = Array.isArray(forward.data) ? (forward.data as AdjacencyRow[]) : [];
  const reverseRows =
    adjacencyUndirected && reverse && Array.isArray(reverse.data)
      ? (reverse.data as AdjacencyRow[])
      : [];

  if (adjacencyUndirected) {
    // Data integrity check: ensure symmetry when undirected is enabled
    const missingReverse: Array<{ a: string; b: string }> = [];
    const forwardSet = new Set(
      forwardRows
        .filter((r) => r.table_a && r.table_b)
        .map((r) => `${r.table_a as string}->${r.table_b as string}`),
    );
    const reverseSet = new Set(
      reverseRows
        .filter((r) => r.table_a && r.table_b)
        .map((r) => `${r.table_b as string}->${r.table_a as string}`),
    );
    for (const key of forwardSet) {
      if (!reverseSet.has(key)) {
        const [a, b] = key.split("->");
        missingReverse.push({ a, b });
      }
    }
    if (missingReverse.length > 0) {
      console.warn("[capacity.adjacency] asymmetry detected in table_adjacencies (undirected mode)", {
        missing: missingReverse.slice(0, 10),
        total: missingReverse.length,
      });
    }
  }

  const map = cachedGraph ? new Map<string, Set<string>>(cachedGraph) : new Map<string, Set<string>>();
  // If we fetched for specific targets, clear any stale cached entries for those ids
  if (targetIds.length > 0) {
    for (const id of targetIds) {
      map.delete(id);
    }
  }
  const addEdge = (from: string | null, to: string | null) => {
    if (!from || !to) {
      return;
    }
    if (!map.has(from)) {
      map.set(from, new Set());
    }
    map.get(from)!.add(to);
  };

  for (const row of forwardRows) {
    addEdge(row.table_a, row.table_b);
    if (adjacencyUndirected) {
      addEdge(row.table_b, row.table_a);
    }
  }

  if (adjacencyUndirected) {
    for (const row of reverseRows) {
      addEdge(row.table_a, row.table_b);
      addEdge(row.table_b, row.table_a);
    }
  }

  // Update cache
  try {
    const { setAdjacencyCache } = await import("@/server/capacity/cache");
    setAdjacencyCache(restaurantId, map);
  } catch {
    // ignore cache set failures
  }

  // Return only requested nodes to reduce payloads
  const filtered = new Map<string, Set<string>>();
  for (const id of uniqueTableIds) {
    if (map.has(id)) {
      filtered.set(id, new Set(map.get(id)!));
    }
  }
  return filtered;
}

async function loadContextBookings(
  restaurantId: string,
  bookingDate: string | null,
  client: DbClient,
  aroundWindow?: { startIso: string; endIso: string; paddingMinutes?: number },
): Promise<ContextBookingRow[]> {
  if (!bookingDate) {
    return [];
  }

  const paddingDefault = Math.max(0, Math.min(getContextQueryPaddingMinutes(), 240));
  const pad = Math.max(0, Math.min(aroundWindow?.paddingMinutes ?? paddingDefault, 240));
  const startIso = aroundWindow?.startIso ?? null;
  const endIso = aroundWindow?.endIso ?? null;
  const padMs = pad * 60 * 1000;
  const startPad = startIso ? DateTime.fromISO(startIso, { setZone: true }).minus({ milliseconds: padMs }).toISO() : null;
  const endPad = endIso ? DateTime.fromISO(endIso, { setZone: true }).plus({ milliseconds: padMs }).toISO() : null;

  const query = client
    .from("bookings")
    .select(
      [
        "id",
        "party_size",
        "status",
        "start_time",
        "end_time",
        "start_at",
        "end_at",
        "booking_date",
        "booking_table_assignments(table_id)",
      ].join(","),
    )
    .eq("restaurant_id", restaurantId)
    .eq("booking_date", bookingDate)
    .in("status", [...BOOKING_BLOCKING_STATUSES])
    .order("start_at", { ascending: true });

  const hasGt = typeof (query as unknown as { gt?: unknown }).gt === "function";
  const hasLt = typeof (query as unknown as { lt?: unknown }).lt === "function";
  if (startPad && hasGt) {
    (query as unknown as { gt: (col: string, val: string) => unknown }).gt("end_at", startPad);
  }
  if (endPad && hasLt) {
    (query as unknown as { lt: (col: string, val: string) => unknown }).lt("start_at", endPad);
  }

  const { data, error } = await query;

  if (error || !data) {
    return [];
  }

  return data as unknown as ContextBookingRow[];
}

type BookingAssignmentRow = {
  table_id: string;
  id: string;
  start_at: string | null;
  end_at: string | null;
  merge_group_id: string | null;
};

async function loadTableAssignmentsForTables(
  bookingId: string,
  tableIds: string[],
  client: DbClient,
): Promise<BookingAssignmentRow[]> {
  if (tableIds.length === 0) {
    return [];
  }

  const { data, error } = await client
    .from("booking_table_assignments")
    .select("table_id, id, start_at, end_at, merge_group_id")
    .eq("booking_id", bookingId);

  if (error || !data) {
    return [];
  }

  const rows = data as unknown as BookingAssignmentRow[];
  return rows.filter((row) => tableIds.includes(row.table_id));
}

function registerBusyWindow(
  map: AvailabilityMap,
  tableId: string,
  window: { startAt: string; endAt: string; bookingId: string | null; source: "booking" | "hold" },
): void {
  if (!map.has(tableId)) {
    map.set(tableId, {
      bitset: createAvailabilityBitset(),
      windows: [],
    });
  }
  const entry = map.get(tableId)!;
  markWindow(entry.bitset, window.startAt, window.endAt);
  entry.windows.push({
    tableId,
    ...window,
  });
}

function buildBusyMaps(params: {
  targetBookingId: string;
  bookings: ContextBookingRow[];
  holds: TableHold[];
  excludeHoldId?: string | null;
  policy: VenuePolicy;
  targetWindow?: BookingWindow | null;
}): AvailabilityMap {
  const { targetBookingId, bookings, holds, excludeHoldId, policy, targetWindow } = params;
  const map: AvailabilityMap = new Map();
  const pruneToTargetWindow = isPlannerTimePruningEnabled();
  const targetInterval =
    pruneToTargetWindow && targetWindow
      ? {
          start: toIsoUtc(targetWindow.block.start),
          end: toIsoUtc(targetWindow.block.end),
        }
      : null;

  for (const booking of bookings) {
    if (booking.id === targetBookingId) continue;
    const assignments = booking.booking_table_assignments ?? [];
    if (assignments.length === 0) continue;

    const { window } = computeBookingWindowWithFallback({
      startISO: booking.start_at,
      bookingDate: booking.booking_date,
      startTime: booking.start_time,
      partySize: booking.party_size,
      policy,
    });

    const bookingInterval = {
      start: toIsoUtc(window.block.start),
      end: toIsoUtc(window.block.end),
    };

    if (targetInterval && !windowsOverlap(bookingInterval, targetInterval)) {
      continue;
    }

    for (const assignment of assignments) {
      if (!assignment?.table_id) continue;
      registerBusyWindow(map, assignment.table_id, {
        startAt: bookingInterval.start,
        endAt: bookingInterval.end,
        bookingId: booking.id,
        source: "booking",
      });
    }
  }

  for (const hold of holds) {
    if (excludeHoldId && hold.id === excludeHoldId) continue;
    if (
      targetInterval &&
      !windowsOverlap(
        { start: hold.startAt, end: hold.endAt },
        targetInterval,
      )
    ) {
      continue;
    }
    for (const tableId of hold.tableIds) {
      registerBusyWindow(map, tableId, {
        startAt: hold.startAt,
        endAt: hold.endAt,
        bookingId: hold.bookingId,
        source: "hold",
      });
    }
  }

  return map;
}

function extractConflictsForTables(
  busy: AvailabilityMap,
  tableIds: string[],
  window: ReturnType<typeof computeBookingWindow>,
): ManualAssignmentConflict[] {
  const conflicts: ManualAssignmentConflict[] = [];
  const targetStart = toIsoUtc(window.block.start);
  const targetEnd = toIsoUtc(window.block.end);

  for (const tableId of tableIds) {
    const entry = busy.get(tableId);
    if (!entry) continue;
    if (isWindowFree(entry.bitset, targetStart, targetEnd)) continue;
    for (const other of entry.windows) {
      if (windowsOverlap({ start: targetStart, end: targetEnd }, { start: other.startAt, end: other.endAt })) {
        conflicts.push({
          tableId,
          bookingId: other.bookingId,
          startAt: other.startAt,
          endAt: other.endAt,
          source: other.source,
        });
      }
    }
  }

  return conflicts;
}

function formatHoldConflictReason(conflicts: HoldConflictInfo[], plan: RankedTablePlan): string {
  if (conflicts.length === 0) {
    return "Conflicts with existing holds";
  }

  const tableLookup = new Map<string, string>();
  for (const table of plan.tables) {
    tableLookup.set(table.id, table.tableNumber ?? table.id);
  }

  const tableLabels = new Set<string>();
  for (const conflict of conflicts) {
    for (const tableId of conflict.tableIds) {
      const label = tableLookup.get(tableId) ?? tableId;
      tableLabels.add(label);
    }
  }

  const sortedLabels = Array.from(tableLabels).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  let message = sortedLabels.length > 0
    ? `Conflicts with holds on tables ${sortedLabels.join(", ")}`
    : "Conflicts with existing holds";

  const latestEnd = conflicts.reduce<string | null>((latest, conflict) => {
    if (!conflict.endAt) {
      return latest;
    }
    if (!latest) {
      return conflict.endAt;
    }
    return conflict.endAt > latest ? conflict.endAt : latest;
  }, null);

  if (latestEnd) {
    const retry = DateTime.fromISO(latestEnd);
    if (retry.isValid) {
      message += `; retry after ${retry.toUTC().toISOTime({ suppressSeconds: false, suppressMilliseconds: true })}`;
    }
  }

  return message;
}

function evaluateAdjacency(
  tableIds: string[],
  adjacency: Map<string, Set<string>>,
): { connected: boolean } {
  if (tableIds.length <= 1) {
    return { connected: true };
  }
  const queue = [tableIds[0]!];
  const visited = new Set<string>([tableIds[0]!]);
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;
    const neighbors = adjacency.get(current);
    if (!neighbors) continue;
    for (const neighbor of neighbors) {
      if (!tableIds.includes(neighbor)) continue;
      if (visited.has(neighbor)) continue;
      visited.add(neighbor);
      queue.push(neighbor);
    }
  }
  return { connected: visited.size === tableIds.length };
}

function summarizeSelection(tables: Table[], partySize: number): ManualSelectionSummary {
  const totalCapacity = tables.reduce((sum, table) => sum + (table.capacity ?? 0), 0);
  const zoneIds = new Set(tables.map((table) => table.zoneId));
  return {
    tableCount: tables.length,
    totalCapacity,
    slack: Math.max(0, totalCapacity - partySize),
    zoneId: zoneIds.size === 1 ? tables[0]?.zoneId ?? null : null,
    tableNumbers: tables.map((table) => table.tableNumber),
    partySize,
  };
}

function buildManualChecks(params: {
  summary: ManualSelectionSummary;
  tables: Table[];
  requireAdjacency: boolean;
  adjacency: Map<string, Set<string>>;
  conflicts: ManualAssignmentConflict[];
  holdConflicts: HoldConflictInfo[];
}): ManualSelectionCheck[] {
  const checks: ManualSelectionCheck[] = [];
  const { summary, tables, requireAdjacency, adjacency, conflicts, holdConflicts } = params;

  checks.push({
    id: "capacity",
    status: summary.totalCapacity >= summary.partySize ? "ok" : "error",
    message:
      summary.totalCapacity >= summary.partySize
        ? "Capacity satisfied"
        : "Selected tables do not meet requested party size",
    details: {
      totalCapacity: summary.totalCapacity,
      partySize: summary.partySize,
      slack: summary.slack,
    },
  });

  if (summary.zoneId === null) {
    checks.push({
      id: "zone",
      status: "error",
      message: "Tables must belong to the same zone for manual assignment",
    });
  } else {
    checks.push({
      id: "zone",
      status: "ok",
      message: `Zone ${summary.zoneId} validated`,
    });
  }

  if (tables.length > 1) {
    const allMovable = tables.every((table) => table.mobility === "movable");
    checks.push({
      id: "movable",
      status: allMovable ? "ok" : "error",
      message: allMovable
        ? "All tables are movable"
        : "Merged assignments require movable tables",
    });
  } else {
    checks.push({
      id: "movable",
      status: "ok",
      message: "Single table selection",
    });
  }

  if (requireAdjacency && tables.length > 1) {
    const evaluation = evaluateAdjacency(
      tables.map((table) => table.id),
      adjacency,
    );
    checks.push({
      id: "adjacency",
      status: evaluation.connected ? "ok" : "error",
      message: evaluation.connected
        ? "Tables are connected"
        : "Tables must be adjacent when adjacency enforcement is enabled",
    });
  } else {
    checks.push({
      id: "adjacency",
      status: "ok",
      message: "Adjacency not required",
    });
  }

  checks.push({
    id: "conflict",
    status: conflicts.length === 0 && holdConflicts.length === 0 ? "ok" : "error",
    message:
      conflicts.length === 0 && holdConflicts.length === 0
        ? "No conflicting assignments"
        : "Existing assignments or holds conflict with selection",
    details: {
      conflicts,
      holdConflicts,
    },
  });

  checks.push({
    id: "holds",
    status: holdConflicts.length === 0 ? "ok" : "error",
    message: holdConflicts.length === 0 ? "No holds blocking selection" : "Tables currently on hold",
    details: {
      holds: holdConflicts,
    },
  });

  return checks;
}

export async function evaluateManualSelection(options: ManualSelectionOptions): Promise<ManualValidationResult> {
  const { bookingId, tableIds, requireAdjacency: requireAdjacencyOverride, excludeHoldId = null, client } = options;

  if (!Array.isArray(tableIds) || tableIds.length === 0) {
    throw new ManualSelectionInputError("At least one table must be selected", "TABLES_REQUIRED");
  }

  const supabase = ensureClient(client);
  const booking = await loadBooking(bookingId, supabase);
  const restaurantTimezone =
    (booking.restaurants && !Array.isArray(booking.restaurants) ? booking.restaurants.timezone : null) ??
    (await loadRestaurantTimezone(booking.restaurant_id, supabase)) ??
    getVenuePolicy().timezone;
  const policy = getVenuePolicy({ timezone: restaurantTimezone ?? undefined });
  const policyVersion = hashPolicyVersion(policy);

  const { window } = computeBookingWindowWithFallback({
    startISO: booking.start_at,
    bookingDate: booking.booking_date,
    startTime: booking.start_time,
    partySize: booking.party_size,
    policy,
  });

  const selectionTables = await loadTablesByIds(booking.restaurant_id, tableIds, supabase);
  if (selectionTables.length !== tableIds.length) {
    throw new ManualSelectionInputError("One or more selected tables were not found", "TABLE_LOOKUP_FAILED");
  }

  const adjacency = await loadAdjacency(booking.restaurant_id, tableIds, supabase);

  const contextBookings = await loadContextBookings(
    booking.restaurant_id,
    booking.booking_date ?? null,
    supabase,
    {
      startIso: toIsoUtc(window.block.start),
      endIso: toIsoUtc(window.block.end),
    },
  );
  let holds: TableHold[] = [];
  if (isHoldsEnabled()) {
    try {
      holds = await listActiveHoldsForBooking({ bookingId, client: supabase });
    } catch {
      holds = [];
    }
  }

  const busy = buildBusyMaps({
    targetBookingId: bookingId,
    bookings: contextBookings,
    holds,
    excludeHoldId,
    policy,
    targetWindow: window,
  });

  const conflicts = extractConflictsForTables(busy, tableIds, window);
  let holdConflicts: HoldConflictInfo[] = [];
  try {
    holdConflicts = await findHoldConflicts({
      restaurantId: booking.restaurant_id,
      tableIds,
      startAt: toIsoUtc(window.block.start),
      endAt: toIsoUtc(window.block.end),
      excludeHoldId,
      client: supabase,
    });
  } catch {
    holdConflicts = [];
  }

  const requireAdjacency = resolveRequireAdjacency(booking.party_size, requireAdjacencyOverride);
  const summary = summarizeSelection(selectionTables, booking.party_size);
  const checks = buildManualChecks({
    summary,
    tables: selectionTables,
    requireAdjacency,
    adjacency,
    conflicts,
    holdConflicts,
  });

  const ok = checks.every((check) => check.status !== "error");

  return {
    ok,
    summary,
    checks,
    policyVersion,
  };
}

export async function createManualHold(options: ManualHoldOptions): Promise<ManualHoldResult> {
  const { bookingId, tableIds, createdBy, holdTtlSeconds = DEFAULT_HOLD_TTL_SECONDS, requireAdjacency, excludeHoldId, client } = options;
  const supabase = ensureClient(client);

  const validation = await evaluateManualSelection({
    bookingId,
    tableIds,
    requireAdjacency,
    excludeHoldId,
    client: supabase,
  });

  if (!validation.ok || !validation.summary) {
    return {
      hold: null,
      validation,
    };
  }

  const booking = await loadBooking(bookingId, supabase);
  const restaurantTimezone =
    (booking.restaurants && !Array.isArray(booking.restaurants) ? booking.restaurants.timezone : null) ??
    (await loadRestaurantTimezone(booking.restaurant_id, supabase)) ??
    getVenuePolicy().timezone;
  const policy = getVenuePolicy({ timezone: restaurantTimezone ?? undefined });
  const policyVersion = typeof (validation as { policyVersion?: string }).policyVersion === "string"
    ? (validation as { policyVersion?: string }).policyVersion!
    : hashPolicyVersion(policy);

  const { window } = computeBookingWindowWithFallback({
    startISO: booking.start_at,
    bookingDate: booking.booking_date,
    startTime: booking.start_time,
    partySize: booking.party_size,
    policy,
  });

  const selectionTables = await loadTablesByIds(booking.restaurant_id, tableIds, supabase);
  if (selectionTables.length !== tableIds.length) {
    throw new ManualSelectionInputError("Selected tables could not be loaded", "TABLE_LOOKUP_FAILED");
  }

  const startAtIso = toIsoUtc(window.block.start);
  const endAtIso = toIsoUtc(window.block.end);

  const expiresAt =
    options.holdExpiresAt ??
    toIsoUtc(DateTime.now().plus({ seconds: holdTtlSeconds })) ??
    toIsoUtc(window.block.start.plus({ minutes: 2 }));

  const zoneIdValue = validation.summary.zoneId ?? selectionTables[0]?.zoneId;
  if (!zoneIdValue) {
    throw new ManualSelectionInputError("Unable to determine zone for selected tables", "ZONE_REQUIRED");
  }

  // Compute adjacency/zone snapshot for freeze semantics
  const adjacency = await loadAdjacency(booking.restaurant_id, tableIds, supabase);
  const adjacencyUndirected = isAdjacencyQueryUndirected();
  const zoneIds = Array.from(new Set(selectionTables.map((t) => t.zoneId))).filter(Boolean) as string[];
  const edgeSet = new Set<string>();
  for (const a of tableIds) {
    const neighbors = adjacency.get(a);
    if (!neighbors) continue;
    for (const b of neighbors) {
      if (!tableIds.includes(b)) continue;
      const key = adjacencyUndirected
        ? ([a, b].sort((x, y) => x.localeCompare(y)) as [string, string]).join("->")
        : `${a}->${b}`;
      edgeSet.add(key);
    }
  }
  const normalizedEdges = Array.from(edgeSet).sort();
  const adjacencySnapshot = computePayloadChecksum({ undirected: adjacencyUndirected, edges: normalizedEdges });

  const holdPayload: CreateTableHoldInput = {
    bookingId,
    restaurantId: booking.restaurant_id,
    zoneId: zoneIdValue,
    tableIds,
    startAt: startAtIso,
    endAt: endAtIso,
    expiresAt,
    createdBy,
    metadata: {
      selection: {
        tableIds,
        summary: validation.summary,
        snapshot: {
          zoneIds,
          adjacency: {
            undirected: adjacencyUndirected,
            edges: normalizedEdges,
            hash: adjacencySnapshot,
          },
        },
      },
      policyVersion,
    },
    client: supabase,
  };

  const hold = await createTableHold(holdPayload);

  if (excludeHoldId) {
    try {
      await releaseHoldWithRetry({ holdId: excludeHoldId, client: supabase });
    } catch (error) {
      console.warn("[capacity][manual][holds] failed to release replaced hold", {
        bookingId,
        newHoldId: hold.id,
        previousHoldId: excludeHoldId,
        error,
      });
    }
  }

  return {
    hold,
    validation,
  };
}

export async function getManualAssignmentContext(options: {
  bookingId: string;
  client?: DbClient;
}): Promise<ManualAssignmentContext> {
  const { bookingId, client } = options;
  const supabase = ensureClient(client);
  const booking = await loadBooking(bookingId, supabase);

  const restaurantTimezone =
    (booking.restaurants && !Array.isArray(booking.restaurants) ? booking.restaurants.timezone : null) ??
    (await loadRestaurantTimezone(booking.restaurant_id, supabase)) ??
    getVenuePolicy().timezone;
  const policy = getVenuePolicy({ timezone: restaurantTimezone ?? undefined });

  const { window } = computeBookingWindowWithFallback({
    startISO: booking.start_at,
    bookingDate: booking.booking_date,
    startTime: booking.start_time,
    partySize: booking.party_size,
    policy,
  });

  const tables = await loadTablesForRestaurant(booking.restaurant_id, supabase);
  const contextBookings = await loadContextBookings(
    booking.restaurant_id,
    booking.booking_date ?? null,
    supabase,
    {
      startIso: toIsoUtc(window.block.start),
      endIso: toIsoUtc(window.block.end),
    },
  );

  let holds: ManualAssignmentContextHold[] = [];
  if (isHoldsEnabled()) {
    try {
      const rawHolds = await fetchHoldsForWindow(booking.restaurant_id, window, supabase);
      holds = await hydrateHoldMetadata(rawHolds, supabase);
    } catch (error: unknown) {
      const code = extractErrorCode(error);
      if (code === "42P01") {
        console.warn("[capacity][manual][context] holds table unavailable; skipping hold hydration", {
          bookingId,
        });
      } else {
        console.warn("[capacity][manual][context] failed to list holds", { bookingId, error });
      }
      holds = [];
    }
  }

  const busy = buildBusyMaps({
    targetBookingId: bookingId,
    bookings: contextBookings,
    holds,
    policy,
    targetWindow: window,
  });

  const bookingAssignments = await loadTableAssignmentsForTables(
    bookingId,
    tables.map((table) => table.id),
    supabase,
  );

  const conflicts = extractConflictsForTables(
    busy,
    tables.map((table) => table.id),
    window,
  );

  const activeHold = holds.find((hold) => hold.bookingId === bookingId) ?? null;

  // Compute context version from holds + assignments + flags + window
  const flags = {
    holdsStrictConflicts: isHoldStrictConflictsEnabled(),
    adjacencyRequired: isAllocatorAdjacencyRequired(),
    adjacencyUndirected: isAdjacencyQueryUndirected(),
  };
  const contextVersionPayload = {
    holds: holds.map((h) => ({ id: h.id, tableIds: h.tableIds, startAt: h.startAt, endAt: h.endAt })),
    assignments: bookingAssignments.map((row) => row.table_id),
    flags,
    window: {
      startAt: toIsoUtc(window.block.start),
      endAt: toIsoUtc(window.block.end),
    },
  };
  const contextVersion = computePayloadChecksum(contextVersionPayload);
  const serverNow = toIsoUtc(DateTime.now());

  return {
    booking,
    tables,
    bookingAssignments: bookingAssignments.map((row) => row.table_id),
    holds,
    activeHold,
    conflicts,
    window: {
      startAt: toIsoUtc(window.block.start),
      endAt: toIsoUtc(window.block.end),
    },
    flags,
    contextVersion,
    serverNow,
  };
}

async function hydrateHoldMetadata(holds: TableHold[], client: DbClient): Promise<ManualAssignmentContextHold[]> {
  if (holds.length === 0) {
    return [];
  }
  const creatorIds = Array.from(
    new Set(
      holds
        .map((hold) => hold.createdBy)
        .filter((value): value is string => Boolean(value)),
    ),
  );

  let creators: Array<{ id: string; name: string | null; email: string | null }> = [];
  if (creatorIds.length > 0) {
    const { data, error } = await client
      .from("profiles")
      .select("id, name, email")
      .in("id", creatorIds);

    if (!error && data) {
      creators = data as Array<{ id: string; name: string | null; email: string | null }>;
    }
  }

  return holds.map((hold) => {
    const creator = creators.find((profile) => profile.id === hold.createdBy);
    return {
      ...hold,
      createdByName: creator?.name ?? null,
      createdByEmail: creator?.email ?? null,
    };
  });
}

async function fetchHoldsForWindow(
  restaurantId: string,
  window: ReturnType<typeof computeBookingWindow>,
  client: DbClient,
): Promise<TableHold[]> {
  const { data, error } = await client
    .from("table_holds")
    .select("*, table_hold_members(table_id)")
    .eq("restaurant_id", restaurantId)
    .gt("expires_at", new Date().toISOString())
    .lt("start_at", toIsoUtc(window.block.end))
    .gt("end_at", toIsoUtc(window.block.start));

  if (error || !data) {
    throw error ?? new Error("Failed to load holds");
  }

  const rows = data as TableHoldRow[];

  return rows.map((row) => {
    const members = row.table_hold_members ?? [];
    const tableIds = members
      .map((member) => member.table_id)
      .filter((value): value is string => typeof value === "string");
    return {
      id: row.id,
      bookingId: row.booking_id,
      restaurantId: row.restaurant_id,
      zoneId: row.zone_id,
      startAt: row.start_at,
      endAt: row.end_at,
      expiresAt: row.expires_at,
      tableIds,
      createdBy: row.created_by ?? null,
      metadata: row.metadata ?? null,
    } satisfies TableHold;
  });
}

async function loadActiveHoldsForDate(
  restaurantId: string,
  bookingDate: string | null,
  policy: VenuePolicy,
  client: DbClient,
): Promise<TableHold[]> {
  if (!bookingDate) {
    return [];
  }

  const day = DateTime.fromISO(bookingDate, { zone: policy.timezone ?? "UTC" });
  if (!day.isValid) {
    return [];
  }

  const dayStart = toIsoUtc(day.startOf("day"));
  const dayEnd = toIsoUtc(day.plus({ days: 1 }).startOf("day"));
  const now = toIsoUtc(DateTime.now());

  const { data, error } = await client
    .from("table_holds")
    .select("*, table_hold_members(table_id)")
    .eq("restaurant_id", restaurantId)
    .gt("expires_at", now)
    .lt("start_at", dayEnd)
    .gt("end_at", dayStart);

  if (error || !data) {
    throw error ?? new Error("Failed to load holds");
  }

  const rows = data as TableHoldRow[];

  return rows.map((row) => {
    const members = row.table_hold_members ?? [];
    const tableIds = members
      .map((member) => member.table_id)
      .filter((value): value is string => typeof value === "string");
    return {
      id: row.id,
      bookingId: row.booking_id,
      restaurantId: row.restaurant_id,
      zoneId: row.zone_id,
      startAt: row.start_at,
      endAt: row.end_at,
      expiresAt: row.expires_at,
      tableIds,
      createdBy: row.created_by ?? null,
      metadata: row.metadata ?? null,
    } satisfies TableHold;
  });
}

type RawAssignmentRecord = {
  tableId: string;
  startAt?: string | null;
  endAt?: string | null;
  mergeGroupId?: string | null;
};

type AssignmentSyncParams = {
  supabase: DbClient;
  booking: BookingRow;
  tableIds: string[];
  idempotencyKey: string | null;
  assignments: RawAssignmentRecord[];
  startIso: string;
  endIso: string;
  actorId?: string | null;
  mergeGroupId?: string | null;
  holdContext?: {
    holdId: string;
    zoneId?: string | null;
  };
};

function serializeDetails(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "string") {
    return value;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

async function synchronizeAssignments(params: AssignmentSyncParams): Promise<TableAssignmentMember[]> {
  const { supabase, booking, tableIds, idempotencyKey, assignments, startIso, endIso, actorId, mergeGroupId, holdContext } = params;
  const uniqueTableIds = Array.from(new Set(tableIds));
  const assignmentRows = await loadTableAssignmentsForTables(booking.id, uniqueTableIds, supabase);
  const windowRange = `[${startIso},${endIso})`;

  const needsUpdate = assignments.some((assignment) => {
    const normalizedStart = normalizeIsoString(assignment.startAt ?? null);
    const normalizedEnd = normalizeIsoString(assignment.endAt ?? null);
    return normalizedStart !== startIso || normalizedEnd !== endIso;
  });

  if (needsUpdate) {
    try {
      await supabase
        .from("booking_table_assignments")
        .update({ start_at: startIso, end_at: endIso })
        .eq("booking_id", booking.id)
        .in("table_id", uniqueTableIds);
    } catch {
      // Ignore in mocked environments.
    }

    try {
      await supabase
        .from("allocations")
        .update({ window: windowRange })
        .eq("booking_id", booking.id)
        .eq("resource_type", TABLE_RESOURCE_TYPE)
        .in("resource_id", uniqueTableIds);
    } catch {
      // Ignore missing allocation support in mocked environments.
    }

  if (idempotencyKey) {
      try {
        await supabase
          .from("booking_assignment_idempotency")
          .update({
            assignment_window: windowRange,
            merge_group_allocation_id: mergeGroupId ?? null,
            payload_checksum: computePayloadChecksum({
              bookingId: booking.id,
              tableIds: uniqueTableIds,
              startAt: startIso,
              endAt: endIso,
              actorId,
              holdId: holdContext?.holdId ?? null,
            }) as unknown as string,
          } as Record<string, unknown>)
          .eq("booking_id", booking.id)
          .eq("idempotency_key", idempotencyKey);
      } catch {
        // Ignore ledger updates in mocked environments.
      }
    }
  }

  const assignmentLookup = new Map<string, RawAssignmentRecord>();
  for (const assignment of assignments) {
    assignmentLookup.set(assignment.tableId, assignment);
  }

  const tableRowLookup = new Map(assignmentRows.map((row) => [row.table_id, row]));

  const result: TableAssignmentMember[] = uniqueTableIds.map((tableId) => {
    const row = tableRowLookup.get(tableId);
    const assignment = assignmentLookup.get(tableId);
    return {
      tableId,
      assignmentId: row?.id ?? randomUUID(),
      startAt: startIso,
      endAt: endIso,
      mergeGroupId: assignment?.mergeGroupId ?? mergeGroupId ?? null,
    };
  });

  if (holdContext) {
    const zoneId = holdContext.zoneId ?? "";
    const telemetryMetadata = holdContext.zoneId ? undefined : { unknownZone: true };
    try {
      const { enqueueOutboxEvent } = await import("@/server/outbox");
      await enqueueOutboxEvent({
        eventType: "capacity.hold.confirmed",
        restaurantId: booking.restaurant_id,
        bookingId: booking.id,
        idempotencyKey: idempotencyKey ?? null,
        dedupeKey: `${booking.id}:${holdContext.holdId}:hold.confirmed`,
        payload: {
          holdId: holdContext.holdId,
          bookingId: booking.id,
          restaurantId: booking.restaurant_id,
          zoneId,
          tableIds: result.map((assignment) => assignment.tableId),
          startAt: startIso,
          endAt: endIso,
          expiresAt: endIso,
          actorId: actorId ?? null,
          metadata: telemetryMetadata ?? null,
        },
      });
    } catch (e) {
      console.warn("[capacity.outbox] enqueue hold.confirmed failed", { bookingId: booking.id, error: e });
    }
  }

  // Enqueue assignment sync observability event (post-commit)
  try {
    const { enqueueOutboxEvent } = await import("@/server/outbox");
    await enqueueOutboxEvent({
      eventType: "capacity.assignment.sync",
      restaurantId: booking.restaurant_id,
      bookingId: booking.id,
      idempotencyKey: idempotencyKey ?? null,
      dedupeKey: `${booking.id}:${startIso}:${endIso}:${result.map(r=>r.tableId).join(',')}`,
      payload: {
        bookingId: booking.id,
        restaurantId: booking.restaurant_id,
        tableIds: result.map((assignment) => assignment.tableId),
        startAt: startIso,
        endAt: endIso,
        mergeGroupId: mergeGroupId ?? null,
        idempotencyKey: idempotencyKey ?? null,
      },
    });
  } catch (e) {
    console.warn("[capacity.outbox] enqueue assignment.sync failed", { bookingId: booking.id, error: e });
  }

  return result;
}

export async function confirmHoldAssignment(options: {
  holdId: string;
  bookingId: string;
  idempotencyKey: string;
  requireAdjacency?: boolean;
  assignedBy?: string | null;
  client?: DbClient;
}): Promise<TableAssignmentMember[]> {
  if (!isAllocatorV2Enabled()) {
    throw new AssignTablesRpcError({
      message: "Allocator v2 must be enabled to confirm holds",
      code: "ALLOCATOR_V2_DISABLED",
      details: null,
      hint: "Enable allocator.v2.enabled to use confirmHoldAssignment",
    });
  }

  const { holdId, bookingId, requireAdjacency: requireAdjacencyOverride, assignedBy = null, client } = options;
  const supabase = ensureClient(client);

  const {
    data: holdRow,
    error: holdError,
  } = await supabase
    .from("table_holds")
    .select("restaurant_id, zone_id, booking_id, metadata, table_hold_members(table_id)")
    .eq("id", holdId)
    .maybeSingle();

  if (holdError) {
    throw new HoldNotFoundError(holdError.message ?? "Failed to load table hold");
  }

  if (!holdRow) {
    throw new HoldNotFoundError();
  }

  const tableIds = Array.isArray(holdRow.table_hold_members)
    ? (holdRow.table_hold_members as Array<{ table_id: string }>).map((member) => member.table_id)
    : [];

  const holdBookingId = (holdRow as { booking_id?: string | null }).booking_id ?? null;
  if (holdBookingId && holdBookingId !== bookingId) {
    await emitRpcConflict({
      source: "confirm_hold_booking_mismatch",
      bookingId,
      restaurantId: holdRow.restaurant_id,
      tableIds,
      holdId,
      error: {
        code: "HOLD_BOOKING_MISMATCH",
        message: "Hold is already linked to a different booking",
        details: serializeDetails({ holdBookingId }),
        hint: null,
      },
    });

    throw new AssignTablesRpcError({
      message: "Hold is already linked to a different booking",
      code: "HOLD_BOOKING_MISMATCH",
      details: serializeDetails({ holdBookingId }),
      hint: null,
    });
  }

  if (tableIds.length === 0) {
    throw new AssignTablesRpcError({
      message: "Hold has no tables",
      code: "HOLD_EMPTY",
      details: null,
      hint: null,
    });
  }

  const booking = await loadBooking(bookingId, supabase);
  const restaurantTimezone =
    (booking.restaurants && !Array.isArray(booking.restaurants) ? booking.restaurants.timezone : null) ??
    (await loadRestaurantTimezone(booking.restaurant_id, supabase)) ??
    getVenuePolicy().timezone;
  const policy = getVenuePolicy({ timezone: restaurantTimezone ?? undefined });
  const policyVersion = hashPolicyVersion(policy);
  const holdPolicyVersion = (holdRow as { metadata?: { policyVersion?: string } })?.metadata?.policyVersion ?? null;
  if (holdPolicyVersion && holdPolicyVersion !== policyVersion) {
    throw new AssignTablesRpcError({
      message: "Policy has changed since hold was created",
      code: "POLICY_CHANGED",
      details: serializeDetails({ expected: holdPolicyVersion, actual: policyVersion }),
      hint: "Refresh and revalidate selection before confirming.",
    });
  }
  const { window } = computeBookingWindowWithFallback({
    startISO: booking.start_at,
    bookingDate: booking.booking_date,
    startTime: booking.start_time,
    partySize: booking.party_size,
    policy,
  });
  const requireAdjacency = resolveRequireAdjacency(booking.party_size, requireAdjacencyOverride);

  const startIso = toIsoUtc(window.block.start);
  const endIso = toIsoUtc(window.block.end);
  const normalizedTableIds = normalizeTableIds(tableIds);
  // Verify adjacency/zone snapshot freeze
  const selectionSnapshot = ((holdRow as { 
    metadata?: { 
      selection?: { 
        snapshot?: {
          zoneIds?: string[];
          adjacency?: { undirected?: boolean; edges?: string[]; hash?: string };
        } 
      } 
    } 
  })?.metadata?.selection?.snapshot ?? null);
  if (selectionSnapshot) {
    const currentTables = await loadTablesByIds(booking.restaurant_id, normalizedTableIds, supabase);
    const currentZoneIds = Array.from(new Set(currentTables.map((t) => t.zoneId))).filter(Boolean) as string[];
    const zonesMatch = JSON.stringify([...currentZoneIds].sort()) === JSON.stringify([...(selectionSnapshot.zoneIds ?? [])].sort());

    const currentAdjacency = await loadAdjacency(booking.restaurant_id, normalizedTableIds, supabase);
    const undirected = Boolean(selectionSnapshot.adjacency?.undirected);
    const edgeSet = new Set<string>();
    for (const a of normalizedTableIds) {
      const neighbors = currentAdjacency.get(a);
      if (!neighbors) continue;
      for (const b of neighbors) {
        if (!normalizedTableIds.includes(b)) continue;
        const key = undirected ? ([a, b].sort((x, y) => x.localeCompare(y)) as [string, string]).join("->") : `${a}->${b}`;
        edgeSet.add(key);
      }
    }
    const nowEdges = Array.from(edgeSet).sort();
    const nowHash = computePayloadChecksum({ undirected, edges: nowEdges });
    const edgesMatch =
      nowHash === selectionSnapshot.adjacency?.hash &&
      JSON.stringify(nowEdges) === JSON.stringify([...(selectionSnapshot.adjacency?.edges ?? [])].sort());

    if (!zonesMatch || !edgesMatch) {
      throw new AssignTablesRpcError({
        message: !zonesMatch
          ? "Zone assignment changed since hold was created"
          : "Adjacency definition changed since hold was created",
        code: "POLICY_CHANGED",
        details: serializeDetails({
          zones: { expected: selectionSnapshot.zoneIds ?? [], actual: currentZoneIds },
          adjacency: {
            undirected,
            expectedHash: selectionSnapshot.adjacency?.hash ?? null,
            actualHash: nowHash,
            expectedEdges: selectionSnapshot.adjacency?.edges ?? [],
            actualEdges: nowEdges,
          },
        }),
        hint: "Refresh and revalidate selection before confirming.",
      });
    }
  }
  const planSignature = createPlanSignature({
    bookingId,
    tableIds: normalizedTableIds,
    startAt: startIso,
    endAt: endIso,
  });
  const deterministicKey = createDeterministicIdempotencyKey({
    tenantId: booking.restaurant_id,
    bookingId,
    tableIds: normalizedTableIds,
    startAt: startIso,
    endAt: endIso,
    policyVersion,
  });
  // Optional: pre-check for mismatched payloads for same key (legacy-compatible)
  try {
    const { data: existing } = await supabase
      .from("booking_assignment_idempotency")
      .select("idempotency_key, booking_id, table_ids, assignment_window")
      .eq("booking_id", bookingId)
      .eq("idempotency_key", deterministicKey)
      .maybeSingle();
    if (existing && typeof existing === "object") {
      const existingTyped = existing as { table_ids?: unknown };
      const sameTables = Array.isArray(existingTyped.table_ids)
        ? normalizeTableIds(existingTyped.table_ids as string[]).join(",") === normalizedTableIds.join(",")
        : true;
      if (!sameTables) {
        throw new AssignTablesRpcError({
          message: "Idempotency mismatch for the same key",
          code: "RPC_VALIDATION",
          details: serializeDetails({ reason: "IDEMPOTENCY_MISMATCH" }),
          hint: "Retry using the same payload as the original request.",
        });
      }
    }
  } catch {
    // ignore lookup errors
  }

  const orchestrator = new AssignmentOrchestrator(new SupabaseAssignmentRepository(supabase));
  let response;
  try {
    response = await orchestrator.commitPlan(
      {
        bookingId,
        restaurantId: booking.restaurant_id,
        partySize: booking.party_size,
        zoneId: holdRow.zone_id,
        serviceDate: booking.booking_date ?? null,
        window: {
          startAt: startIso,
          endAt: endIso,
        },
        holdId,
      },
      {
        signature: planSignature,
        tableIds: normalizedTableIds,
        startAt: startIso,
        endAt: endIso,
        metadata: {
          holdId,
        },
      },
      {
        source: "manual",
        idempotencyKey: deterministicKey,
        actorId: assignedBy,
        metadata: {
          requireAdjacency,
          holdId,
        },
        requireAdjacency,
      },
    );
  } catch (error) {
    if (error instanceof AssignmentConflictError) {
      throw new AssignTablesRpcError({
        message: error.message,
        code: "ASSIGNMENT_CONFLICT",
        details: serializeDetails(error.details),
        hint: error.details?.hint ?? null,
      });
    }

    if (error instanceof AssignmentValidationError) {
      throw new AssignTablesRpcError({
        message: error.message,
        code: "ASSIGNMENT_VALIDATION",
        details: serializeDetails(error.details),
        hint: null,
      });
    }

    if (error instanceof AssignmentRepositoryError) {
      throw new AssignTablesRpcError({
        message: error.message,
        code: "ASSIGNMENT_REPOSITORY_ERROR",
        details: serializeDetails(error.cause ?? null),
        hint: null,
      });
    }

    throw error;
  }

  try {
    await releaseHoldWithRetry({ holdId, client: supabase });
  } catch (e) {
    console.warn("[capacity.confirm] failed to release hold after confirm; will rely on sweeper", {
      holdId,
      bookingId,
      error: e instanceof Error ? e.message : String(e),
    });
  }

  return synchronizeAssignments({
    supabase,
    booking,
    tableIds: normalizedTableIds,
    idempotencyKey: deterministicKey,
    assignments: response.assignments.map((assignment) => ({
      tableId: assignment.tableId,
      startAt: assignment.startAt,
      endAt: assignment.endAt,
      mergeGroupId: assignment.mergeGroupId ?? response.mergeGroupId ?? null,
    })),
    startIso,
    endIso,
    actorId: assignedBy,
    mergeGroupId: response.mergeGroupId ?? null,
    holdContext: {
      holdId,
      zoneId: holdRow.zone_id ?? null,
    },
  });
}

export async function assignTableToBooking(
  bookingId: string,
  tableIdOrIds: string | string[],
  assignedBy: string | null,
  client?: DbClient,
  options?: { idempotencyKey?: string | null; requireAdjacency?: boolean; booking?: BookingRow },
): Promise<string> {
  if (!isAllocatorV2Enabled()) {
    throw new AssignTablesRpcError({
      message: "Allocator v2 must be enabled to assign tables",
      code: "ALLOCATOR_V2_DISABLED",
      details: null,
      hint: "Enable allocator.v2.enabled to call assignTableToBooking",
    });
  }

  const supabase = ensureClient(client);
  const tableIds = Array.isArray(tableIdOrIds) ? tableIdOrIds : [tableIdOrIds];
  if (tableIds.length === 0) {
    throw new ManualSelectionInputError("Must provide at least one table id", "TABLES_REQUIRED");
  }

  const booking = options?.booking ?? (await loadBooking(bookingId, supabase));
  const restaurantTimezone =
    (booking.restaurants && !Array.isArray(booking.restaurants) ? booking.restaurants.timezone : null) ??
    (await loadRestaurantTimezone(booking.restaurant_id, supabase)) ??
    getVenuePolicy().timezone;
  const policy = getVenuePolicy({ timezone: restaurantTimezone ?? undefined });
  const { window } = computeBookingWindowWithFallback({
    startISO: booking.start_at,
    bookingDate: booking.booking_date,
    startTime: booking.start_time,
    partySize: booking.party_size,
    policy,
  });
  const startIso = toIsoUtc(window.block.start);
  const endIso = toIsoUtc(window.block.end);
  const normalizedTableIds = normalizeTableIds(tableIds);
  const planSignature = createPlanSignature({
    bookingId,
    tableIds: normalizedTableIds,
    startAt: startIso,
    endAt: endIso,
    salt: options?.idempotencyKey ?? undefined,
  });
  const policyVersion = hashPolicyVersion(policy);
  const deterministicKey = createDeterministicIdempotencyKey({
    tenantId: booking.restaurant_id,
    bookingId,
    tableIds: normalizedTableIds,
    startAt: startIso,
    endAt: endIso,
    policyVersion,
  });
  const idempotencyKey = options?.idempotencyKey ?? deterministicKey;
  const requireAdjacency = options?.requireAdjacency ?? false;

  const orchestrator = new AssignmentOrchestrator(new SupabaseAssignmentRepository(supabase));
  let response;
  try {
    response = await orchestrator.commitPlan(
      {
        bookingId,
        restaurantId: booking.restaurant_id,
        partySize: booking.party_size,
        serviceDate: booking.booking_date ?? null,
        window: {
          startAt: startIso,
          endAt: endIso,
        },
      },
      {
        signature: planSignature,
        tableIds: normalizedTableIds,
        startAt: startIso,
        endAt: endIso,
        metadata: {
          requestSource: "assignTableToBooking",
        },
      },
      {
        source: "manual",
        idempotencyKey,
        actorId: assignedBy,
        metadata: {
          requireAdjacency,
        },
        requireAdjacency,
      },
    );
  } catch (error) {
    if (error instanceof AssignmentConflictError) {
      throw new AssignTablesRpcError({
        message: error.message,
        code: "ASSIGNMENT_CONFLICT",
        details: serializeDetails(error.details),
        hint: error.details?.hint ?? null,
      });
    }

    if (error instanceof AssignmentValidationError) {
      throw new AssignTablesRpcError({
        message: error.message,
        code: "ASSIGNMENT_VALIDATION",
        details: serializeDetails(error.details),
        hint: null,
      });
    }

    if (error instanceof AssignmentRepositoryError) {
      throw new AssignTablesRpcError({
        message: error.message,
        code: "ASSIGNMENT_REPOSITORY_ERROR",
        details: serializeDetails(error.cause ?? null),
        hint: null,
      });
    }

    throw error;
  }

  const synchronized = await synchronizeAssignments({
    supabase,
    booking,
    tableIds: normalizedTableIds,
    idempotencyKey,
    assignments: response.assignments.map((assignment) => ({
      tableId: assignment.tableId,
      startAt: assignment.startAt,
      endAt: assignment.endAt,
      mergeGroupId: assignment.mergeGroupId ?? response.mergeGroupId ?? null,
    })),
    startIso,
    endIso,
    actorId: assignedBy,
    mergeGroupId: response.mergeGroupId ?? null,
  });

  const firstAssignment = synchronized[0];
  if (!firstAssignment) {
    throw new AssignTablesRpcError({
      message: "Assignment failed with no records returned",
      code: "ASSIGNMENT_EMPTY",
      details: null,
      hint: null,
    });
  }

  // Enqueue assignment sync observability event (post-commit)
  try {
    const { enqueueOutboxEvent } = await import("@/server/outbox");
    await enqueueOutboxEvent({
      eventType: "capacity.assignment.sync",
      restaurantId: booking.restaurant_id,
      bookingId: booking.id,
      idempotencyKey,
      dedupeKey: `${booking.id}:${startIso}:${endIso}:${normalizedTableIds.join(',')}`,
      payload: {
        bookingId: booking.id,
        restaurantId: booking.restaurant_id,
        tableIds: normalizedTableIds,
        startAt: startIso,
        endAt: endIso,
        mergeGroupId: response.mergeGroupId ?? null,
        idempotencyKey,
      },
    });
  } catch (e) {
    console.warn("[capacity.outbox] enqueue assignment.sync failed", { bookingId: booking.id, error: e });
  }

  return firstAssignment.assignmentId;
}

export async function unassignTableFromBooking(
  bookingId: string,
  tableId: string,
  client?: DbClient,
): Promise<boolean> {
  const supabase = ensureClient(client);
  const { data, error } = await supabase.rpc("unassign_tables_atomic", {
    p_booking_id: bookingId,
    p_table_ids: [tableId],
  });
  if (error) {
    return false;
  }
  return Array.isArray(data) && data.length > 0;
}

export async function getBookingTableAssignments(
  bookingId: string,
  client?: DbClient,
): Promise<TableAssignmentMember[]> {
  const supabase = ensureClient(client);
  const { data, error } = await supabase
    .from("booking_table_assignments")
    .select("table_id, id, assigned_at")
    .eq("booking_id", bookingId);

  if (error || !data) {
    return [];
  }

  return data.map((row) => ({
    tableId: row.table_id,
    assignmentId: row.id,
    startAt: row.assigned_at ?? "",
    endAt: row.assigned_at ?? "",
    mergeGroupId: null,
  }));
}

export async function quoteTablesForBooking(options: QuoteTablesOptions): Promise<QuoteTablesResult> {
  const {
    bookingId,
    zoneId,
    maxTables,
    requireAdjacency: requireAdjacencyOverride,
    avoidTables = [],
    holdTtlSeconds = DEFAULT_HOLD_TTL_SECONDS,
    createdBy,
    client,
  } = options;

  const operationStart = highResNow();
  const supabase = ensureClient(client);
  const booking = await loadBooking(bookingId, supabase);
  const restaurantTimezone =
    (booking.restaurants && !Array.isArray(booking.restaurants) ? booking.restaurants.timezone : null) ??
    (await loadRestaurantTimezone(booking.restaurant_id, supabase)) ??
    getVenuePolicy().timezone;
  const policy = getVenuePolicy({ timezone: restaurantTimezone ?? undefined });
  const {
    window,
    usedFallback: bookingWindowUsedFallback,
    fallbackService: bookingWindowFallbackService,
  } = computeBookingWindowWithFallback({
    startISO: booking.start_at,
    bookingDate: booking.booking_date,
    startTime: booking.start_time,
    partySize: booking.party_size,
    policy,
  });

  const tables = await loadTablesForRestaurant(booking.restaurant_id, supabase);
  const adjacency = await loadAdjacency(
    booking.restaurant_id,
    tables.map((table) => table.id),
    supabase,
  );
  const requireAdjacency = resolveRequireAdjacency(booking.party_size, requireAdjacencyOverride);
  const timePruningEnabled = isPlannerTimePruningEnabled();
  const lookaheadEnabled = isSelectorLookaheadEnabled();
  let timePruningStats: TimeFilterStats | null = null;
  let busyForPlanner: AvailabilityMap | undefined;
  let contextBookings: ContextBookingRow[] = [];
  let holdsForDay: TableHold[] = [];

  if (timePruningEnabled || lookaheadEnabled) {
    contextBookings = await loadContextBookings(
      booking.restaurant_id,
      booking.booking_date ?? null,
      supabase,
      {
        startIso: toIsoUtc(window.block.start),
        endIso: toIsoUtc(window.block.end),
      },
    );
    if (isHoldsEnabled()) {
      try {
        holdsForDay = await loadActiveHoldsForDate(booking.restaurant_id, booking.booking_date ?? null, policy, supabase);
      } catch (error: unknown) {
        const code = extractErrorCode(error);
        if (code === "42P01") {
          console.warn("[capacity.quote] holds table unavailable; skipping hold hydration", {
            restaurantId: booking.restaurant_id,
          });
        } else {
          console.warn("[capacity.quote] failed to load active holds", {
            restaurantId: booking.restaurant_id,
            error,
          });
        }
        holdsForDay = [];
      }
    }
  }

  if (timePruningEnabled) {
    busyForPlanner = buildBusyMaps({
      targetBookingId: booking.id,
      bookings: contextBookings,
      holds: holdsForDay,
      policy,
      targetWindow: window,
    });
  }

  const filtered = filterAvailableTables(
    tables,
    booking.party_size,
    window,
    adjacency,
    new Set(avoidTables),
    zoneId ?? null,
    {
      allowInsufficientCapacity: true,
      timeFilter:
        busyForPlanner && timePruningEnabled
          ? {
              busy: busyForPlanner,
              mode: "strict",
              captureStats: (stats) => {
                timePruningStats = stats;
              },
            }
          : undefined,
    },
  );

  const strategicOptions = { restaurantId: booking.restaurant_id ?? null } as const;
  await loadStrategicConfig({ ...strategicOptions, client: supabase });
  const baseScoringConfig = getSelectorScoringConfig(strategicOptions);
  const selectorLimits = getSelectorPlannerLimits();
  const combinationEnabled = isCombinationPlannerEnabled();
  const combinationLimit = maxTables ?? getAllocatorCombinationLimit();
  const demandMultiplierResult = await resolveDemandMultiplier({
    restaurantId: booking.restaurant_id,
    serviceStart: window.block.start,
    serviceKey: window.service,
    timezone: policy.timezone,
    client: supabase,
  });
  const demandMultiplier = demandMultiplierResult?.multiplier ?? 1;
  const demandRule = demandMultiplierResult?.rule;
  const tableScarcityScores = await loadTableScarcityScores({
    restaurantId: booking.restaurant_id,
    tables: filtered,
    client: supabase,
  });
  const scoringConfig: SelectorScoringConfig = {
    ...baseScoringConfig,
    weights: {
      ...baseScoringConfig.weights,
      scarcity: getYieldManagementScarcityWeight(strategicOptions),
    },
  };
  const plannerStart = highResNow();
  const plans = buildScoredTablePlans({
    tables: filtered,
    partySize: booking.party_size,
    adjacency,
    config: scoringConfig,
    enableCombinations: combinationEnabled,
    kMax: combinationLimit,
    maxPlansPerSlack: selectorLimits.maxPlansPerSlack,
    maxCombinationEvaluations: selectorLimits.maxCombinationEvaluations,
    enumerationTimeoutMs: selectorLimits.enumerationTimeoutMs,
    requireAdjacency,
    demandMultiplier,
    tableScarcityScores,
  });
  // const topRankedPlan = plans.plans[0] ?? null;
  const lookaheadConfig: LookaheadConfig = {
    enabled: lookaheadEnabled,
    windowMinutes: getSelectorLookaheadWindowMinutes(),
    penaltyWeight: getSelectorLookaheadPenaltyWeight(),
    blockThreshold: getSelectorLookaheadBlockThreshold(),
  };
  const lookaheadDiagnostics = evaluateLookahead({
    lookahead: lookaheadConfig,
    bookingId: booking.id,
    bookingWindow: window,
    plansResult: plans,
    tables,
    adjacency,
    zoneId: zoneId ?? null,
    policy,
    contextBookings,
    holds: holdsForDay,
    combinationEnabled,
    combinationLimit,
    selectorLimits,
    scoringConfig,
  });
  plans.diagnostics.lookahead = lookaheadDiagnostics;
  const plannerDurationMs = highResNow() - plannerStart;
  const adjacencyRequiredGlobally = adjacency.size > 0 && isAllocatorAdjacencyRequired();
  const adjacencyMinPartySize = getAllocatorAdjacencyMinPartySize();
  const featureFlags = buildSelectorFeatureFlagsTelemetry();
  const plannerConfigTelemetry = composePlannerConfig({
    diagnostics: plans.diagnostics,
    scoringConfig,
    combinationEnabled,
    requireAdjacency,
    adjacencyRequiredGlobally,
    adjacencyMinPartySize: adjacencyMinPartySize ?? null,
    featureFlags,
    serviceFallback: {
      usedFallback: bookingWindowUsedFallback,
      fallbackService: bookingWindowFallbackService,
    },
    demandMultiplier,
    demandRule,
    lookahead: lookaheadConfig,
  });
  if (!timePruningStats) {
    timePruningStats = {
      prunedByTime: 0,
      candidatesAfterTimePrune: filtered.length,
      pruned_by_time: 0,
      candidates_after_time_prune: filtered.length,
    };
  }
  plans.diagnostics.timePruning = {
    prunedByTime: timePruningStats.prunedByTime,
    candidatesAfterTimePrune: timePruningStats.candidatesAfterTimePrune,
    pruned_by_time: timePruningStats.pruned_by_time,
    candidates_after_time_prune: timePruningStats.candidates_after_time_prune,
  };

  const alternates: CandidateSummary[] = [];
  const skippedCandidates: Array<{ candidate: CandidateSummary; reason: string; conflicts: HoldConflictInfo[] }> = [];
  const holdConflictHoldIds = new Set<string>();
  let holdConflictSkipCount = 0;

  const applyQuoteSkipDiagnostics = () => {
    plans.diagnostics.quoteSkips = {
      holdConflicts: {
        count: holdConflictSkipCount,
        holdIds: Array.from(holdConflictHoldIds),
      },
    };
  };

  const recordHoldConflictSkip = (conflicts: HoldConflictInfo[], candidate: CandidateSummary, plan: RankedTablePlan) => {
    holdConflictSkipCount += 1;
    for (const conflict of conflicts) {
      if (conflict.holdId) {
        holdConflictHoldIds.add(conflict.holdId);
      }
    }
    skippedCandidates.push({
      candidate,
      reason: formatHoldConflictReason(conflicts, plan),
      conflicts,
    });
  };

  for (let index = 0; index < plans.plans.length; index += 1) {
    const plan = plans.plans[index]!;
    const candidateSummary = summarizeCandidate({
      tableIds: plan.tables.map((table) => table.id),
      tableNumbers: plan.tables.map((table) => table.tableNumber),
      totalCapacity: plan.totalCapacity,
      tableCount: plan.tables.length,
      slack: plan.slack,
      score: plan.score,
      adjacencyStatus: plan.adjacencyStatus,
      scoreBreakdown: plan.scoreBreakdown,
    });

    const conflicts = await findHoldConflicts({
      restaurantId: booking.restaurant_id,
      tableIds: plan.tables.map((table) => table.id),
      startAt: toIsoUtc(window.block.start),
      endAt: toIsoUtc(window.block.end),
      client: supabase,
    });

    if (conflicts.length > 0) {
      recordHoldConflictSkip(conflicts, candidateSummary, plan);
      continue;
    }

    if (index > 0) {
      alternates.push(candidateSummary);
    }

    try {
      const summary = summarizeSelection(plan.tables, booking.party_size);
      const zoneForHold = summary.zoneId ?? plan.tables[0]?.zoneId;
      if (!zoneForHold) {
        continue;
      }

      const holdStart = highResNow();
      const hold = await createTableHold({
        bookingId,
        restaurantId: booking.restaurant_id,
        zoneId: zoneForHold,
        tableIds: plan.tables.map((table) => table.id),
        startAt: toIsoUtc(window.block.start),
        endAt: toIsoUtc(window.block.end),
        expiresAt: toIsoUtc(DateTime.now().plus({ seconds: holdTtlSeconds })),
        createdBy,
        metadata: {
          selection: {
            tableIds: plan.tables.map((table) => table.id),
            summary,
          },
        },
        client: supabase,
      });
      const holdDurationMs = highResNow() - holdStart;
      const totalDurationMs = highResNow() - operationStart;

      applyQuoteSkipDiagnostics();
      await emitSelectorQuote({
        restaurantId: booking.restaurant_id,
        bookingId,
        partySize: booking.party_size,
        window: {
          start: toIsoUtc(window.block.start),
          end: toIsoUtc(window.block.end),
        },
        candidates: [candidateSummary, ...alternates],
        selected: candidateSummary,
        durationMs: roundMilliseconds(totalDurationMs),
        featureFlags,
        timing: buildTiming({
          totalMs: totalDurationMs,
          plannerMs: plannerDurationMs,
          holdMs: holdDurationMs,
        }),
        plannerConfig: plannerConfigTelemetry,
        diagnostics: plans.diagnostics,
        holdId: hold.id,
        expiresAt: hold.expiresAt,
      });

      return {
        hold,
        candidate: candidateSummary,
        alternates,
        nextTimes: [],
        skipped: skippedCandidates,
        metadata: {
          usedFallback: bookingWindowUsedFallback,
          fallbackService: bookingWindowFallbackService,
        },
      };
    } catch (error) {
      if (error instanceof HoldConflictError) {
        const refreshedConflicts = await findHoldConflicts({
          restaurantId: booking.restaurant_id,
          tableIds: plan.tables.map((table) => table.id),
          startAt: toIsoUtc(window.block.start),
          endAt: toIsoUtc(window.block.end),
          client: supabase,
        });

        recordHoldConflictSkip(refreshedConflicts, candidateSummary, plan);
        await emitRpcConflict({
          source: "create_hold_conflict",
          bookingId,
          restaurantId: booking.restaurant_id,
          tableIds: plan.tables.map((table) => table.id),
          holdId: error.holdId ?? null,
          error: {
            code: null,
            message: error.message,
            details: JSON.stringify(refreshedConflicts),
            hint: null,
          },
        });

        applyQuoteSkipDiagnostics();
        continue;
      }
      throw error;
    }
  }
  applyQuoteSkipDiagnostics();

  return {
    hold: null,
    candidate: null,
    alternates,
    nextTimes: [],
    reason: plans.fallbackReason ?? "No suitable tables available",
    skipped: skippedCandidates,
    metadata: {
      usedFallback: bookingWindowUsedFallback,
      fallbackService: bookingWindowFallbackService,
    },
  };
}

export async function findSuitableTables(options: {
  bookingId: string;
  client?: DbClient;
}): Promise<RankedTablePlan[]> {
  const { bookingId, client } = options;
  const supabase = ensureClient(client);
  const booking = await loadBooking(bookingId, supabase);
  const tables = await loadTablesForRestaurant(booking.restaurant_id, supabase);
  const adjacency = await loadAdjacency(
    booking.restaurant_id,
    tables.map((table) => table.id),
    supabase,
  );
  const defaultPolicy = getVenuePolicy();
  const restaurantTimezone =
    (booking.restaurants && !Array.isArray(booking.restaurants) ? booking.restaurants.timezone : null) ??
    (await loadRestaurantTimezone(booking.restaurant_id, supabase)) ??
    defaultPolicy.timezone;
  const policy =
    restaurantTimezone === defaultPolicy.timezone
      ? defaultPolicy
      : getVenuePolicy({ timezone: restaurantTimezone ?? undefined });
  const { window } = computeBookingWindowWithFallback({
    startISO: booking.start_at,
    bookingDate: booking.booking_date,
    startTime: booking.start_time,
    partySize: booking.party_size,
    policy,
  });

  const filtered = filterAvailableTables(
    tables,
    booking.party_size,
    window,
    adjacency,
    undefined,
    undefined,
    { allowInsufficientCapacity: true },
  );
  const strategicOptions = { restaurantId: booking.restaurant_id ?? null } as const;
  await loadStrategicConfig({ ...strategicOptions, client: supabase });
  const baseScoringConfig = getSelectorScoringConfig(strategicOptions);
  const requireAdjacency = partiesRequireAdjacency(booking.party_size);
  const selectorLimits = getSelectorPlannerLimits();
  const demandMultiplierResult = await resolveDemandMultiplier({
    restaurantId: booking.restaurant_id,
    serviceStart: window.block.start,
    serviceKey: window.service,
    timezone: policy.timezone,
    client: supabase,
  });
  const demandMultiplier = demandMultiplierResult?.multiplier ?? 1;
  const tableScarcityScores = await loadTableScarcityScores({
    restaurantId: booking.restaurant_id,
    tables: filtered,
    client: supabase,
  });
  const scoringConfig: SelectorScoringConfig = {
    ...baseScoringConfig,
    weights: {
      ...baseScoringConfig.weights,
      scarcity: getYieldManagementScarcityWeight(strategicOptions),
    },
  };
  const plans = buildScoredTablePlans({
    tables: filtered,
    partySize: booking.party_size,
    adjacency,
    config: scoringConfig,
    enableCombinations: isCombinationPlannerEnabled(),
    kMax: getAllocatorCombinationLimit(),
    maxPlansPerSlack: selectorLimits.maxPlansPerSlack,
    maxCombinationEvaluations: selectorLimits.maxCombinationEvaluations,
    enumerationTimeoutMs: selectorLimits.enumerationTimeoutMs,
    requireAdjacency,
    demandMultiplier,
    tableScarcityScores,
  });

  return plans.plans;
}

export async function isTableAvailableV2(
  tableId: string,
  startISO: string,
  partySize: number,
  options?: {
    excludeBookingId?: string;
    policy?: VenuePolicy;
    client?: DbClient;
  },
): Promise<boolean> {
  const supabase = ensureClient(options?.client);
  const policy = options?.policy ?? getVenuePolicy();
  const { window } = computeBookingWindowWithFallback({
    startISO,
    partySize,
    policy,
  });

  const startAt = toIsoUtc(window.block.start);
  const endAt = toIsoUtc(window.block.end);

  try {
    const { data, error } = await (supabase as unknown as {
      rpc: (
        fn: string,
        args: {
          p_table_id: string;
          p_start_at: string;
          p_end_at: string;
          p_exclude_booking_id: string | null;
        },
      ) => Promise<{ data: boolean | null; error: { message?: string; details?: string | null; hint?: string | null; code?: string | null } | null }>;
    }).rpc("is_table_available_v2", {
      p_table_id: tableId,
      p_start_at: startAt,
      p_end_at: endAt,
      p_exclude_booking_id: options?.excludeBookingId ?? null,
    });

    if (error) {
      const code = extractErrorCode(error);
      if (code === "42883" || code === "42P01") {
        return await legacyTableAvailabilityCheck({
          supabase,
          tableId,
          startAt,
          endAt,
          excludeBookingId: options?.excludeBookingId ?? null,
        });
      }
      throw new AssignTablesRpcError({
        message: error.message ?? "Failed to query table availability",
        code: "TABLE_AVAILABILITY_QUERY_FAILED",
        details: serializeDetails({
          code: code ?? null,
          details: error.details ?? null,
          hint: error.hint ?? null,
        }),
        hint: null,
      });
    }

    if (typeof data === "boolean") {
      return data;
    }
  } catch (error) {
    const code = extractErrorCode(error);
    if (code !== "42883" && code !== "42P01") {
      throw new AssignTablesRpcError({
        message: error instanceof Error ? error.message : "Failed to verify table availability",
        code: "TABLE_AVAILABILITY_QUERY_FAILED",
        details: error instanceof Error ? error.stack ?? null : null,
        hint: null,
      });
    }
    return await legacyTableAvailabilityCheck({
      supabase,
      tableId,
      startAt,
      endAt,
      excludeBookingId: options?.excludeBookingId ?? null,
    });
  }

  return await legacyTableAvailabilityCheck({
    supabase,
    tableId,
    startAt,
    endAt,
    excludeBookingId: options?.excludeBookingId ?? null,
  });
}

async function legacyTableAvailabilityCheck(params: {
  supabase: DbClient;
  tableId: string;
  startAt: string;
  endAt: string;
  excludeBookingId?: string | null;
}): Promise<boolean> {
  const { supabase, tableId, startAt, endAt, excludeBookingId } = params;

  const { data, error } = await supabase
    .from("booking_table_assignments")
    .select("table_id, start_at, end_at, bookings(id, status, start_at, end_at)")
    .eq("table_id", tableId);

  if (error || !data) {
    throw new AssignTablesRpcError({
      message: error?.message ?? "Failed to query table availability",
      code: "TABLE_AVAILABILITY_QUERY_FAILED",
      details: serializeDetails({
        code: (error as { code?: string })?.code ?? null,
        details: error?.details ?? null,
        hint: error?.hint ?? null,
      }),
      hint: null,
    });
  }

  const rows = data as AssignmentAvailabilityRow[];
  for (const row of rows) {
    const booking = row.bookings;
    if (excludeBookingId && booking?.id === excludeBookingId) {
      continue;
    }
    if (booking && !["pending", "confirmed", "seated"].includes(booking.status ?? "")) {
      continue;
    }
    const otherStart = row.start_at ?? booking?.start_at;
    const otherEnd = row.end_at ?? booking?.end_at;
    if (!otherStart || !otherEnd) {
      continue;
    }
    if (windowsOverlap({ start: startAt, end: endAt }, { start: otherStart, end: otherEnd })) {
      return false;
    }
  }

  return true;
}

export async function isTableAvailable(
  tableId: string,
  startISO: string,
  partySize: number,
  options?: {
    excludeBookingId?: string;
    policy?: VenuePolicy;
    client?: DbClient;
  },
): Promise<boolean> {
  try {
    return await isTableAvailableV2(tableId, startISO, partySize, options);
  } catch (error) {
    if (error instanceof AssignTablesRpcError) {
      throw new AssignTablesRpcError({
        message: "Failed to verify table availability",
        code: error.code ?? "TABLE_AVAILABILITY_QUERY_FAILED",
        details: error.details,
        hint: error.hint ?? null,
      });
    }
    throw error;
  }
}

export const __internal = {
  computeBookingWindow,
  windowsOverlap,
  filterAvailableTables,
  filterTimeAvailableTables,
  extractConflictsForTables,
};
