import { getAllocatorAdjacencyMode, type AdjacencyMode } from "@/server/feature-flags";

import { evaluateAdjacency, isAdjacencySatisfied, summarizeAdjacencyStatus } from "./adjacency";

import type { SelectorScoringConfig, SelectorScoringWeights } from "./policy";
import type { Table } from "./tables";

const DIAGNOSTIC_SKIP_KEYS = [
  "capacity",
  "overage",
  "adjacency",
  "adjacency_pairwise",
  "adjacency_neighbors",
  "kmax",
  "zone",
  "limit",
  "bucket",
  "adjacency_frontier",
  "capacity_upper_bound",
  "timeout",
  // Applied when we restrict which base seeds we start DFS from
  "seed_limit",
] as const;

const DEFAULT_ENUMERATION_TIMEOUT_MS = 1_000;

type DiagnosticSkipKey = (typeof DIAGNOSTIC_SKIP_KEYS)[number];

type DiagnosticSkipCounts = Record<DiagnosticSkipKey, number> & Record<string, number>;

export type CandidateMetrics = {
  overage: number;
  tableCount: number;
  fragmentation: number;
  zoneBalance: number;
  adjacencyCost: number;
  scarcityScore: number;
};

export type ScoreBreakdown = {
  slackPenalty: number;
  demandMultiplier: number;
  scarcityPenalty: number;
  combinationPenalty: number;
  structuralPenalty: number;
  futureConflictPenalty: number;
  total: number;
};

export type RankedTablePlan = {
  tables: Table[];
  totalCapacity: number;
  slack: number;
  metrics: CandidateMetrics;
  score: number;
  tableKey: string;
  adjacencyStatus: "single" | "connected" | "neighbors" | "pairwise" | "disconnected";
  scoreBreakdown: ScoreBreakdown;
};

export type CandidateDiagnostics = {
  singlesConsidered: number;
  combinationsEnumerated: number;
  combinationsAccepted: number;
  skipped: DiagnosticSkipCounts;
  limits: {
    kMax: number;
    maxPlansPerSlack: number;
    maxCombinationEvaluations: number;
    enumerationTimeoutMs?: number;
  };
  totals: {
    enumerated: number;
    accepted: number;
  };
  timePruning?: {
    prunedByTime: number;
    candidatesAfterTimePrune: number;
    pruned_by_time: number;
    candidates_after_time_prune: number;
  };
  quoteSkips?: {
    holdConflicts: {
      count: number;
      holdIds: string[];
    };
  };
  performance?: {
    totalDurationMs: number;
    buildScoredTablePlansMs: number;
    enumerateCombinationsMs?: number;
    sortingMs?: number;
    inputSize: {
      tableCount: number;
      partySize: number;
      validTablesCount: number;
      singleTableCandidatesCount: number;
    };
    iterations: {
      totalEvaluations: number;
      dfsIterations?: number;
      earlyExit: boolean;
      earlyExitReason?: string;
      seedLimitApplied?: boolean;
      seedsConsidered?: number;
    };
  };
  lookahead?: {
    enabled: boolean;
    evaluationMs: number;
    futureBookingsConsidered: number;
    penalizedPlans: number;
    totalPenalty: number;
    windowMinutes: number;
    conflicts: Array<{ bookingId: string; planKey: string }>;
    blockedPlans: string[];
    hardBlockTriggered: boolean;
    plansConsidered?: number;
    plansEvaluated?: number;
    timeBudgetHit?: boolean;
    precheckedConflicts?: number;
  };
};

export type BuildCandidatesOptions = {
  tables: Table[];
  partySize: number;
  adjacency: Map<string, Set<string>>;
  config: SelectorScoringConfig;
  enableCombinations?: boolean;
  kMax?: number;
  maxPlansPerSlack?: number;
  maxCombinationEvaluations?: number;
  enumerationTimeoutMs?: number;
  requireAdjacency?: boolean;
  demandMultiplier?: number;
  tableScarcityScores?: Map<string, number>;
  allowCapacityOverflow?: boolean;
  allowMinPartySizeViolation?: boolean;
};

