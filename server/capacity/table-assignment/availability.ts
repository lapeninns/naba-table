import { performance } from "node:perf_hooks";

import { AssignTablesRpcError } from "@/server/capacity/holds";
import { createAvailabilityBitset, markWindow, isWindowFree } from "@/server/capacity/planner/bitset";
import { getVenuePolicy, type VenuePolicy, type SelectorScoringConfig, type ServiceKey } from "@/server/capacity/policy";
import { buildScoredTablePlans, type RankedTablePlan, type CandidateDiagnostics, type BuildCandidatesResult } from "@/server/capacity/selector";
import { windowsOverlap } from "@/server/capacity/time-windows";
import { getAllocatorAdjacencyMinPartySize, isAllocatorAdjacencyRequired, isPlannerTimePruningEnabled } from "@/server/feature-flags";

import { computeBookingWindowWithFallback, type BookingWindowWithFallback } from "./booking-window";
import { ensureClient, extractErrorCode, type ContextBookingRow } from "./supabase";
import { type BookingWindow, type Table, type ManualAssignmentConflict, type DbClient } from "./types";
import { toIsoUtc, serializeDetails } from "./utils";

import type { TableHold } from "@/server/capacity/holds";
import type { getSelectorPlannerLimits} from "@/server/feature-flags";
import type { Tables } from "@/types/supabase";

type BusyWindow = {
  tableId: string;
  startAt: string;
  endAt: string;
  bookingId: string | null;
  source: "booking" | "hold";
};

export type AvailabilityMap = Map<
  string,
  {
    bitset: ReturnType<typeof createAvailabilityBitset>;
    windows: BusyWindow[];
  }
>;

export type TimeFilterMode = "strict" | "approx";

export type TimeFilterStats = {
  prunedByTime: number;
  candidatesAfterTimePrune: number;
  pruned_by_time: number;
  candidates_after_time_prune: number;
};

export type TimeFilterOptions = {
  busy: AvailabilityMap;
  mode?: TimeFilterMode;
  captureStats?: (stats: TimeFilterStats) => void;
};

