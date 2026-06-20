import { performance } from 'node:perf_hooks';

import { AssignTablesRpcError } from '@/server/capacity/holds';
import {
  createAvailabilityBitset,
  markWindow,
  isWindowFree,
} from '@/server/capacity/planner/bitset';
import {
  getVenuePolicy,
  type VenuePolicy,
  type SelectorScoringConfig,
  type ServiceKey,
} from '@/server/capacity/policy';
import {
  buildScoredTablePlans,
  type RankedTablePlan,
  type CandidateDiagnostics,
  type BuildCandidatesResult,
} from '@/server/capacity/selector';
import { deriveTableRules } from '@/server/capacity/table-rules';
import { windowsOverlap } from '@/server/capacity/time-windows';
import { isAllocatorAdjacencyRequired, isPlannerTimePruningEnabled } from '@/server/runtime-policy';

import { computeBookingWindowWithFallback, type BookingWindowWithFallback } from './booking-window';
import { ensureClient, extractErrorCode, type ContextBookingRow } from './supabase';
import {
  type BookingWindow,
  type Table,
  type ManualAssignmentConflict,
  type DbClient,
} from './types';
import { toIsoUtc, serializeDetails } from './utils';

import type { TableHold } from '@/server/capacity/holds';
import type { getSelectorPlannerLimits } from '@/server/runtime-policy';
import type { Tables } from '@/types/supabase';

type BusyWindow = {
  tableId: string;
  startAt: string;
  endAt: string;
  bookingId: string | null;
  source: 'booking' | 'hold';
};

export type AvailabilityMap = Map<
  string,
  {
    bitset: ReturnType<typeof createAvailabilityBitset>;
    windows: BusyWindow[];
  }
>;

export type TimeFilterMode = 'strict' | 'approx';

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

export type TableFilterStatusPolicy = 'available_only' | 'exclude_out_of_service';

export type TableFilterDiagnostics = {
  inputTables: number;
  candidatesAfterBasic: number;
  candidatesAfterTime: number;
  droppedByAvoid: number;
  droppedByZone: number;
  droppedByZoneInactive: number;
  droppedByTableInactive: number;
  droppedByStatus: number;
  droppedByMobility: number;
  droppedByInvalidCapacity: number;
  droppedByInsufficientCapacity: number;
  droppedByMaxPartySize: number;
  droppedByMinPartySize: number;
  droppedByAdjacency: number;
  droppedByTime: number;
  statusPolicy: TableFilterStatusPolicy;
  futureWindow: boolean;
};