export type BuildCandidatesResult = {
  plans: RankedTablePlan[];
  fallbackReason?: string;
  diagnostics: CandidateDiagnostics;
};

const FALLBACK_NO_TABLES = "No tables meet the capacity requirements for this party size.";
const DEFAULT_MAX_PLANS_PER_SLACK = 50;
const DEFAULT_MAX_COMBINATION_EVALUATIONS = 500;

function createSkipCounts(): DiagnosticSkipCounts {
  return DIAGNOSTIC_SKIP_KEYS.reduce((accumulator, key) => {
    accumulator[key] = 0;
    return accumulator;
  }, Object.create(null) as DiagnosticSkipCounts);
}

function incrementCounter(target: Record<string, number>, key: string, amount = 1): void {
  const current = target[key] ?? 0;
  target[key] = current + amount;
}

export function buildScoredTablePlans(options: BuildCandidatesOptions): BuildCandidatesResult {
  const durationStartMs = performance.now();
  const DEBUG = process.env.CAPACITY_DEBUG === '1' || process.env.CAPACITY_DEBUG === 'true';

  const {
    tables,
    partySize,
    adjacency,
    config,
    enableCombinations = false,
    kMax,
    maxPlansPerSlack,
    maxCombinationEvaluations,
    enumerationTimeoutMs,
    requireAdjacency = true,
    demandMultiplier: inputDemandMultiplier,
    tableScarcityScores: providedScarcityScores,
    allowCapacityOverflow = false,
    allowMinPartySizeViolation = false,
  } = options;
  const { maxOverage, weights } = config;
  const demandMultiplier = normalizeDemandMultiplier(inputDemandMultiplier);
  const tableScarcityScores = providedScarcityScores ?? computeTableScarcityScores(tables);
  const adjacencyMode = getAllocatorAdjacencyMode();

  const maxAllowedCapacity = partySize + Math.max(maxOverage, 0);
  const effectiveCapacityCap = allowCapacityOverflow ? Number.POSITIVE_INFINITY : maxAllowedCapacity;
  const combinationCap = Math.max(1, Math.min(kMax ?? config.maxTables ?? 1, tables.length || 1));
  const perSlackLimit = Math.max(1, maxPlansPerSlack ?? DEFAULT_MAX_PLANS_PER_SLACK);
  const combinationEvaluationLimit = Math.max(1, maxCombinationEvaluations ?? DEFAULT_MAX_COMBINATION_EVALUATIONS);
  const diagnostics: CandidateDiagnostics = {
    singlesConsidered: 0,
    combinationsEnumerated: 0,
    combinationsAccepted: 0,
    skipped: createSkipCounts(),
    limits: {
      kMax: combinationCap,
      maxPlansPerSlack: perSlackLimit,
      maxCombinationEvaluations: combinationEvaluationLimit,
      enumerationTimeoutMs: Math.max(50, enumerationTimeoutMs ?? DEFAULT_ENUMERATION_TIMEOUT_MS),
    },
    totals: {
      enumerated: 0,
      accepted: 0,
    },
  };

  const validTables: Table[] = [];
  const singleTableCandidates: Table[] = [];

  for (const table of tables) {
    const capacity = table.capacity ?? 0;
    if (!Number.isFinite(capacity) || capacity <= 0) {
      incrementCounter(diagnostics.skipped, "capacity");
      continue;
    }

    if (
      !allowMinPartySizeViolation &&
      typeof table.minPartySize === "number" &&
      table.minPartySize > 0 &&
      partySize < table.minPartySize
    ) {
      incrementCounter(diagnostics.skipped, "capacity");
      continue;
    }

    // FIX: maxPartySize should only apply to single-table assignments, not combinations
    // For combinations, we need to allow tables with maxPartySize < partySize
    // because they can be combined with other tables to meet the party size
    const canUseSingle = !(typeof table.maxPartySize === "number" && table.maxPartySize > 0 && partySize > table.maxPartySize);
    
    // Skip this table entirely only if it also can't contribute to combinations
    // (e.g., if combinations are disabled AND it violates maxPartySize for singles)
    if (!canUseSingle && !enableCombinations) {
      incrementCounter(diagnostics.skipped, "capacity");
      continue;
    }

    if (capacity > effectiveCapacityCap) {
      incrementCounter(diagnostics.skipped, "overage");
      continue;
    }

    validTables.push(table);

    // Only add to single-table candidates if it can be used as a single table
    // AND has sufficient capacity for the party
    if (canUseSingle && capacity >= partySize) {
      singleTableCandidates.push(table);
    }
  }

  diagnostics.singlesConsidered = singleTableCandidates.length;

  if (DEBUG) {
    console.log('[selector] Party size:', partySize);
    console.log('[selector] Valid tables for combinations:', validTables.length);
    console.log('[selector] Single-table candidates:', singleTableCandidates.length);
    console.log('[selector] Enable combinations:', enableCombinations);
    console.log('[selector] k-max:', combinationCap);
  }

  const plans: RankedTablePlan[] = [];

  for (const table of singleTableCandidates) {
    const adjacencyDepths = new Map<string, number>([[table.id, 0]]);
    const metrics = computeMetrics([table], partySize, adjacencyDepths, tableScarcityScores);
    const { score, breakdown } = computeScore(metrics, weights, demandMultiplier);
    const totalCapacity = metrics.overage + partySize;
    const tableKey = buildTableKey([table]);

    plans.push({
      tables: [table],
      totalCapacity,
      slack: metrics.overage,
      metrics,
      score,
      tableKey,
      adjacencyStatus: "single",
      scoreBreakdown: breakdown,
    });
  }

  let enumerateCombinationsMs: number | undefined;
  let dfsIterations: number | undefined;
  let earlyExit = false;
  let earlyExitReason: string | undefined;

  if (enableCombinations && combinationCap > 1 && validTables.length > 1) {
    const combinationStartTime = performance.now();
    const combinationPlans = enumerateCombinationPlans({
      candidates: validTables,
      partySize,
      weights,
      adjacency,
      maxAllowedCapacity: effectiveCapacityCap,
      kMax: combinationCap,
      bucketLimit: perSlackLimit,
      evaluationLimit: combinationEvaluationLimit,
      diagnostics,
      requireAdjacency,
      adjacencyMode,
      tableScarcityScores,
      demandMultiplier,
    });
    enumerateCombinationsMs = performance.now() - combinationStartTime;

    // Check if early exit occurred
    if (diagnostics.combinationsEnumerated > 0) {
      dfsIterations = diagnostics.combinationsEnumerated;
      const limitSkipped = diagnostics.skipped.limit ?? 0;
      if (limitSkipped > 0) {
        earlyExit = true;
        earlyExitReason = `evaluation_limit_reached (${combinationEvaluationLimit})`;
      }
    }

    plans.push(...combinationPlans);
  }

  const sortStartTime = performance.now();
  plans.sort((a, b) => comparePlans(a, b, weights));
  const sortingMs = performance.now() - sortStartTime;

  const fallbackReason = plans.length > 0 ? undefined : FALLBACK_NO_TABLES;

  diagnostics.totals.enumerated = diagnostics.combinationsEnumerated + diagnostics.singlesConsidered;
  diagnostics.totals.accepted = plans.length;

  const totalDurationMs = performance.now() - durationStartMs;

  // Add performance metrics to diagnostics
  diagnostics.performance = {
    totalDurationMs,
    buildScoredTablePlansMs: totalDurationMs,
    enumerateCombinationsMs,
    sortingMs,
    inputSize: {
      tableCount: tables.length,
      partySize,
      validTablesCount: validTables.length,
      singleTableCandidatesCount: singleTableCandidates.length,
    },
    iterations: {
      totalEvaluations: diagnostics.combinationsEnumerated + diagnostics.singlesConsidered,
      dfsIterations,
      earlyExit,
      earlyExitReason,
      seedLimitApplied: (diagnostics.skipped.seed_limit ?? 0) > 0,
      seedsConsidered:
        (diagnostics.skipped.seed_limit ?? 0) > 0
          ? Math.max(0, validTables.length - (diagnostics.skipped.seed_limit ?? 0))
          : validTables.length,
    },
  };

  if (DEBUG) {
    console.warn('[capacity.debug][selector] plans built', {
      inputTables: tables.length,
      partySize,
      validTables: diagnostics.performance.inputSize.validTablesCount,
      singlesConsidered: diagnostics.singlesConsidered,
      combosEnumerated: diagnostics.combinationsEnumerated,
      combosAccepted: diagnostics.combinationsAccepted,
      plans: plans.length,
      fallbackReason,
      durationMs: totalDurationMs,
      limits: diagnostics.limits,
    });
  }

  // Log performance warning if selector exceeds threshold (Sprint 0 - T0.2)
  const SELECTOR_PERF_THRESHOLD_MS = 500;
  if (totalDurationMs > SELECTOR_PERF_THRESHOLD_MS) {
    console.warn("[PERF] buildScoredTablePlans exceeded threshold", {
      durationMs: totalDurationMs,
      threshold: SELECTOR_PERF_THRESHOLD_MS,
      inputSize: diagnostics.performance.inputSize,
      iterations: diagnostics.performance.iterations,
      enumerateCombinationsMs,
      sortingMs,
      enableCombinations,
      kMax: combinationCap,
      evaluationLimit: combinationEvaluationLimit,
    });
  }

  return { plans, fallbackReason, diagnostics };
}