export function filterTimeAvailableTables(
  tables: Table[],
  window: BookingWindow,
  busy: AvailabilityMap | undefined,
  mode: TimeFilterMode,
  captureStats?: (stats: TimeFilterStats) => void,
): Table[] {
  const DEBUG = process.env.CAPACITY_DEBUG === '1' || process.env.CAPACITY_DEBUG === 'true';
  if (!busy || busy.size === 0 || mode === "approx") {
    captureStats?.({
      prunedByTime: 0,
      candidatesAfterTimePrune: tables.length,
      pruned_by_time: 0,
      candidates_after_time_prune: tables.length,
    });
    if (DEBUG) {
      console.warn('[capacity.debug][time-filter] skipped (no busy map or approx mode)', {
        input: tables.length,
        mode,
      });
    }
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

  if (DEBUG) {
    console.warn('[capacity.debug][time-filter] applied', {
      input: tables.length,
      prunedByTime,
      remaining: filtered.length,
      start: toIsoUtc(window.block.start),
      end: toIsoUtc(window.block.end),
    });
  }

  return filtered;
}

export function filterAvailableTables(
  tables: Table[],
  partySize: number,
  window: BookingWindow,
  adjacency: Map<string, Set<string>>,
  avoidTables?: Set<string>,
  zoneId?: string | null,
  options?: { 
    allowInsufficientCapacity?: boolean; 
    allowMaxPartySizeViolation?: boolean;  // NEW: allow tables that violate maxPartySize (for combinations)
    timeFilter?: TimeFilterOptions 
  },
): Table[] {
  const DEBUG = process.env.CAPACITY_DEBUG === '1' || process.env.CAPACITY_DEBUG === 'true';
  const allowPartial = options?.allowInsufficientCapacity ?? false;
  const allowMaxPartySizeViolation = options?.allowMaxPartySizeViolation ?? false;
  const avoid = avoidTables ?? new Set<string>();

  if (DEBUG) {
    console.warn('[capacity.debug][filter] input', {
      tables: tables.length,
      partySize,
      windowStart: toIsoUtc(window.block.start),
      windowEnd: toIsoUtc(window.block.end),
      allowPartial,
      allowMaxPartySizeViolation,
      zoneId: zoneId ?? null,
      avoidCount: avoid.size,
    });
  }

  const filtered = tables.filter((table) => {
    if (!table) return false;
    if (avoid.has(table.id)) return false;
    if (zoneId && table.zoneId !== zoneId) return false;
    if (table.active === false) return false;
    if (typeof table.status === "string" && table.status.toLowerCase() === "out_of_service") return false;
    const capacity = table.capacity ?? 0;
    if (!Number.isFinite(capacity) || capacity <= 0) return false;
    if (!allowPartial && capacity < partySize) return false;
    
    // FIX: Only enforce maxPartySize if not allowing violations (for combinations)
    if (!allowMaxPartySizeViolation && typeof table.maxPartySize === "number" && table.maxPartySize > 0 && partySize > table.maxPartySize) {
      return false;
    }
    
    if (typeof table.minPartySize === "number" && table.minPartySize > 0 && partySize < table.minPartySize) {
      return false;
    }
    // Require explicit adjacency info when enforcement is on; missing entry means we cannot validate.
    if (partiesRequireAdjacency(partySize) && !adjacency.has(table.id)) {
      return false;
    }
    return true;
  });

  if (DEBUG) {
    console.warn('[capacity.debug][filter] after basic', { remaining: filtered.length });
  }

  const timeFiltered =
    options?.timeFilter && window
      ? filterTimeAvailableTables(filtered, window, options.timeFilter.busy, options.timeFilter.mode ?? "strict", (stats) =>
          options.timeFilter?.captureStats?.(stats),
        )
      : filtered;

  if (DEBUG) {
    console.warn('[capacity.debug][filter] after time', { remaining: timeFiltered.length });
  }

  return timeFiltered.sort((a, b) => {
    const capacityDiff = (a.capacity ?? 0) - (b.capacity ?? 0);
    if (capacityDiff !== 0) return capacityDiff;
    return a.tableNumber.localeCompare(b.tableNumber);
  });
}

export function partiesRequireAdjacency(partySize: number): boolean {
  if (!isAllocatorAdjacencyRequired()) {
    return false;
  }
  const minPartySize = getAllocatorAdjacencyMinPartySize();
  if (typeof minPartySize === "number") {
    return partySize >= minPartySize;
  }
  return true;
}

export function resolveRequireAdjacency(partySize: number, override?: boolean): boolean {
  if (typeof override === "boolean") {
   return override;
  }
  return partiesRequireAdjacency(partySize);
}

export type LookaheadConfig = {
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
  timeBudgetHit: boolean;
  precheckedConflicts: number;
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
  const MAX_LOOKAHEAD_PLANS = Math.min(20, plans.length);
  const LOOKAHEAD_TIME_BUDGET_MS = Math.max(15, Math.min(100, selectorLimits.enumerationTimeoutMs ?? 50));

  if (futureBookings.length === 0 || plans.length === 0 || penaltyWeight <= 0) {
    return {
      penalizedPlans: 0,
      totalPenalty: 0,
      evaluationMs: performance.now() - start,
      conflicts: [],
      blockedPlans: [],
      timeBudgetHit: false,
      precheckedConflicts: 0,
    };
  }

  let penalizedPlans = 0;
  let totalPenalty = 0;
  const conflicts: Array<{ bookingId: string; planKey: string }> = [];
  const blockedPlanKeys = new Set<string>();
  let timeBudgetHit = false;
  let precheckedConflicts = 0;

  const quickCapacityFeasible = (
    candidateTables: Table[],
    required: number,
    kLimit: number,
    baseZone: string | null,
  ): boolean => {
    if (kLimit <= 0 || candidateTables.length === 0) {
      return false;
    }
    const caps: number[] = [];
    for (const table of candidateTables) {
      if (baseZone && table.zoneId && table.zoneId !== baseZone) {
        continue;
      }
      const capacity = table.capacity ?? 0;
      if (capacity > 0) {
        caps.push(capacity);
      }
    }
    if (caps.length === 0) {
      return false;
    }
    caps.sort((a, b) => b - a);
    const upperBound = caps.slice(0, Math.min(kLimit, caps.length)).reduce((sum, value) => sum + value, 0);
    return upperBound >= required;
  };

  for (const plan of plans.slice(0, MAX_LOOKAHEAD_PLANS)) {
    if (performance.now() - start > LOOKAHEAD_TIME_BUDGET_MS) {
      timeBudgetHit = true;
      break;
    }

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
          allowMaxPartySizeViolation: combinationEnabled,
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

      if (!quickCapacityFeasible(availableTables, future.partySize, combinationLimit, zoneId ?? null)) {
        planPenalty += penaltyWeight;
        conflicts.push({ bookingId: future.bookingId, planKey: plan.tableKey });
        precheckedConflicts += 1;
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
    timeBudgetHit,
    precheckedConflicts,
  };
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
      plansConsidered: 0,
      plansEvaluated: 0,
      timeBudgetHit: false,
      precheckedConflicts: 0,
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
      plansConsidered: 0,
      plansEvaluated: 0,
      timeBudgetHit: false,
      precheckedConflicts: 0,
    };
  }

  const { penalizedPlans, totalPenalty, evaluationMs, conflicts, blockedPlans, timeBudgetHit, precheckedConflicts } = applyLookaheadPenalties({
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
      plansConsidered: Math.min(20, plansResult.plans.length),
      plansEvaluated: Math.min(20, plansResult.plans.length),
      timeBudgetHit,
      precheckedConflicts,
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
    // Best-effort estimates; exact counts are cheap to compute here
    plansConsidered: Math.min(20, plansResult.plans.length),
    plansEvaluated: Math.min(20, plansResult.plans.length),
    timeBudgetHit,
    precheckedConflicts,
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

export function buildBusyMaps(params: {
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

export function extractConflictsForTables(
  busy: AvailabilityMap,
  tableIds: string[],
  window: BookingWindow,
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

type AssignmentAvailabilityRow = {
  table_id: string | null;
  start_at: string | null;
  end_at: string | null;
  bookings: Pick<Tables<"bookings">, "id" | "status" | "start_at" | "end_at"> | null;
};

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
    .eq("table_id", tableId)
    .lt("start_at", endAt)
    .gt("end_at", startAt);

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