export function filterTimeAvailableTables(
  tables: Table[],
  window: BookingWindow,
  busy: AvailabilityMap | undefined,
  mode: TimeFilterMode,
  captureStats?: (stats: TimeFilterStats) => void,
): Table[] {
  const DEBUG = process.env.CAPACITY_DEBUG === '1' || process.env.CAPACITY_DEBUG === 'true';
  if (!busy || busy.size === 0 || mode === 'approx') {
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
    allowMaxPartySizeViolation?: boolean;
    allowMinPartySizeViolation?: boolean;
    requireAdjacency?: boolean;
    timeFilter?: TimeFilterOptions;
    captureDiagnostics?: (diagnostics: TableFilterDiagnostics) => void;
  },
): Table[] {
  const DEBUG = process.env.CAPACITY_DEBUG === '1' || process.env.CAPACITY_DEBUG === 'true';
  const allowPartial = options?.allowInsufficientCapacity ?? false;
  const allowMaxPartySizeViolation = options?.allowMaxPartySizeViolation ?? false;
  const allowMinPartySizeViolation = options?.allowMinPartySizeViolation ?? false;
  // Adjacency-required is configurable per call. When no explicit override is
  // supplied the runtime default applies (historically `true`).
  const requireAdjacency = partiesRequireAdjacency(partySize, options?.requireAdjacency);
  const avoid = avoidTables ?? new Set<string>();
  const futureWindow = window.block.start.toMillis() > Date.now();
  const statusPolicy: TableFilterStatusPolicy = futureWindow
    ? 'exclude_out_of_service'
    : 'available_only';
  const diagnostics: TableFilterDiagnostics = {
    inputTables: tables.length,
    candidatesAfterBasic: 0,
    candidatesAfterTime: 0,
    droppedByAvoid: 0,
    droppedByZone: 0,
    droppedByZoneInactive: 0,
    droppedByTableInactive: 0,
    droppedByStatus: 0,
    droppedByMobility: 0,
    droppedByInvalidCapacity: 0,
    droppedByInsufficientCapacity: 0,
    droppedByMaxPartySize: 0,
    droppedByMinPartySize: 0,
    droppedByAdjacency: 0,
    droppedByTime: 0,
    statusPolicy,
    futureWindow,
  };

  if (DEBUG) {
    console.warn('[capacity.debug][filter] input', {
      tables: tables.length,
      partySize,
      windowStart: toIsoUtc(window.block.start),
      windowEnd: toIsoUtc(window.block.end),
      allowPartial,
      allowMaxPartySizeViolation,
      allowMinPartySizeViolation,
      zoneId: zoneId ?? null,
      avoidCount: avoid.size,
      statusPolicy,
      futureWindow,
    });
  }

  const filtered = tables.filter((table) => {
    if (!table) {
      diagnostics.droppedByInvalidCapacity += 1;
      return false;
    }
    if (avoid.has(table.id)) {
      diagnostics.droppedByAvoid += 1;
      return false;
    }
    if (zoneId && table.zoneId !== zoneId) {
      diagnostics.droppedByZone += 1;
      return false;
    }
    if (table.zoneActive === false) {
      diagnostics.droppedByZoneInactive += 1;
      return false;
    }
    if (table.active === false) {
      diagnostics.droppedByTableInactive += 1;
      return false;
    }
    const normalizedStatus = (table.status ?? '').toString().trim().toLowerCase() || 'unknown';
    if (statusPolicy === 'available_only') {
      if (normalizedStatus !== 'available') {
        diagnostics.droppedByStatus += 1;
        return false;
      }
    } else if (normalizedStatus === 'out_of_service' || normalizedStatus === 'unknown') {
      diagnostics.droppedByStatus += 1;
      return false;
    }
    const capacity = table.capacity ?? 0;
    if (!Number.isFinite(capacity) || capacity <= 0) {
      diagnostics.droppedByInvalidCapacity += 1;
      return false;
    }

    const rules = deriveTableRules({
      capacity,
      mobility: table.mobility,
      category: table.category,
    });
    const requiresMerge = capacity < partySize;

    // When capacity alone is insufficient, table must be mergeable by rules.
    if (requiresMerge && !rules.canBeMerged) {
      diagnostics.droppedByMobility += 1;
      return false;
    }

    if (!allowPartial && requiresMerge) {
      diagnostics.droppedByInsufficientCapacity += 1;
      return false;
    }

    if (
      !allowMaxPartySizeViolation &&
      rules.maxPartySize !== null &&
      partySize > rules.maxPartySize
    ) {
      diagnostics.droppedByMaxPartySize += 1;
      return false;
    }

    if (!allowMinPartySizeViolation && partySize < rules.minPartySize) {
      diagnostics.droppedByMinPartySize += 1;
      return false;
    }
    // Adjacency evidence is required only for merge candidates.
    if (requiresMerge && requireAdjacency && !adjacency.has(table.id)) {
      diagnostics.droppedByAdjacency += 1;
      return false;
    }
    return true;
  });

  diagnostics.candidatesAfterBasic = filtered.length;

  if (DEBUG) {
    console.warn('[capacity.debug][filter] after basic', {
      remaining: filtered.length,
      droppedByStatus: diagnostics.droppedByStatus,
      droppedByTime: diagnostics.droppedByTime,
    });
  }

  const timeFiltered =
    options?.timeFilter && window
      ? filterTimeAvailableTables(
          filtered,
          window,
          options.timeFilter.busy,
          options.timeFilter.mode ?? 'strict',
          (stats) => options.timeFilter?.captureStats?.(stats),
        )
      : filtered;
  diagnostics.droppedByTime = Math.max(0, filtered.length - timeFiltered.length);
  diagnostics.candidatesAfterTime = timeFiltered.length;
  options?.captureDiagnostics?.(diagnostics);

  if (DEBUG) {
    console.warn('[capacity.debug][filter] after time', {
      remaining: timeFiltered.length,
      droppedByTime: diagnostics.droppedByTime,
    });
  }

  return timeFiltered.sort((a, b) => {
    const capacityDiff = (a.capacity ?? 0) - (b.capacity ?? 0);
    if (capacityDiff !== 0) return capacityDiff;
    return a.tableNumber.localeCompare(b.tableNumber);
  });
}

export function partiesRequireAdjacency(partySize: number, override?: boolean | null): boolean {
  // Adjacency-required is configurable. The party-size threshold concept is deprecated;
  // adjacency applies uniformly when required. An explicit boolean override is honored;
  // otherwise the runtime default applies, which preserves the historical invariant (true).
  void partySize;
  return isAllocatorAdjacencyRequired(override);
}