function computeMetrics(
  tables: Table[],
  partySize: number,
  adjacencyDepths: Map<string, number>,
  tableScarcityScores: Map<string, number>,
): CandidateMetrics {
  const capacities = tables.map((table) => table.capacity ?? 0);
  const totalCapacity = capacities.reduce((sum, capacity) => sum + capacity, 0);
  const maxCapacity = capacities.length > 0 ? Math.max(...capacities) : 0;
  const overage = Math.max(totalCapacity - partySize, 0);
  const fragmentation = Math.max(totalCapacity - maxCapacity, 0);
  const zoneIds = new Set(tables.map((table) => table.zoneId ?? null));
  const zoneBalance = Math.max(zoneIds.size - 1, 0);
  const depthValues = adjacencyDepths.size > 0 ? [...adjacencyDepths.values()] : [0];
  let adjacencyCost = Math.max(...depthValues);
  if (adjacencyDepths.size < tables.length) {
    adjacencyCost = Math.max(adjacencyCost, tables.length);
  }
  const scarcityScore = tables.reduce((sum, table) => sum + (tableScarcityScores.get(table.id) ?? 0), 0);

  return {
    overage,
    tableCount: tables.length,
    fragmentation,
    zoneBalance,
    adjacencyCost,
    scarcityScore,
  };
}

