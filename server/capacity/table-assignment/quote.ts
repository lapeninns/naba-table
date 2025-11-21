import { DateTime } from "luxon";

import { env } from "@/lib/env";
import { resolveDemandMultiplier, type DemandMultiplierResult } from "@/server/capacity/demand-profiles";
import { createTableHold, releaseTableHold, findHoldConflicts, HoldConflictError, type HoldConflictInfo, type TableHold } from "@/server/capacity/holds";
import { getVenuePolicy, getSelectorScoringConfig, getYieldManagementScarcityWeight, type SelectorScoringConfig, type ServiceKey } from "@/server/capacity/policy";
import { loadTableScarcityScores } from "@/server/capacity/scarcity";
import { buildScoredTablePlans, type RankedTablePlan, type CandidateDiagnostics } from "@/server/capacity/selector";
import { loadStrategicConfig } from "@/server/capacity/strategic-config";
import { emitHoldStrictConflict, emitSelectorQuote, emitRpcConflict, summarizeCandidate, type CandidateSummary, type SelectorDecisionEvent } from "@/server/capacity/telemetry";
import { computePayloadChecksum, hashPolicyVersion } from "@/server/capacity/v2";
import {
  getAllocatorKMax as getAllocatorCombinationLimit,
  getAllocatorAdjacencyMinPartySize,
  getSelectorPlannerLimits,
  isAllocatorAdjacencyRequired,
  isAdjacencyQueryUndirected,
  isCombinationPlannerEnabled,
  isPlannerTimePruningEnabled,
  isSelectorLookaheadEnabled,
  getSelectorLookaheadWindowMinutes,
  getSelectorLookaheadPenaltyWeight,
  getSelectorLookaheadBlockThreshold,
  isHoldsEnabled,
  isHoldStrictConflictsEnabled,
  isSelectorScoringEnabled,
  isAllocatorServiceFailHard,
  isOpsMetricsEnabled,
} from "@/server/feature-flags";

import {
  buildBusyMaps,
  filterAvailableTables,
  evaluateLookahead,
  resolveRequireAdjacency,
  partiesRequireAdjacency,
  type AvailabilityMap,
  type TimeFilterStats,
  type LookaheadConfig,
  type TimeFilterMode,
} from "./availability";
import { computeBookingWindowWithFallback } from "./booking-window";
import { DEFAULT_HOLD_TTL_SECONDS } from "./constants";
import {
  ensureClient,
  loadBooking,
  loadTablesForRestaurant,
  loadAdjacency,
  loadContextBookings,
  loadActiveHoldsForDate,
  loadRestaurantTimezone,
  extractErrorCode,
  type DbClient,
  type ContextBookingRow,
} from "./supabase";
import { type Table, type QuoteTablesOptions, type QuoteTablesResult, type QuotePlannerStats } from "./types";
import { highResNow, buildTiming, toIsoUtc, summarizeSelection, roundMilliseconds } from "./utils";


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