export function resolveRequireAdjacency(partySize: number, override?: boolean): boolean {
  // Adjacency-required is configurable. An explicit boolean override (e.g. a staff
  // manual assignment opting out via requireAdjacency=false) is honored; otherwise we
  // fall back to the runtime default, which preserves the historical invariant (true).
  void partySize;
  return isAllocatorAdjacencyRequired(override);
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
        bookingOption: booking.booking_type ?? null,
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

/**
 * Produces a deterministic visiting order over [0, count) that, for any prefix,
 * is spread across the whole range rather than concentrated at the front.
 *
 * Used by the lookahead so that when the time budget is exhausted mid-pass the
 * plans that did get evaluated are sampled fairly across the ranked list instead
 * of always being the first few (top-ranked) ones. This avoids ranking being
 * decided purely by enumeration order under load.
 *
 * The order is built by sweeping the range with a coarse stride and progressively
 * filling in the gaps, which keeps it cheap (O(count)) and stable across runs.
 */
export function buildFairEvaluationOrder(count: number): number[] {
  if (count <= 0) {
    return [];
  }
  if (count <= 2) {
    return Array.from({ length: count }, (_value, index) => index);
  }

  const order: number[] = [];
  const seen = new Set<number>();
  // Binary subdivision (van der Corput style): start with the coarsest stride that
  // still spans the range, then repeatedly halve. This guarantees any truncated
  // prefix is spread across the FULL range rather than clustered at the top-ranked
  // head, so a budget-limited evaluation still samples low-ranked plans. The final
  // stride-1 pass guarantees every index is included (total/fail-safe).
  let stride = 1;
  while (stride * 2 <= count) {
    stride *= 2;
  }
  while (true) {
    for (let index = 0; index < count; index += stride) {
      if (!seen.has(index)) {
        seen.add(index);
        order.push(index);
      }
    }
    if (stride === 1) {
      break;
    }
    stride = Math.floor(stride / 2);
  }

  return order;
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
  requireAdjacencyOverride?: boolean | null;
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
    requireAdjacencyOverride,
  } = params;
  const start = performance.now();
  const MAX_LOOKAHEAD_PLANS = Math.min(20, plans.length);
  const LOOKAHEAD_TIME_BUDGET_MS = Math.max(
    15,
    Math.min(100, selectorLimits.enumerationTimeoutMs ?? 50),
  );

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
    const upperBound = caps
      .slice(0, Math.min(kLimit, caps.length))
      .reduce((sum, value) => sum + value, 0);
    return upperBound >= required;
  };

  // Evaluate plans in a fair (strided) order rather than strictly best-first.
  // The time budget can be exhausted by the first few (top-ranked) plans, which
  // would leave every later plan un-evaluated and therefore un-penalized — biasing
  // ranking purely by enumeration order under load. Visiting the eligible window in
  // a deterministic stride spreads any budget cutoff across high/mid/low-ranked plans
  // so later conflicting plans still get a fair chance to be penalized. Work stays
  // bounded (<= MAX_LOOKAHEAD_PLANS) and per-plan cost is unchanged.
  const evaluationOrder = buildFairEvaluationOrder(MAX_LOOKAHEAD_PLANS);

  for (const planIndex of evaluationOrder) {
    const plan = plans[planIndex];
    if (!plan) {
      continue;
    }
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

      const requireAdjacencyForFuture = resolveRequireAdjacency(
        future.partySize,
        requireAdjacencyOverride ?? undefined,
      );
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
          requireAdjacency: requireAdjacencyForFuture,
          timeFilter: {
            busy: future.busy,
            mode: 'strict',
          },
        },
      );

      if (availableTables.length === 0) {
        planPenalty += penaltyWeight;
        conflicts.push({ bookingId: future.bookingId, planKey: plan.tableKey });
        continue;
      }

      if (
        !quickCapacityFeasible(availableTables, future.partySize, combinationLimit, zoneId ?? null)
      ) {
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
  // Optional adjacency override propagated from the originating quote so the
  // lookahead evaluates future bookings under the same adjacency policy as the
  // current booking. Absent => runtime default (historically `true`).
  requireAdjacencyOverride?: boolean | null;
}): CandidateDiagnostics['lookahead'] {
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
    requireAdjacencyOverride,
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

  const {
    penalizedPlans,
    totalPenalty,
    evaluationMs,
    conflicts,
    blockedPlans,
    timeBudgetHit,
    precheckedConflicts,
  } = applyLookaheadPenalties({
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
    requireAdjacencyOverride,
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
    return a.tableKey.localeCompare(b.tableKey, 'en');
  });
}