function computeScore(
  metrics: CandidateMetrics,
  weights: SelectorScoringWeights,
  demandMultiplier: number,
): { score: number; breakdown: ScoreBreakdown } {
  const normalizedDemandMultiplier = Number.isFinite(demandMultiplier) && demandMultiplier > 0 ? demandMultiplier : 1;
  const baseSlackPenalty = metrics.overage * weights.overage;
  const slackPenalty = baseSlackPenalty * normalizedDemandMultiplier;

  const tableCountPenalty = (metrics.tableCount - 1) * weights.tableCount;
  const fragmentationPenalty = metrics.fragmentation * weights.fragmentation;
  const zoneBalancePenalty = metrics.zoneBalance * weights.zoneBalance;
  const adjacencyPenalty = metrics.adjacencyCost * weights.adjacencyCost;
  const scarcityWeight = Math.max(0, weights.scarcity ?? 0);
  let combinationPenalty = metrics.tableCount > 1 ? tableCountPenalty + adjacencyPenalty : 0;
  if (combinationPenalty > 0 && scarcityWeight > 0 && metrics.tableCount > 0) {
    const averageScarcity = metrics.scarcityScore / metrics.tableCount;
    if (averageScarcity > 0) {
      const scarcityFactor = Math.min(3, 1 + averageScarcity);
      combinationPenalty *= scarcityFactor;
    }
  }
  const structuralPenalty = combinationPenalty + fragmentationPenalty + zoneBalancePenalty;

  const scarcityPenalty = metrics.scarcityScore * scarcityWeight;

  const total = slackPenalty + structuralPenalty + scarcityPenalty;

  return {
    score: total,
    breakdown: {
      slackPenalty,
      demandMultiplier: normalizedDemandMultiplier,
      scarcityPenalty,
      combinationPenalty,
      structuralPenalty,
      futureConflictPenalty: 0,
      total,
    },
  };
}

