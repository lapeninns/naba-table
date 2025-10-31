import { DateTime } from "luxon";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";

import { BOOKING_BLOCKING_STATUSES } from "@/lib/enums";
import {
  getAllocatorAdjacencyMinPartySize,
  getAllocatorKMax as getAllocatorCombinationLimit,
  getSelectorPlannerLimits,
  isAllocatorAdjacencyRequired,
  isAllocatorMergesEnabled,
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
  type ScoreBreakdown,
} from "./selector";
import { loadStrategicConfig } from "./strategic-config";
import {
  buildSelectorDecisionPayload,
  emitHoldConfirmed,
  emitRpcConflict,
  emitSelectorDecision,
  emitSelectorQuote,
  summarizeCandidate,
  type CandidateSummary,
  type SelectorDecisionCapture,
  type SelectorDecisionEvent,
  type StrategicPenaltyTelemetry,
} from "./telemetry";
import {
  AssignmentConflictError,
  AssignmentOrchestrator,
  AssignmentRepositoryError,
  AssignmentValidationError,
  SupabaseAssignmentRepository,
  createPlanSignature,
  normalizeTableIds,
} from "./v2";

import type { Database, Tables } from "@/types/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

export type { SelectorDecisionCapture } from "./telemetry";

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

export type AutoAssignResult = {
  assigned: Array<{ bookingId: string; tableIds: string[] }>;
  skipped: Array<{ bookingId: string; reason: string }>;
  serviceFallbacks: Array<{ bookingId: string; usedFallback: boolean; fallbackService: ServiceKey | null }>;
  decisions?: SelectorDecisionCapture[];
};

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
} {
  const policy = args.policy ?? getVenuePolicy();
  const baseStart = resolveStartDateTime(args, policy);
  const service = resolveService(baseStart, args.serviceHint ?? null, policy);

  const diningMinutes = bandDuration(service, args.partySize, policy);
  const buffer = getBufferConfig(service, policy);
  const diningStart = baseStart;
  const diningEnd = diningStart.plus({ minutes: diningMinutes });
  const blockStart = diningStart.minus({ minutes: buffer.pre ?? 0 });
  const blockEnd = diningEnd.plus({ minutes: buffer.post ?? 0 });

  const serviceEndBoundary = serviceEnd(service, diningStart, policy);
  if (blockEnd > serviceEndBoundary) {
    throw new ServiceOverrunError(service, blockEnd, serviceEndBoundary);
  }

  return {
    service,
    durationMinutes: diningMinutes,
    dining: {
      start: diningStart,
      end: diningEnd,
    },
    block: {
      start: blockStart,
      end: blockEnd,
    },
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

      const baseStart = resolveStartDateTime(args, policy);
      const durationMinutes = bandDuration(fallbackService, args.partySize, policy);
      const buffer = getBufferConfig(fallbackService, policy);
      const diningStart = baseStart;
      const diningEnd = diningStart.plus({ minutes: durationMinutes });
      const blockStart = diningStart.minus({ minutes: buffer.pre ?? 0 });
      const blockEnd = diningEnd.plus({ minutes: buffer.post ?? 0 });
      const serviceEndBoundary = serviceEnd(fallbackService, diningStart, policy);
      if (blockEnd > serviceEndBoundary) {
        throw new ServiceOverrunError(fallbackService, blockEnd, serviceEndBoundary);
      }

      console.warn("[capacity][window][fallback] service not found, using fallback service", {
        start: baseStart.toISO(),
        fallbackService,
      });

      const window: BookingWindow = {
        service: fallbackService,
        durationMinutes,
        dining: {
          start: diningStart,
          end: diningEnd,
        },
        block: {
          start: blockStart,
          end: blockEnd,
        },
      };

      return {
        window,
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
  if (DateTime.isDateTime(point)) {
    const value = point.toMillis();
    return Number.isFinite(value) ? value : null;
  }

  if (typeof point === "number") {
    return Number.isFinite(point) ? point : null;
  }

  if (typeof point === "string") {
    const parsed = DateTime.fromISO(point, { setZone: true });
    if (!parsed.isValid) {
      return null;
    }
    const value = parsed.toMillis();
    return Number.isFinite(value) ? value : null;
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

const AUTO_ASSIGN_LOG_ROOT = process.env.AUTO_ASSIGN_LOG_ROOT ?? path.join(process.cwd(), "logs");
const AUTO_ASSIGN_LOG_DIR =
  process.env.AUTO_ASSIGN_LOG_DIR ?? path.join(AUTO_ASSIGN_LOG_ROOT, process.env.AUTO_ASSIGN_LOG_SUBDIR ?? "auto-assign");

const STRATEGIC_SKIP_REASON_PATTERNS = [
  /conflicts with existing/i,
  /future conflict/i,
  /lookahead/i,
  /strategic/i,
];

type ScoreBreakdownLike = ScoreBreakdown | CandidateSummary["scoreBreakdown"] | null | undefined;

function isCamelCaseBreakdown(breakdown: ScoreBreakdownLike): breakdown is ScoreBreakdown {
  return Boolean(breakdown && typeof breakdown === "object" && "slackPenalty" in breakdown);
}

function isSnakeCaseBreakdown(
  breakdown: ScoreBreakdownLike,
): breakdown is NonNullable<CandidateSummary["scoreBreakdown"]> {
  return Boolean(breakdown && typeof breakdown === "object" && "slack_penalty" in breakdown);
}

function extractStrategicPenalties(breakdown: ScoreBreakdownLike): StrategicPenaltyTelemetry | null {
  if (!breakdown) {
    return null;
  }

  let slack = 0;
  let scarcity = 0;
  let futureConflict = 0;

  if (isCamelCaseBreakdown(breakdown)) {
    slack = Number(breakdown.slackPenalty ?? 0);
    scarcity = Number(breakdown.scarcityPenalty ?? 0);
    futureConflict = Number(breakdown.futureConflictPenalty ?? 0);
  } else if (isSnakeCaseBreakdown(breakdown)) {
    slack = Number(breakdown.slack_penalty ?? 0);
    scarcity = Number(breakdown.scarcity_penalty ?? 0);
    futureConflict = Number(breakdown.future_conflict_penalty ?? 0);
  } else {
    return null;
  }

  const contributions: Array<[StrategicPenaltyTelemetry["dominant"], number]> = [
    ["slack", slack],
    ["scarcity", scarcity],
    ["future_conflict", futureConflict],
  ];

  let dominant: StrategicPenaltyTelemetry["dominant"] = "unknown";
  let maxContribution = 0;

  for (const [key, value] of contributions) {
    if (value > maxContribution) {
      maxContribution = value;
      dominant = key;
    }
  }

  if (maxContribution <= 0) {
    dominant = "unknown";
  }

  return {
    dominant,
    slack,
    scarcity,
    futureConflict,
  };
}

type RejectionTelemetry = {
  classification: "hard" | "strategic";
  penalties: StrategicPenaltyTelemetry | null;
};

function determineRejectionTelemetry(
  skipReason: string | null | undefined,
  breakdown: ScoreBreakdownLike,
): RejectionTelemetry | null {
  const reason = (skipReason ?? "").trim();
  const normalized = reason.toLowerCase();
  const penalties = extractStrategicPenalties(breakdown);
  const hasMeaningfulPenalty = Boolean(
    penalties && (penalties.slack > 0 || penalties.scarcity > 0 || penalties.futureConflict > 0),
  );
  const matchesStrategicKeyword =
    normalized.length > 0 && STRATEGIC_SKIP_REASON_PATTERNS.some((pattern) => pattern.test(normalized));

  if (hasMeaningfulPenalty || matchesStrategicKeyword) {
    return {
      classification: "strategic",
      penalties: penalties ?? null,
    };
  }

  if (!reason) {
    return null;
  }

  return {
    classification: "hard",
    penalties: null,
  };
}

async function persistDecisionSnapshots(params: {
  restaurantId: string;
  slug?: string | null;
  date: string;
  decisions: SelectorDecisionCapture[];
}): Promise<void> {
  if (params.decisions.length === 0) {
    return;
  }

  if (process.env.NODE_ENV === "test") {
    return;
  }

  try {
    const timestamp = DateTime.utc().toFormat("yyyyLLdd-HHmmss");
    const safeSlugSource = (params.slug && params.slug.trim().length > 0 ? params.slug : params.restaurantId) ?? params.restaurantId;
    const safeSlug = safeSlugSource.replace(/[^a-zA-Z0-9-_]/g, "_").toLowerCase();
    const bookingSegment = params.date.replace(/[^a-zA-Z0-9-_]/g, "_");
    const decisionSegment = `${String(params.decisions.length).padStart(2, "0")}dec`;
    const timestampDir = path.join(AUTO_ASSIGN_LOG_DIR, "log", timestamp);
    await fs.mkdir(timestampDir, { recursive: true });
    const filePath = path.join(timestampDir, `${safeSlug}-${bookingSegment}-${decisionSegment}.json`);
    const payload = {
      generatedAt: new Date().toISOString(),
      restaurantId: params.restaurantId,
      restaurantSlug: params.slug ?? null,
      date: params.date,
      decisionCount: params.decisions.length,
      decisions: params.decisions,
    };
    await fs.writeFile(filePath, JSON.stringify(payload, null, 2), "utf8");
  } catch (error) {
    console.error("[auto-assign][capture] failed to persist decisions", {
      error: error instanceof Error ? error.message : String(error),
      restaurantId: params.restaurantId,
      date: params.date,
    });
  }
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
  lookahead: Pick<LookaheadConfig, "enabled" | "windowMinutes" | "penaltyWeight">;
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

  return first.start < second.end && second.start < first.end;
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
}): {
  penalizedPlans: number;
  totalPenalty: number;
  evaluationMs: number;
  conflicts: Array<{ bookingId: string; planKey: string }>;
} {
  const { plans, bookingWindow, tables, adjacency, zoneId, futureBookings, config, combinationEnabled, combinationLimit, selectorLimits, penaltyWeight } = params;
  const start = performance.now();

  if (futureBookings.length === 0 || plans.length === 0 || penaltyWeight <= 0) {
    return { penalizedPlans: 0, totalPenalty: 0, evaluationMs: performance.now() - start, conflicts: [] };
  }

  let penalizedPlans = 0;
  let totalPenalty = 0;
  const conflicts: Array<{ bookingId: string; planKey: string }> = [];

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
  }

  const evaluationMs = performance.now() - start;
  return { penalizedPlans, totalPenalty, evaluationMs, conflicts };
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
    };
  }

  const { penalizedPlans, totalPenalty, evaluationMs, conflicts } = applyLookaheadPenalties({
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
  });

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
  const { data, error } = await client
    .from("table_inventory")
    .select<typeof TABLE_INVENTORY_SELECT, TableInventoryRow>(TABLE_INVENTORY_SELECT)
    .eq("restaurant_id", restaurantId)
    .order("table_number", { ascending: true });

  if (error || !data) {
    return [];
  }

  const rows = data as unknown as Tables<"table_inventory">[];

  return rows.map((row) => ({
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

async function loadAdjacency(tableIds: string[], client: DbClient): Promise<Map<string, Set<string>>> {
  const uniqueTableIds = Array.from(
    new Set(
      tableIds.filter((value): value is string => typeof value === "string" && value.length > 0),
    ),
  );

  if (uniqueTableIds.length === 0) {
    return new Map();
  }

  type AdjacencyRow = { table_a: string | null; table_b: string | null };
  const baseQuery = () => client.from("table_adjacencies").select("table_a, table_b");

  const [forward, reverse] = await Promise.all([
    baseQuery().in("table_a", uniqueTableIds),
    baseQuery().in("table_b", uniqueTableIds),
  ]);

  if (forward.error || reverse.error) {
    return new Map();
  }

  const forwardRows = Array.isArray(forward.data) ? (forward.data as AdjacencyRow[]) : [];
  const reverseRows = Array.isArray(reverse.data) ? (reverse.data as AdjacencyRow[]) : [];
  const rows: AdjacencyRow[] = [...forwardRows, ...reverseRows];

  if (rows.length === 0) {
    return new Map();
  }

  const map = new Map<string, Set<string>>();
  for (const row of rows) {
    const tableA = row.table_a;
    const tableB = row.table_b;
    if (!tableA || !tableB) {
      continue;
    }
    if (!map.has(tableA)) {
      map.set(tableA, new Set());
    }
    map.get(tableA)!.add(tableB);
    if (!map.has(tableB)) {
      map.set(tableB, new Set());
    }
    map.get(tableB)!.add(tableA);
  }
  return map;
}

async function loadContextBookings(
  restaurantId: string,
  bookingDate: string | null,
  client: DbClient,
): Promise<ContextBookingRow[]> {
  if (!bookingDate) {
    return [];
  }

  const { data, error } = await client
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

function formatConflictSummary(conflicts: ManualAssignmentConflict[]): string {
  if (conflicts.length === 0) {
    return "conflicts";
  }

  const sources = new Set(conflicts.map((conflict) => conflict.source));
  const tableIds = Array.from(new Set(conflicts.map((conflict) => conflict.tableId))).join(", ");
  if (sources.size === 0) {
    return tableIds ? `conflicts on tables ${tableIds}` : "conflicts";
  }

  if (sources.size > 1) {
    return tableIds ? `holds and bookings on tables ${tableIds}` : "holds and bookings";
  }

  const [source] = sources;
  const label = source === "hold" ? "holds" : "bookings";
  return tableIds ? `${label} on tables ${tableIds}` : label;
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

  const adjacency = await loadAdjacency(tableIds, supabase);

  const contextBookings = await loadContextBookings(booking.restaurant_id, booking.booking_date ?? null, supabase);
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
      },
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
  const contextBookings = await loadContextBookings(booking.restaurant_id, booking.booking_date ?? null, supabase);

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
          })
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
    await emitHoldConfirmed({
      holdId: holdContext.holdId,
      bookingId: booking.id,
      restaurantId: booking.restaurant_id,
      zoneId,
      tableIds: result.map((assignment) => assignment.tableId),
      startAt: startIso,
      endAt: endIso,
      expiresAt: endIso,
      actorId: actorId ?? null,
      metadata: telemetryMetadata,
    });
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

  const { holdId, bookingId, idempotencyKey, requireAdjacency: requireAdjacencyOverride, assignedBy = null, client } = options;
  const supabase = ensureClient(client);

  const {
    data: holdRow,
    error: holdError,
  } = await supabase
    .from("table_holds")
    .select("restaurant_id, zone_id, booking_id, table_hold_members(table_id)")
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
  const planSignature = createPlanSignature({
    bookingId,
    tableIds: normalizedTableIds,
    startAt: startIso,
    endAt: endIso,
  });

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
        idempotencyKey,
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
    await supabase.from("table_holds").delete().eq("id", holdId);
  } catch {
    // Best-effort cleanup.
  }

  return synchronizeAssignments({
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
  const idempotencyKey = options?.idempotencyKey ?? planSignature;
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
    contextBookings = await loadContextBookings(booking.restaurant_id, booking.booking_date ?? null, supabase);
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
    requireAdjacency,
    demandMultiplier,
    tableScarcityScores,
  });
  // const topRankedPlan = plans.plans[0] ?? null;
  const lookaheadConfig: LookaheadConfig = {
    enabled: lookaheadEnabled,
    windowMinutes: getSelectorLookaheadWindowMinutes(),
    penaltyWeight: getSelectorLookaheadPenaltyWeight(),
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

export async function autoAssignTablesForDate(options: {
  restaurantId: string;
  date: string;
  client?: DbClient;
  assignedBy?: string | null;
  captureDecisions?: boolean;
}): Promise<AutoAssignResult> {
  const { restaurantId, date, client, assignedBy = null, captureDecisions = true } = options;
  const supabase = ensureClient(client);
  const [bookings, tables, restaurantInfo] = await Promise.all([
    loadContextBookings(restaurantId, date, supabase),
    loadTablesForRestaurant(restaurantId, supabase),
    loadRestaurantInfo(restaurantId, supabase),
  ]);
  const restaurantTimezone = restaurantInfo.timezone;
  const restaurantSlug = restaurantInfo.slug;
  const adjacency = await loadAdjacency(
    tables.map((table) => table.id),
    supabase,
  );
  const policy = getVenuePolicy({ timezone: restaurantTimezone ?? undefined });
  const adjacencyEdgeCount = Array.from(adjacency.values()).reduce((sum, neighbors) => sum + neighbors.size, 0);
  const adjacencyEnforced = adjacencyEdgeCount > 0 && isAllocatorAdjacencyRequired();
  const combinationPlannerEnabled = isCombinationPlannerEnabled();
  const mergesEnabled = isAllocatorMergesEnabled();
  const selectorLimits = getSelectorPlannerLimits();
  const lookaheadConfigGlobal: LookaheadConfig = {
    enabled: isSelectorLookaheadEnabled(),
    windowMinutes: getSelectorLookaheadWindowMinutes(),
    penaltyWeight: getSelectorLookaheadPenaltyWeight(),
  };
  const plannerTimePruningEnabled = isPlannerTimePruningEnabled();
  let activeHolds: TableHold[] = [];
  if (isHoldsEnabled()) {
    try {
      activeHolds = await loadActiveHoldsForDate(restaurantId, date, policy, supabase);
    } catch (error: unknown) {
      const code = extractErrorCode(error);
      if (code === "42P01") {
        console.warn("[ops][auto-assign] holds table unavailable; skipping hold hydration", {
          restaurantId,
        });
      } else {
        console.warn("[ops][auto-assign] failed to load active holds", {
          restaurantId,
          error,
        });
      }
      activeHolds = [];
    }
  }

  const result: AutoAssignResult = {
    assigned: [],
    skipped: [],
    serviceFallbacks: [],
  };

  const capturedDecisions: SelectorDecisionCapture[] | undefined = captureDecisions ? [] : undefined;

  const recordDecision = async (event: SelectorDecisionEvent) => {
    const normalizedEvent: SelectorDecisionEvent = {
      ...event,
      availabilitySnapshot: event.availabilitySnapshot ?? null,
    };
    if (capturedDecisions) {
      capturedDecisions.push(buildSelectorDecisionPayload(normalizedEvent));
    }
    await emitSelectorDecision(normalizedEvent);
  };

  const adjacencyMinPartySizeFlag = getAllocatorAdjacencyMinPartySize();

  for (const booking of bookings) {
    const alreadyAssigned = (booking.booking_table_assignments ?? []).some((row) => Boolean(row.table_id));
    if (alreadyAssigned) {
      continue;
    }

    const featureFlags = buildSelectorFeatureFlagsTelemetry();

    const operationStart = highResNow();
    let plannerDurationMs = 0;
    let assignmentDurationMs = 0;
    let combinationModeForTelemetry = combinationPlannerEnabled;

    let window: BookingWindow | null = null;
    let windowUsedFallback = false;
    let windowFallbackService: ServiceKey | null = null;
    let overrunReason: string | null = null;
    try {
      const computed = computeBookingWindowWithFallback({
        startISO: booking.start_at,
        bookingDate: booking.booking_date,
        startTime: booking.start_time,
        partySize: booking.party_size,
        policy,
      });
      window = computed.window;
      windowUsedFallback = computed.usedFallback;
      windowFallbackService = computed.fallbackService;
    } catch (error) {
      if (error instanceof ServiceOverrunError) {
        overrunReason = error.message ?? "Reservation window exceeds service boundary";
      } else {
        throw error;
      }
    }
    if (!window) {
      const reason = overrunReason ?? "Reservation window exceeds service boundary";
      const totalDurationMs = highResNow() - operationStart;
      const rejectionTelemetry = determineRejectionTelemetry(reason, null);
      result.skipped.push({ bookingId: booking.id, reason });
      result.serviceFallbacks.push({
        bookingId: booking.id,
        usedFallback: windowUsedFallback,
        fallbackService: windowFallbackService,
      });
      await recordDecision({
        restaurantId,
        bookingId: booking.id,
        partySize: booking.party_size,
        window: undefined,
        candidates: [],
        selected: null,
        skipReason: reason,
        durationMs: roundMilliseconds(totalDurationMs),
        featureFlags,
        timing: buildTiming({ totalMs: totalDurationMs }),
        plannerConfig: undefined,
        diagnostics: undefined,
        rejectionClassification: rejectionTelemetry?.classification ?? null,
        strategicPenalties: rejectionTelemetry?.penalties ?? null,
      });
      continue;
    }

    result.serviceFallbacks.push({
      bookingId: booking.id,
      usedFallback: windowUsedFallback,
      fallbackService: windowFallbackService,
    });

    const requireAdjacency = adjacencyEnforced && partiesRequireAdjacency(booking.party_size);
    const busy = buildBusyMaps({
      targetBookingId: booking.id,
      bookings,
      holds: activeHolds,
      policy,
      targetWindow: window,
    });
    let timePruningStats: TimeFilterStats | null = null;

    const availableTables = filterAvailableTables(
      tables,
      booking.party_size,
      window,
      adjacency,
      undefined,
      undefined,
      {
        allowInsufficientCapacity: true,
        timeFilter: plannerTimePruningEnabled
          ? {
              busy,
              mode: "strict",
              captureStats: (stats) => {
                timePruningStats = stats;
              },
            }
          : undefined,
      },
    );
    const strategicOptions = { restaurantId } as const;
    await loadStrategicConfig({ ...strategicOptions, client: supabase });
    const baseScoringConfig = getSelectorScoringConfig(strategicOptions);
    const combinationLimit = getAllocatorCombinationLimit();
    const demandMultiplierResult = await resolveDemandMultiplier({
      restaurantId,
      serviceStart: window.block.start,
      serviceKey: window.service,
      timezone: policy.timezone,
      client: supabase,
    });
    const demandMultiplier = demandMultiplierResult?.multiplier ?? 1;
    const demandRule = demandMultiplierResult?.rule;
    const tableScarcityScores = await loadTableScarcityScores({
      restaurantId,
      tables: availableTables,
      client: supabase,
    });
    const scoringConfig: SelectorScoringConfig = {
      ...baseScoringConfig,
      weights: {
        ...baseScoringConfig.weights,
        scarcity: getYieldManagementScarcityWeight(strategicOptions),
      },
    };
    const runPlanner = (enableCombinations: boolean) => {
      const plannerStart = highResNow();
      const result = buildScoredTablePlans({
        tables: availableTables,
        partySize: booking.party_size,
        adjacency,
        config: scoringConfig,
        enableCombinations,
        kMax: combinationLimit,
        maxPlansPerSlack: selectorLimits.maxPlansPerSlack,
        maxCombinationEvaluations: selectorLimits.maxCombinationEvaluations,
        requireAdjacency,
        demandMultiplier,
        tableScarcityScores,
      });
      plannerDurationMs += highResNow() - plannerStart;
      return result;
    };
    let plans = runPlanner(combinationPlannerEnabled);

    if (plans.plans.length === 0 && !combinationPlannerEnabled) {
      if (mergesEnabled) {
        combinationModeForTelemetry = true;
        const mergeFallback = runPlanner(true);
        if (mergeFallback.plans.length > 0) {
          plans = mergeFallback;
        } else {
          plans = {
            ...mergeFallback,
            fallbackReason: mergeFallback.fallbackReason ?? "Combination planner disabled (requires merges)",
          };
        }
      } else if (!plans.fallbackReason) {
        plans = {
          ...plans,
          fallbackReason: "Combination planner disabled (requires merges)",
        };
      }
    }

    const lookaheadDiagnostics = evaluateLookahead({
      lookahead: lookaheadConfigGlobal,
      bookingId: booking.id,
      bookingWindow: window,
      plansResult: plans,
      tables,
      adjacency,
      zoneId: null,
      policy,
      contextBookings: bookings,
      holds: activeHolds,
      combinationEnabled: combinationModeForTelemetry,
      combinationLimit,
      selectorLimits,
      scoringConfig,
    });
    plans.diagnostics.lookahead = lookaheadDiagnostics;

    const plannerConfigTelemetry = composePlannerConfig({
      diagnostics: plans.diagnostics,
      scoringConfig,
      combinationEnabled: combinationModeForTelemetry,
      requireAdjacency,
      adjacencyRequiredGlobally: adjacencyEnforced,
      adjacencyMinPartySize: adjacencyMinPartySizeFlag ?? null,
      featureFlags,
      serviceFallback: {
        usedFallback: windowUsedFallback,
        fallbackService: windowFallbackService,
      },
      demandMultiplier,
      demandRule,
      lookahead: lookaheadConfigGlobal,
    });
    if (!timePruningStats) {
      timePruningStats = {
        prunedByTime: 0,
        candidatesAfterTimePrune: availableTables.length,
        pruned_by_time: 0,
        candidates_after_time_prune: availableTables.length,
      };
    }
    plans.diagnostics.timePruning = {
      prunedByTime: timePruningStats.prunedByTime,
      candidatesAfterTimePrune: timePruningStats.candidatesAfterTimePrune,
      pruned_by_time: timePruningStats.pruned_by_time,
      candidates_after_time_prune: timePruningStats.candidates_after_time_prune,
    };

    const topRankedPlan = plans.plans[0] ?? null;

    if (plans.plans.length === 0) {
      const fallback = plans.fallbackReason ?? "No suitable tables available";
      const skipReason = `No suitable tables available (${fallback})`;
      const totalDurationMs = highResNow() - operationStart;
      const rejectionTelemetry = determineRejectionTelemetry(skipReason, topRankedPlan?.scoreBreakdown);
      result.skipped.push({ bookingId: booking.id, reason: skipReason });
      await recordDecision({
        restaurantId,
        bookingId: booking.id,
        partySize: booking.party_size,
        window: {
          start: toIsoUtc(window.block.start),
          end: toIsoUtc(window.block.end),
        },
        candidates: [],
        selected: null,
        skipReason,
        durationMs: roundMilliseconds(totalDurationMs),
        featureFlags,
        timing: buildTiming({ totalMs: totalDurationMs, plannerMs: plannerDurationMs }),
        plannerConfig: plannerConfigTelemetry,
        diagnostics: plans.diagnostics,
        rejectionClassification: rejectionTelemetry?.classification ?? null,
        strategicPenalties: rejectionTelemetry?.penalties ?? null,
      });
      continue;
    }

    const planEvaluations = plans.plans.map((plan) => ({
      plan,
      conflicts: extractConflictsForTables(
        busy,
        plan.tables.map((table) => table.id),
        window,
      ),
    }));
    const bestPlanForTelemetry = planEvaluations[0]?.plan ?? null;

    const candidateSummariesAll: CandidateSummary[] = planEvaluations.map(({ plan }) =>
      summarizeCandidate({
        tableIds: plan.tables.map((table) => table.id),
        tableNumbers: plan.tables.map((table) => table.tableNumber),
        totalCapacity: plan.totalCapacity,
        tableCount: plan.tables.length,
        slack: plan.slack,
        score: plan.score,
        adjacencyStatus: plan.adjacencyStatus,
        scoreBreakdown: plan.scoreBreakdown,
      }),
    );

    const conflictFreeEntries = planEvaluations.filter(({ conflicts }) => conflicts.length === 0);
    if (conflictFreeEntries.length === 0) {
      const conflictEntry = planEvaluations.find(({ conflicts }) => conflicts.length > 0);
      const conflictSummary = conflictEntry ? formatConflictSummary(conflictEntry.conflicts) : "conflicts";
      const skipReason = `Conflicts with existing ${conflictSummary}`;
      const rejectionTelemetry = determineRejectionTelemetry(skipReason, bestPlanForTelemetry?.scoreBreakdown);

      if (conflictEntry) {
        await emitRpcConflict({
          source: "auto_assign_conflict",
          bookingId: booking.id,
          restaurantId,
          tableIds: conflictEntry.plan.tables.map((table) => table.id),
          error: {
            code: null,
            message: skipReason,
            details: JSON.stringify(conflictEntry.conflicts),
            hint: null,
          },
        });
      }

      result.skipped.push({ bookingId: booking.id, reason: skipReason });
      const totalDurationMs = highResNow() - operationStart;
      await recordDecision({
        restaurantId,
        bookingId: booking.id,
        partySize: booking.party_size,
        window: {
          start: toIsoUtc(window.block.start),
          end: toIsoUtc(window.block.end),
        },
        candidates: candidateSummariesAll,
        selected: null,
        skipReason,
        durationMs: roundMilliseconds(totalDurationMs),
        featureFlags,
        timing: buildTiming({ totalMs: totalDurationMs, plannerMs: plannerDurationMs }),
        plannerConfig: plannerConfigTelemetry,
        diagnostics: plans.diagnostics,
        rejectionClassification: rejectionTelemetry?.classification ?? null,
        strategicPenalties: rejectionTelemetry?.penalties ?? null,
      });
      continue;
    }

    const topEntry = conflictFreeEntries[0]!;
    const topPlan = topEntry.plan;
    const candidateSummaries: CandidateSummary[] = conflictFreeEntries.map(({ plan }) =>
      summarizeCandidate({
        tableIds: plan.tables.map((table) => table.id),
        tableNumbers: plan.tables.map((table) => table.tableNumber),
        totalCapacity: plan.totalCapacity,
        tableCount: plan.tables.length,
        slack: plan.slack,
        score: plan.score,
        adjacencyStatus: plan.adjacencyStatus,
        scoreBreakdown: plan.scoreBreakdown,
      }),
    );
    const candidate = candidateSummaries[0]!;

    const assignmentStart = highResNow();
    try {
      await assignTableToBooking(
        booking.id,
        topPlan.tables.map((table) => table.id),
        assignedBy,
        supabase,
        {
          idempotencyKey: randomUUID(),
          requireAdjacency,
          booking: {
            ...(booking as Partial<BookingRow>),
            id: booking.id,
            restaurant_id: restaurantId,
            booking_date: booking.booking_date,
            start_time: booking.start_time,
            end_time: booking.end_time,
            start_at: booking.start_at,
            end_at: booking.end_at,
            party_size: booking.party_size,
            status: booking.status,
            seating_preference: booking.seating_preference ?? null,
            restaurants: { timezone: policy.timezone },
          } as BookingRow,
        },
      );
      assignmentDurationMs = highResNow() - assignmentStart;
    } catch (error: unknown) {
      assignmentDurationMs = highResNow() - assignmentStart;
      const message = error instanceof Error ? error.message : String(error);
      const normalized = message.toLowerCase();
      const overlap =
        normalized.includes("assignment overlap") || normalized.includes("allocations_no_overlap");

      if (!overlap) {
        throw error;
      }

      await emitRpcConflict({
        source: "auto_assign_overlap",
        bookingId: booking.id,
        restaurantId,
        tableIds: topPlan.tables.map((table) => table.id),
        error: {
          code: null,
          message,
          details: null,
          hint: null,
        },
      });

      const skipReason = "Auto assign skipped: Supabase reported an overlapping assignment";
      const rejectionTelemetry = determineRejectionTelemetry(skipReason, topPlan?.scoreBreakdown);
      result.skipped.push({ bookingId: booking.id, reason: skipReason });
      const totalDurationMs = highResNow() - operationStart;
      await recordDecision({
        restaurantId,
        bookingId: booking.id,
        partySize: booking.party_size,
        window: {
          start: toIsoUtc(window.block.start),
          end: toIsoUtc(window.block.end),
        },
        candidates: candidateSummariesAll,
        selected: null,
        skipReason,
        durationMs: roundMilliseconds(totalDurationMs),
        featureFlags,
        timing: buildTiming({
          totalMs: totalDurationMs,
          plannerMs: plannerDurationMs,
          assignmentMs: assignmentDurationMs,
        }),
        plannerConfig: plannerConfigTelemetry,
        diagnostics: plans.diagnostics,
        rejectionClassification: rejectionTelemetry?.classification ?? null,
        strategicPenalties: rejectionTelemetry?.penalties ?? null,
      });
      continue;
    }

    if (!booking.booking_table_assignments) {
      booking.booking_table_assignments = [];
    }
    for (const table of topPlan.tables) {
      if (!booking.booking_table_assignments.some((assignment) => assignment?.table_id === table.id)) {
        booking.booking_table_assignments.push({ table_id: table.id });
      }
    }

    result.assigned.push({
      bookingId: booking.id,
      tableIds: topPlan.tables.map((table) => table.id),
    });

    const assignedTableIds = new Set(topPlan.tables.map((table) => table.id));
    const remainingTables = availableTables
      .filter((table) => !assignedTableIds.has(table.id))
      .map((table) => ({
        id: table.id,
        tableNumber: table.tableNumber,
        capacity: table.capacity,
      }));

    const totalDurationMs = highResNow() - operationStart;
    await recordDecision({
      restaurantId,
      bookingId: booking.id,
      partySize: booking.party_size,
      window: {
        start: toIsoUtc(window.block.start),
        end: toIsoUtc(window.block.end),
      },
      candidates: candidateSummaries,
      selected: candidate,
      skipReason: null,
      durationMs: roundMilliseconds(totalDurationMs),
      featureFlags,
      timing: buildTiming({
        totalMs: totalDurationMs,
        plannerMs: plannerDurationMs,
        assignmentMs: assignmentDurationMs,
      }),
      plannerConfig: plannerConfigTelemetry,
      diagnostics: plans.diagnostics,
      availabilitySnapshot: {
        totalCandidates: availableTables.length,
        remainingAfterSelection: remainingTables.length,
        remainingTables,
      },
    });
  }

  if (capturedDecisions) {
    await persistDecisionSnapshots({ restaurantId, date, slug: restaurantSlug, decisions: capturedDecisions });
    return { ...result, decisions: capturedDecisions };
  }

  return result;
}

export async function autoAssignTables(options: {
  restaurantId: string;
  date: string;
  client?: DbClient;
  assignedBy?: string | null;
  captureDecisions?: boolean;
}): Promise<AutoAssignResult> {
  return autoAssignTablesForDate(options);
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