function buildSelectionSnapshot(params: {
  planTables: Table[];
  adjacency: Map<string, Set<string>>;
  adjacencyUndirected: boolean;
  fallbackZoneId?: string | null;
}) {
  const { planTables, adjacency, adjacencyUndirected, fallbackZoneId } = params;
  const zoneIds = Array.from(
    new Set(
      planTables
        .map((table) => table.zoneId)
        .filter((zone): zone is string => typeof zone === "string" && zone.trim().length > 0),
    ),
  );
  if (zoneIds.length === 0 && typeof fallbackZoneId === "string" && fallbackZoneId.trim().length > 0) {
    zoneIds.push(fallbackZoneId);
  }

  const tableIdSet = new Set(planTables.map((table) => table.id));
  const edgeSet = new Set<string>();

  for (const table of planTables) {
    const neighbors = adjacency.get(table.id);
    if (!neighbors) continue;
    for (const neighbor of neighbors) {
      if (!tableIdSet.has(neighbor)) continue;
      const key = adjacencyUndirected
        ? ([table.id, neighbor].sort((a, b) => a.localeCompare(b)) as [string, string]).join("->")
        : `${table.id}->${neighbor}`;
      edgeSet.add(key);
    }
  }

  const edges = Array.from(edgeSet).sort();
  const hash = computePayloadChecksum({ undirected: adjacencyUndirected, edges });

  return {
    zoneIds,
    adjacency: {
      undirected: adjacencyUndirected,
      edges,
      hash,
    },
  };
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
    signal,
  } = options;
  if (signal?.aborted) {
    const abortError = new Error("Planner aborted");
    abortError.name = "AbortError";
    throw abortError;
  }

  const operationStart = highResNow();
  const supabase = ensureClient(client);
  const booking = await loadBooking(bookingId, supabase, signal);
  const restaurantTimezonePromise = loadRestaurantTimezone(booking.restaurant_id, supabase, signal).catch(() => null);
  const tablesPromise = loadTablesForRestaurant(booking.restaurant_id, supabase, signal);
  const restaurantTimezoneLookup = await restaurantTimezonePromise;
  const restaurantTimezone =
    (booking.restaurants && !Array.isArray(booking.restaurants) ? booking.restaurants.timezone : null) ??
    restaurantTimezoneLookup ??
    getVenuePolicy().timezone;
  const policy = getVenuePolicy({ timezone: restaurantTimezone ?? undefined });
  const policyVersion = hashPolicyVersion(policy);
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
  const shouldEmitPlannerStats = env.featureFlags.planner.debugProfiling ?? false;
  const attachPlannerStats = (result: QuoteTablesResult, stats?: QuotePlannerStats | null) => {
    if (shouldEmitPlannerStats && stats) {
      result.plannerStats = stats;
    }
    return result;
  };
  const buildFailureResult = (
    reason: string,
    stats?: QuotePlannerStats | null,
    metadataOverrides?: Partial<NonNullable<QuoteTablesResult["metadata"]>>,
  ): QuoteTablesResult =>
    attachPlannerStats(
      {
        hold: null,
        candidate: null,
        alternates: [],
        nextTimes: [],
        reason,
        skipped: [],
        metadata: {
          usedFallback: bookingWindowUsedFallback,
          fallbackService: bookingWindowFallbackService,
          ...metadataOverrides,
        },
      },
      stats ?? null,
    );

  const strategicOptions = { restaurantId: booking.restaurant_id ?? null } as const;
  const strategicConfigPromise = loadStrategicConfig({ ...strategicOptions, client: supabase });
  const demandMultiplierPromise = resolveDemandMultiplier({
    restaurantId: booking.restaurant_id,
    serviceStart: window.block.start,
    serviceKey: window.service,
    timezone: policy.timezone,
    client: supabase,
  });

  const tables = await tablesPromise;
  const adjacency = await loadAdjacency(
    booking.restaurant_id,
    tables.map((table) => table.id),
    supabase,
    signal,
  );
  const requireAdjacency = resolveRequireAdjacency(booking.party_size, requireAdjacencyOverride);
  const timePruningEnabled = isPlannerTimePruningEnabled();
  const lookaheadEnabled = isSelectorLookaheadEnabled();
  let timePruningStats: TimeFilterStats | null = null;
  let busyForPlanner: AvailabilityMap | undefined;
  let contextBookings: ContextBookingRow[] = [];
  let holdsForDay: TableHold[] = [];

  if (timePruningEnabled || lookaheadEnabled) {
    const contextPromise = loadContextBookings(
      booking.restaurant_id,
      booking.booking_date ?? null,
      supabase,
      {
        startIso: toIsoUtc(window.block.start),
        endIso: toIsoUtc(window.block.end),
      },
      signal,
    );

    const holdsPromise = isHoldsEnabled()
      ? loadActiveHoldsForDate(booking.restaurant_id, booking.booking_date ?? null, policy, supabase, signal).catch((error: unknown) => {
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
          return [] as TableHold[];
        })
      : Promise.resolve([] as TableHold[]);

    const [contextResult, holdsResult] = await Promise.all([contextPromise, holdsPromise]);
    contextBookings = contextResult;
    holdsForDay = holdsResult;
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

  await strategicConfigPromise;
  const combinationEnabled = isCombinationPlannerEnabled();
  const totalVenueCapacity = tables.reduce((sum, table) => sum + (table.capacity ?? 0), 0);
  if (booking.party_size > totalVenueCapacity) {
    await demandMultiplierPromise.catch(() => null);
    return buildFailureResult("Insufficient global capacity", {
      totalTables: tables.length,
      filteredTables: 0,
      combinationEnabled,
      demandMultiplier: 0,
      plannerDurationMs: roundMilliseconds(highResNow() - operationStart),
    });
  }

  const buildFilterOptions = (overrides?: { allowMinPartySizeViolation?: boolean }) => ({
    allowInsufficientCapacity: true,
    allowMaxPartySizeViolation: combinationEnabled,
    allowMinPartySizeViolation: overrides?.allowMinPartySizeViolation ?? false,
    timeFilter:
      busyForPlanner && timePruningEnabled
        ? {
            busy: busyForPlanner,
            mode: "strict" as TimeFilterMode,
            captureStats: (stats: TimeFilterStats) => {
              timePruningStats = stats;
            },
          }
        : undefined,
  });

  const computeCapacity = (list: Table[]) => list.reduce((sum, table) => sum + (table.capacity ?? 0), 0);

  const computeFilteredTables = (allowMinPartySizeViolation: boolean) =>
    filterAvailableTables(
      tables,
      booking.party_size,
      window,
      adjacency,
      new Set(avoidTables),
      zoneId ?? null,
      buildFilterOptions({ allowMinPartySizeViolation }),
    );

  let filtered = computeFilteredTables(false);
  let filteredCapacity = computeCapacity(filtered);
  let relaxedMinPartySize = false;

  if ((filtered.length === 0 || filteredCapacity < booking.party_size) && booking.party_size > 0) {
    const relaxed = computeFilteredTables(true);
    const relaxedCapacity = computeCapacity(relaxed);
    if (relaxed.length > 0 && relaxedCapacity >= booking.party_size) {
      filtered = relaxed;
      filteredCapacity = relaxedCapacity;
      relaxedMinPartySize = true;
    }
  }

  if (filtered.length === 0) {
    await demandMultiplierPromise.catch(() => null);
    return buildFailureResult(
      "No tables available for requested window",
      {
        totalTables: tables.length,
        filteredTables: 0,
        combinationEnabled,
        demandMultiplier: 0,
        plannerDurationMs: roundMilliseconds(highResNow() - operationStart),
      },
      { relaxedMinPartySize },
    );
  }
  if (filteredCapacity < booking.party_size) {
    await demandMultiplierPromise.catch(() => null);
    return buildFailureResult(
      "Insufficient filtered capacity",
      {
        totalTables: tables.length,
        filteredTables: filtered.length,
        combinationEnabled,
        demandMultiplier: 0,
        plannerDurationMs: roundMilliseconds(highResNow() - operationStart),
      },
      { relaxedMinPartySize },
    );
  }

  const baseScoringConfig = getSelectorScoringConfig(strategicOptions);
  const selectorLimits = getSelectorPlannerLimits();
  const combinationLimit = maxTables ?? getAllocatorCombinationLimit();
  const demandMultiplierResult = await demandMultiplierPromise.catch(() => null);
  const demandMultiplier = demandMultiplierResult?.multiplier ?? 1;
  const demandRule = demandMultiplierResult?.rule;
  let tableScarcityScores = await loadTableScarcityScores({
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
  let plannerTables = filtered;
  const runPlanner = (
    candidateTables: Table[],
    adjacencyRequired: boolean,
    options?: { allowCapacityOverflow?: boolean; allowMinPartySizeViolation?: boolean },
  ) =>
    buildScoredTablePlans({
      tables: candidateTables,
      partySize: booking.party_size,
      adjacency,
      config: scoringConfig,
      enableCombinations: combinationEnabled,
      kMax: combinationLimit,
      maxPlansPerSlack: selectorLimits.maxPlansPerSlack,
      maxCombinationEvaluations: selectorLimits.maxCombinationEvaluations,
      enumerationTimeoutMs: selectorLimits.enumerationTimeoutMs,
      requireAdjacency: adjacencyRequired,
      demandMultiplier,
      tableScarcityScores,
      allowCapacityOverflow: options?.allowCapacityOverflow ?? false,
      allowMinPartySizeViolation: options?.allowMinPartySizeViolation ?? false,
    });

  let plans = runPlanner(plannerTables, requireAdjacency);
  // Fallback: if no plans found and adjacency was required, retry without adjacency constraint
  let requireAdjacencyUsed = requireAdjacency;
  if (plans.plans.length === 0 && requireAdjacency) {
    const relaxed = runPlanner(plannerTables, false);
    if (relaxed.plans.length > 0) {
      plans = relaxed;
      requireAdjacencyUsed = false;
    }
  }

  if (plans.plans.length === 0 && !relaxedMinPartySize && booking.party_size > 0) {
    const relaxed = computeFilteredTables(true);
    const relaxedCapacity = computeCapacity(relaxed);
    if (relaxed.length > 0 && relaxedCapacity >= booking.party_size) {
      filtered = relaxed;
      filteredCapacity = relaxedCapacity;
      relaxedMinPartySize = true;
      plannerTables = relaxed;
      tableScarcityScores = await loadTableScarcityScores({
        restaurantId: booking.restaurant_id,
        tables: plannerTables,
        client: supabase,
      });
      plans = runPlanner(plannerTables, requireAdjacency, { allowMinPartySizeViolation: true });
      requireAdjacencyUsed = requireAdjacency;
      if (plans.plans.length === 0 && requireAdjacencyUsed) {
        const relaxedAdjacency = runPlanner(plannerTables, false, { allowMinPartySizeViolation: true });
        if (relaxedAdjacency.plans.length > 0) {
          plans = relaxedAdjacency;
          requireAdjacencyUsed = false;
        }
      }
    }
  }

  let capacityOverflowFallbackUsed = false;
  if (plans.plans.length === 0) {
    const overflowResult = runPlanner(plannerTables, requireAdjacencyUsed, {
      allowCapacityOverflow: true,
      allowMinPartySizeViolation: relaxedMinPartySize,
    });
    if (overflowResult.plans.length > 0) {
      plans = overflowResult;
      capacityOverflowFallbackUsed = true;
    }
  }
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
    requireAdjacency: requireAdjacencyUsed,
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

  const collectPlannerStats = (): QuotePlannerStats => ({
    totalTables: tables.length,
    filteredTables: filtered.length,
    generatedPlans: plans.plans.length,
    alternatesGenerated: alternates.length,
    skippedCandidates: skippedCandidates.length,
    holdConflictSkips: holdConflictSkipCount,
    timePruned: timePruningStats?.prunedByTime,
    candidatesAfterTimePrune: timePruningStats?.candidatesAfterTimePrune,
    combinationEnabled,
    requireAdjacency: requireAdjacencyUsed,
    demandMultiplier,
    plannerDurationMs: roundMilliseconds(plannerDurationMs),
  });

  for (let index = 0; index < plans.plans.length; index += 1) {
    const plan = plans.plans[index]!;
    const requestedTableIds = plan.tables.map((table) => table.id);
    const candidateSummary = summarizeCandidate({
      tableIds: requestedTableIds,
      tableNumbers: plan.tables.map((table) => table.tableNumber),
      totalCapacity: plan.totalCapacity,
      tableCount: plan.tables.length,
      slack: plan.slack,
      score: plan.score,
      adjacencyStatus: plan.adjacencyStatus,
      scoreBreakdown: plan.scoreBreakdown,
    });

    const requestedWindowStart = toIsoUtc(window.block.start);
    const requestedWindowEnd = toIsoUtc(window.block.end);
    const parsedWindowEnd = DateTime.fromISO(requestedWindowEnd ?? "");
    const requestedWindowEndDate = parsedWindowEnd.isValid ? parsedWindowEnd : null;

    if (!isHoldStrictConflictsEnabled()) {
      const conflicts = await findHoldConflicts({
        restaurantId: booking.restaurant_id,
        tableIds: requestedTableIds,
        startAt: requestedWindowStart,
        endAt: requestedWindowEnd,
        client: supabase,
      });

      if (conflicts.length > 0) {
        recordHoldConflictSkip(conflicts, candidateSummary, plan);
        continue;
      }
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
      const snapshot = buildSelectionSnapshot({
        planTables: plan.tables,
        adjacency,
        adjacencyUndirected: featureFlags.adjacencyUndirected,
        fallbackZoneId: zoneForHold,
      });

      const holdStart = highResNow();
      const holdExpiryBase = (requestedWindowEndDate ?? DateTime.now()).toUTC();
      const holdExpiresAt = holdExpiryBase.plus({ seconds: holdTtlSeconds });

      const hold = await createTableHold({
        bookingId,
        restaurantId: booking.restaurant_id,
        zoneId: zoneForHold,
        tableIds: requestedTableIds,
        startAt: requestedWindowStart,
        endAt: requestedWindowEnd,
        expiresAt: toIsoUtc(holdExpiresAt),
        createdBy,
        metadata: {
          requireAdjacency: requireAdjacencyUsed,
          selection: {
            tableIds: requestedTableIds,
            summary,
            snapshot,
          },
          policyVersion,
        },
        client: supabase,
      });

      if (isHoldStrictConflictsEnabled()) {
        try {
          const conflictsAfterInsert = await findHoldConflicts({
            restaurantId: booking.restaurant_id,
            tableIds: requestedTableIds,
            startAt: requestedWindowStart,
            endAt: requestedWindowEnd,
            excludeHoldId: hold.id,
            client: supabase,
          });

          if (conflictsAfterInsert.length > 0) {
            try {
              await emitHoldStrictConflict({
                restaurantId: booking.restaurant_id,
                bookingId,
                tableIds: requestedTableIds,
                startAt: requestedWindowStart,
                endAt: requestedWindowEnd,
                conflicts: conflictsAfterInsert.map((conflict) => ({
                  holdId: conflict.holdId,
                  bookingId: conflict.bookingId,
                  tableIds: conflict.tableIds,
                  startAt: conflict.startAt,
                  endAt: conflict.endAt,
                  expiresAt: conflict.expiresAt,
                })),
              });
            } catch (telemetryError) {
              console.error("[capacity.quote] failed to emit strict conflict telemetry (post-insert)", {
                bookingId,
                restaurantId: booking.restaurant_id,
                tableIds: requestedTableIds,
                error: telemetryError instanceof Error ? telemetryError.message : String(telemetryError),
              });
            }

            recordHoldConflictSkip(conflictsAfterInsert, candidateSummary, plan);

            try {
              await releaseTableHold({ holdId: hold.id, client: supabase });
            } catch (releaseError) {
              console.error("[capacity.quote] failed to release conflicting hold after validation", {
                holdId: hold.id,
                bookingId,
                restaurantId: booking.restaurant_id,
                error: releaseError instanceof Error ? releaseError.message : String(releaseError),
              });
            }

            applyQuoteSkipDiagnostics();
            continue;
          }
        } catch (validationError) {
          console.error("[capacity.quote] strict conflict validation errored", {
            bookingId,
            restaurantId: booking.restaurant_id,
            holdId: hold?.id ?? null,
            error: validationError instanceof Error ? validationError.message : String(validationError),
          });
          if (hold?.id) {
            try {
              await releaseTableHold({ holdId: hold.id, client: supabase });
            } catch (releaseError) {
              console.error("[capacity.quote] failed to release hold after validation error", {
                holdId: hold.id,
                bookingId,
                restaurantId: booking.restaurant_id,
                error: releaseError instanceof Error ? releaseError.message : String(releaseError),
              });
            }
          }

          recordHoldConflictSkip(
            hold
              ? [
                  {
                    holdId: hold.id,
                    bookingId,
                    tableIds: requestedTableIds,
                    startAt: requestedWindowStart,
                    endAt: requestedWindowEnd,
                    expiresAt: hold.expiresAt,
                  },
                ]
              : [],
            candidateSummary,
            plan,
          );

          applyQuoteSkipDiagnostics();
          continue;
        }
      }

      const holdDurationMs = highResNow() - holdStart;
      const totalDurationMs = highResNow() - operationStart;

      applyQuoteSkipDiagnostics();
      await emitSelectorQuote({
        restaurantId: booking.restaurant_id,
        bookingId,
        partySize: booking.party_size,
        window: {
          start: requestedWindowStart,
          end: requestedWindowEnd,
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

      const successResult: QuoteTablesResult = {
        hold,
        candidate: candidateSummary,
        alternates,
        nextTimes: [],
        skipped: skippedCandidates,
        metadata: {
          usedFallback: bookingWindowUsedFallback,
          fallbackService: bookingWindowFallbackService,
          relaxedMinPartySize,
          capacityOverflowFallback: capacityOverflowFallbackUsed,
        },
      };
      return attachPlannerStats(successResult, collectPlannerStats());
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

  const failureReason =
    holdConflictSkipCount > 0
      ? 'Hold conflicts prevented all candidates'
      : plans.fallbackReason ?? 'No suitable tables available';
  const failureResult: QuoteTablesResult = {
    hold: null,
    candidate: null,
    alternates,
    nextTimes: [],
    reason: failureReason,
    skipped: skippedCandidates,
    metadata: {
      usedFallback: bookingWindowUsedFallback,
      fallbackService: bookingWindowFallbackService,
      relaxedMinPartySize,
      capacityOverflowFallback: capacityOverflowFallbackUsed,
    },
  };
  return attachPlannerStats(failureResult, collectPlannerStats());
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

  const computeCapacity = (list: Table[]) => list.reduce((sum, table) => sum + (table.capacity ?? 0), 0);
  const filterOptions = (allowMinPartySizeViolation: boolean) => ({
    allowInsufficientCapacity: true,
    allowMinPartySizeViolation,
  });

  let filtered = filterAvailableTables(
    tables,
    booking.party_size,
    window,
    adjacency,
    undefined,
    undefined,
    filterOptions(false),
  );
  let relaxedMinPartyForFind = false;
  if ((filtered.length === 0 || computeCapacity(filtered) < booking.party_size) && booking.party_size > 0) {
    const relaxed = filterAvailableTables(
      tables,
      booking.party_size,
      window,
      adjacency,
      undefined,
      undefined,
      filterOptions(true),
    );
    if (relaxed.length > 0 && computeCapacity(relaxed) >= booking.party_size) {
      filtered = relaxed;
      relaxedMinPartyForFind = true;
    }
  }
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
  let plans = buildScoredTablePlans({
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
    allowMinPartySizeViolation: relaxedMinPartyForFind,
  });

  if (plans.plans.length === 0) {
    plans = buildScoredTablePlans({
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
      allowCapacityOverflow: true,
      allowMinPartySizeViolation: relaxedMinPartyForFind,
    });
  }

  return plans.plans;
}