function comparePlans(a: RankedTablePlan, b: RankedTablePlan, _weights: SelectorScoringWeights): number {
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
}

function normalizeDemandMultiplier(value?: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 1;
  }
  if (value <= 0) {
    return 1;
  }
  return value;
}

function computeTableScarcityScores(tables: Table[]): Map<string, number> {
  const capacityCounts = new Map<number, number>();
  for (const table of tables) {
    const capacity = table.capacity ?? 0;
    if (!Number.isFinite(capacity) || capacity <= 0) {
      continue;
    }
    const current = capacityCounts.get(capacity) ?? 0;
    capacityCounts.set(capacity, current + 1);
  }

  const scores = new Map<string, number>();
  for (const table of tables) {
    const capacity = table.capacity ?? 0;
    if (!Number.isFinite(capacity) || capacity <= 0) {
      scores.set(table.id, 0);
      continue;
    }
    const count = capacityCounts.get(capacity) ?? 0;
    if (count <= 0) {
      scores.set(table.id, 0);
      continue;
    }
    scores.set(table.id, 1 / count);
  }

  return scores;
}

function buildTableKey(tables: Table[]): string {
  return tables
    .map((table) => table.tableNumber ?? table.id)
    .sort((a, b) => a.localeCompare(b))
    .join("+");
}

type CombinationPlannerArgs = {
  candidates: Table[];
  partySize: number;
  weights: SelectorScoringWeights;
  adjacency: Map<string, Set<string>>;
  maxAllowedCapacity: number;
  kMax: number;
  bucketLimit: number;
  evaluationLimit: number;
  diagnostics: CandidateDiagnostics;
  requireAdjacency: boolean;
  adjacencyMode: AdjacencyMode;
  tableScarcityScores: Map<string, number>;
  demandMultiplier: number;
};

/**
 * Enumerates multi-table plans honoring adjacency, kMax, zone-locking, and per-slack limits.
 *
 * Tables are grouped by slack buckets and trimmed to the configured per-slack cap.
 * The search short-circuits when either the evaluation limit, zone guard, or
 * adjacency requirements disqualify further combinations, ensuring consistent
 * diagnostics for skipped plans.
 */