function registerBusyWindow(
  map: AvailabilityMap,
  tableId: string,
  window: { startAt: string; endAt: string; bookingId: string | null; source: 'booking' | 'hold' },
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

    let windowResult;
    try {
      windowResult = computeBookingWindowWithFallback({
        startISO: booking.start_at,
        bookingDate: booking.booking_date,
        startTime: booking.start_time,
        partySize: booking.party_size,
        bookingOption: booking.booking_type ?? null,
        policy,
      });
    } catch (error) {
      // A context booking carrying table assignments but lacking sufficient temporal
      // data (null start_at AND null booking_date/start_time) makes window
      // computation throw. Skip that single booking instead of aborting the whole
      // busy-map / lookahead build for the current assignment. (gap #8)
      if (process.env.CAPACITY_DEBUG === '1' || process.env.CAPACITY_DEBUG === 'true') {
        console.warn('[capacity.debug][busy-map] skipping booking with unresolvable window', {
          bookingId: booking.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      continue;
    }
    const { window } = windowResult;

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
        source: 'booking',
      });
    }
  }

  for (const hold of holds) {
    if (excludeHoldId && hold.id === excludeHoldId) continue;
    if (
      targetInterval &&
      !windowsOverlap({ start: hold.startAt, end: hold.endAt }, targetInterval)
    ) {
      continue;
    }
    for (const tableId of hold.tableIds) {
      registerBusyWindow(map, tableId, {
        startAt: hold.startAt,
        endAt: hold.endAt,
        bookingId: hold.bookingId,
        source: 'hold',
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
      if (
        windowsOverlap(
          { start: targetStart, end: targetEnd },
          { start: other.startAt, end: other.endAt },
        )
      ) {
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
  bookings: Pick<Tables<'bookings'>, 'id' | 'status' | 'start_at' | 'end_at'> | null;
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
    .from('booking_table_assignments')
    .select('table_id, start_at, end_at, bookings(id, status, start_at, end_at)')
    .eq('table_id', tableId)
    .lt('start_at', endAt)
    .gt('end_at', startAt);

  if (error || !data) {
    throw new AssignTablesRpcError({
      message: error?.message ?? 'Failed to query table availability',
      code: 'TABLE_AVAILABILITY_QUERY_FAILED',
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
    if (booking && !['pending', 'confirmed', 'seated'].includes(booking.status ?? '')) {
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
    bookingOption?: string | null;
    client?: DbClient;
  },
): Promise<boolean> {
  const supabase = ensureClient(options?.client);
  const policy = options?.policy ?? getVenuePolicy();
  const { window } = computeBookingWindowWithFallback({
    startISO,
    partySize,
    bookingOption: options?.bookingOption ?? null,
    policy,
  });

  const startAt = toIsoUtc(window.block.start);
  const endAt = toIsoUtc(window.block.end);

  try {
    const { data, error } = await (
      supabase as unknown as {
        rpc: (
          fn: string,
          args: {
            p_table_id: string;
            p_start_at: string;
            p_end_at: string;
            p_exclude_booking_id: string | null;
          },
        ) => Promise<{
          data: boolean | null;
          error: {
            message?: string;
            details?: string | null;
            hint?: string | null;
            code?: string | null;
          } | null;
        }>;
      }
    ).rpc('is_table_available_v2', {
      p_table_id: tableId,
      p_start_at: startAt,
      p_end_at: endAt,
      p_exclude_booking_id: options?.excludeBookingId ?? null,
    });

    if (error) {
      const code = extractErrorCode(error);
      if (code === '42883' || code === '42P01') {
        return await legacyTableAvailabilityCheck({
          supabase,
          tableId,
          startAt,
          endAt,
          excludeBookingId: options?.excludeBookingId ?? null,
        });
      }
      throw new AssignTablesRpcError({
        message: error.message ?? 'Failed to query table availability',
        code: 'TABLE_AVAILABILITY_QUERY_FAILED',
        details: serializeDetails({
          code: code ?? null,
          details: error.details ?? null,
          hint: error.hint ?? null,
        }),
        hint: null,
      });
    }

    if (typeof data === 'boolean') {
      return data;
    }
  } catch (error) {
    const code = extractErrorCode(error);
    if (code !== '42883' && code !== '42P01') {
      throw new AssignTablesRpcError({
        message: error instanceof Error ? error.message : 'Failed to verify table availability',
        code: 'TABLE_AVAILABILITY_QUERY_FAILED',
        details: error instanceof Error ? (error.stack ?? null) : null,
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
        message: 'Failed to verify table availability',
        code: error.code ?? 'TABLE_AVAILABILITY_QUERY_FAILED',
        details: error.details,
        hint: error.hint ?? null,
      });
    }
    throw error;
  }
}