function enumerateCombinationPlans(args: CombinationPlannerArgs): RankedTablePlan[] {
  const {
    candidates,
    partySize,
    weights,
    adjacency,
    maxAllowedCapacity,
    kMax,
    bucketLimit,
    evaluationLimit,
    diagnostics,
    requireAdjacency,
    adjacencyMode,
    tableScarcityScores,
    demandMultiplier,
  } = args;

  if (kMax <= 1) {
    return [];
  }

  const seenKeys = new Set<string>();
  const buckets = new Map<number, RankedTablePlan[]>();
  // Sort by capacity DESC so larger tables (which can satisfy the party alone)
  // are evaluated before the search explores many small-table combinations.
  // This dramatically reduces the DFS branching factor when multiple workers
  // are competing for 6–8 tops, preventing long inline polling loops.
  const sortedCandidates = [...candidates].sort((a, b) => {
    const capacityDiff = (b.capacity ?? 0) - (a.capacity ?? 0);
    if (capacityDiff !== 0) return capacityDiff;
    const nameA = a.tableNumber ?? a.id;
    const nameB = b.tableNumber ?? b.id;
    return nameA.localeCompare(nameB);
  });
  const candidateLookup = new Map(sortedCandidates.map((table) => [table.id, table]));

  const buildFrontier = (selectionIds: Set<string>): Set<string> => {
    const frontierIds = new Set<string>();
    for (const id of selectionIds) {
      const neighbors = adjacency.get(id);
      if (!neighbors) {
        continue;
      }
      for (const neighbor of neighbors) {
        if (!selectionIds.has(neighbor) && candidateLookup.has(neighbor)) {
          frontierIds.add(neighbor);
        }
      }
    }
    return frontierIds;
  };

  const updateFrontierSet = (
    currentFrontier: Set<string> | null,
    selectionIds: Set<string>,
    candidate: Table,
  ): Set<string> => {
    const next = new Set<string>();
    if (currentFrontier) {
      for (const id of currentFrontier) {
        if (!selectionIds.has(id)) {
          next.add(id);
        }
      }
    }
    const neighbors = adjacency.get(candidate.id);
    if (neighbors) {
      for (const neighbor of neighbors) {
        if (!selectionIds.has(neighbor) && candidateLookup.has(neighbor)) {
          next.add(neighbor);
        }
      }
    }
    next.delete(candidate.id);
    return next;
  };

  const gatherCandidateIdsFromIndex = (startIndex: number, selectionIds: Set<string>): string[] => {
    const ids: string[] = [];
    for (let idx = startIndex; idx < sortedCandidates.length; idx += 1) {
      const table = sortedCandidates[idx];
      if (selectionIds.has(table.id)) {
        continue;
      }
      ids.push(table.id);
    }
    return ids;
  };

  const computeCapacityUpperBound = (
    candidateIds: string[],
    remainingSlots: number,
    baseZoneId: string | null,
    selectionIds: Set<string>,
  ): number => {
    if (remainingSlots <= 0) {
      return 0;
    }
    const capacities: number[] = [];
    for (const id of candidateIds) {
      if (selectionIds.has(id)) {
        continue;
      }
      const table = candidateLookup.get(id);
      if (!table) {
        continue;
      }
      if (baseZoneId && table.zoneId && table.zoneId !== baseZoneId) {
        continue;
      }
      capacities.push(table.capacity ?? 0);
    }
    capacities.sort((a, b) => b - a);
    return capacities.slice(0, remainingSlots).reduce((sum, value) => sum + value, 0);
  };

  let evaluations = 0;
  let enumerated = diagnostics.combinationsEnumerated ?? 0;
  let accepted = diagnostics.combinationsAccepted ?? 0;
  let limitRecorded = false;
  let timeoutRecorded = false;
  let stopSearch = false;
  let timedOut = false;
  // Heuristic seed limiting to reduce combinatorial explosion
  // Estimate a reasonable number of starting seeds based on evaluation budget and kMax.
  const estimatedSeeds = Math.max(8, Math.floor(evaluationLimit / Math.max(1, kMax - 1)));
  // For small inputs keep all seeds; otherwise apply the limit.
  const applySeedLimit = sortedCandidates.length > 30 || kMax > 2;
  const maxSeeds = applySeedLimit ? Math.min(sortedCandidates.length, estimatedSeeds) : sortedCandidates.length;

  // Rank seeds (base tables) by a lightweight heuristic to increase early hit rate:
  //  - smaller deficit to partySize is better
  //  - higher adjacency degree is better
  //  - higher capacity as a tiebreaker
  const degreeCache = new Map<string, number>();
  const seedOrder = [...sortedCandidates]
    .map((t) => {
      const cap = t.capacity ?? 0;
      const deficit = Math.max(0, partySize - cap);
      const degree = degreeCache.get(t.id) ?? adjacency.get(t.id)?.size ?? 0;
      degreeCache.set(t.id, degree);
      return { t, deficit, degree, cap };
    })
    .sort((a, b) => {
      if (a.deficit !== b.deficit) return a.deficit - b.deficit;
      if (a.degree !== b.degree) return b.degree - a.degree;
      if (a.cap !== b.cap) return b.cap - a.cap;
      const nA = a.t.tableNumber ?? a.t.id;
      const nB = b.t.tableNumber ?? b.t.id;
      return nA.localeCompare(nB);
    })
    .map((x) => x.t);

  if (applySeedLimit && maxSeeds < sortedCandidates.length) {
    // Record diagnostics on seeds skipped
    incrementCounter(diagnostics.skipped, "seed_limit", sortedCandidates.length - maxSeeds);
  }

  const registerPlan = (plan: RankedTablePlan) => {
    const bucket = buckets.get(plan.slack) ?? [];
    bucket.push(plan);
    bucket.sort((a, b) => comparePlans(a, b, weights));
    if (bucket.length > bucketLimit) {
      bucket.length = bucketLimit;
      incrementCounter(diagnostics.skipped, "bucket");
    }
    buckets.set(plan.slack, bucket);
    accepted += 1;
    diagnostics.combinationsAccepted = accepted;
  };

  const createDfs = (startMs: number, budgetMs: number) => {
    const dfsInner = (
      startIndex: number,
      selection: Table[],
      selectionIds: Set<string>,
      runningCapacity: number,
      baseZoneId: string | null,
      frontier: Set<string> | null,
    ) => {
      if (stopSearch) {
        return;
      }

      if (!timedOut && performance.now() - startMs >= budgetMs) {
        stopSearch = true;
        timedOut = true;
        if (!timeoutRecorded) {
          incrementCounter(diagnostics.skipped, "timeout");
          timeoutRecorded = true;
        }
        return;
      }

      if (requireAdjacency && frontier && frontier.size === 0 && selection.length < kMax) {
        incrementCounter(diagnostics.skipped, "adjacency_frontier");
        return;
      }

      if (selection.length >= 2 && runningCapacity >= partySize) {
        enumerated += 1;
        diagnostics.combinationsEnumerated = enumerated;

        const key = buildTableKey(selection);
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          const selectionIds = selection.map((table) => table.id);
          const adjacencyEvaluation = evaluateAdjacency(selectionIds, adjacency);
          const adjacencySatisfied = !requireAdjacency || isAdjacencySatisfied(adjacencyEvaluation, adjacencyMode);
          if (!adjacencySatisfied) {
            const skipKey =
              adjacencyMode === "pairwise"
                ? "adjacency_pairwise"
                : adjacencyMode === "neighbors"
                  ? "adjacency_neighbors"
                  : "adjacency";
            incrementCounter(diagnostics.skipped, skipKey);
          } else {
            const metrics = computeMetrics(selection, partySize, adjacencyEvaluation.depths, tableScarcityScores);
            const { score, breakdown } = computeScore(metrics, weights, demandMultiplier);
            const totalCapacity = metrics.overage + partySize;
            const adjacencyStatus = summarizeAdjacencyStatus(adjacencyEvaluation, selection.length);
            const plan: RankedTablePlan = {
              tables: [...selection],
              totalCapacity,
              slack: metrics.overage,
              metrics,
              score,
              tableKey: key,
              adjacencyStatus,
              scoreBreakdown: breakdown,
            };
            registerPlan(plan);
          }
        }

        evaluations += 1;
        if (evaluations >= evaluationLimit) {
          stopSearch = true;
          if (!limitRecorded) {
            incrementCounter(diagnostics.skipped, "limit");
            limitRecorded = true;
          }
          return;
        }
      }

      if (selection.length >= kMax) {
        if (runningCapacity < partySize) {
          incrementCounter(diagnostics.skipped, "capacity");
        }
        incrementCounter(diagnostics.skipped, "kmax");
        return;
      }

      const remainingSlots = kMax - selection.length;
      if (remainingSlots > 0) {
        let candidateIdsForUpperBound: string[] = [];
        if (requireAdjacency) {
          candidateIdsForUpperBound = frontier ? Array.from(frontier) : [];
        } else {
          candidateIdsForUpperBound = gatherCandidateIdsFromIndex(startIndex, selectionIds);
        }
        const capacityUpperBound = computeCapacityUpperBound(candidateIdsForUpperBound, remainingSlots, baseZoneId, selectionIds);
        if (runningCapacity + capacityUpperBound < partySize) {
          incrementCounter(diagnostics.skipped, "capacity_upper_bound");
          return;
        }
      }

      for (let index = startIndex; index < sortedCandidates.length; index += 1) {
        if (stopSearch) {
          break;
        }

        const candidate = sortedCandidates[index];

        if (selectionIds.has(candidate.id)) {
          continue;
        }

        if (requireAdjacency && frontier && !frontier.has(candidate.id)) {
          continue;
        }

        if (selection.length > 0 && baseZoneId && candidate.zoneId && candidate.zoneId !== baseZoneId) {
          incrementCounter(diagnostics.skipped, "zone");
          continue;
        }

        if (selection.length + 1 > kMax) {
          incrementCounter(diagnostics.skipped, "kmax");
          continue;
        }

        const nextCapacity = runningCapacity + (candidate.capacity ?? 0);

        if (nextCapacity > maxAllowedCapacity) {
          incrementCounter(diagnostics.skipped, "overage");
          break;
        }

        const nextZoneId = baseZoneId ?? candidate.zoneId ?? null;
        const nextSelection = [...selection, candidate];
        const nextSelectionIds = new Set(selectionIds);
        nextSelectionIds.add(candidate.id);
        const nextFrontier = requireAdjacency ? updateFrontierSet(frontier, nextSelectionIds, candidate) : null;

        dfsInner(index + 1, nextSelection, nextSelectionIds, nextCapacity, nextZoneId, nextFrontier);
      }
    };

    return dfsInner;
  };

  const dfs = createDfs(
    performance.now(),
    diagnostics.limits.enumerationTimeoutMs ?? DEFAULT_ENUMERATION_TIMEOUT_MS,
  );

  const seedLoop = applySeedLimit ? seedOrder.slice(0, maxSeeds) : seedOrder;
  for (let i = 0; i < seedLoop.length && !stopSearch; i += 1) {
    const base = seedLoop[i];
    const baseSelection = [base];
    const baseSelectionIds = new Set<string>([base.id]);
    const baseFrontier = requireAdjacency ? buildFrontier(baseSelectionIds) : null;
    dfs(i + 1, baseSelection, baseSelectionIds, base.capacity ?? 0, base.zoneId ?? null, baseFrontier);
  }

  if (timedOut) {
    console.warn("[selector] combination enumeration timed out", {
      partySize,
      tableCount: sortedCandidates.length,
      timeoutMs: diagnostics.limits.enumerationTimeoutMs ?? DEFAULT_ENUMERATION_TIMEOUT_MS,
      evaluations,
    });
  }

  return Array.from(buckets.values())
    .flat()
    .sort((a, b) => comparePlans(a, b, weights));
}

// evaluateAdjacency implementation lives in server/capacity/adjacency.ts. Keep selector
// focused on search/selection logic and reuse the shared helper to avoid divergence.
