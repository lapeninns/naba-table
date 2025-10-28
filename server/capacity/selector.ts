import type { SelectorScoringConfig, SelectorScoringWeights } from "./policy";
import type { Table } from "./tables";

const DIAGNOSTIC_SKIP_KEYS = ["capacity", "overage", "adjacency", "kmax", "zone", "limit", "bucket"] as const;

type DiagnosticSkipKey = (typeof DIAGNOSTIC_SKIP_KEYS)[number];

type DiagnosticSkipCounts = Record<DiagnosticSkipKey, number> & Record<string, number>;

export type CandidateMetrics = {
  overage: number;
  tableCount: number;
  fragmentation: number;
  zoneBalance: number;
  adjacencyCost: number;
};

export type RankedTablePlan = {
  tables: Table[];
  totalCapacity: number;
  slack: number;
  metrics: CandidateMetrics;
  score: number;
  tableKey: string;
  adjacencyStatus: "single" | "connected" | "disconnected";
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
  };
  totals: {
    enumerated: number;
    accepted: number;
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
  requireAdjacency?: boolean;
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
  const {
    tables,
    partySize,
    adjacency,
    config,
    enableCombinations = false,
    kMax,
    maxPlansPerSlack,
    maxCombinationEvaluations,
    requireAdjacency = true,
  } = options;
  const { maxOverage, weights } = config;

  const maxAllowedCapacity = partySize + Math.max(maxOverage, 0);
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

    if (typeof table.minPartySize === "number" && table.minPartySize > 0 && partySize < table.minPartySize) {
      incrementCounter(diagnostics.skipped, "capacity");
      continue;
    }

    if (typeof table.maxPartySize === "number" && table.maxPartySize > 0 && partySize > table.maxPartySize) {
      incrementCounter(diagnostics.skipped, "capacity");
      continue;
    }

    if (capacity > maxAllowedCapacity) {
      incrementCounter(diagnostics.skipped, "overage");
      continue;
    }

    validTables.push(table);

    if (capacity >= partySize) {
      singleTableCandidates.push(table);
    }
  }

  diagnostics.singlesConsidered = singleTableCandidates.length;

  const plans: RankedTablePlan[] = [];

  for (const table of singleTableCandidates) {
    const adjacencyDepths = new Map<string, number>([[table.id, 0]]);
    const metrics = computeMetrics([table], partySize, adjacencyDepths);
    const score = computeScore(metrics, weights);
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
    });
  }

  if (enableCombinations && combinationCap > 1 && validTables.length > 1) {
    const combinationPlans = enumerateCombinationPlans({
      candidates: validTables,
      partySize,
      weights,
      adjacency,
      maxAllowedCapacity,
      kMax: combinationCap,
      bucketLimit: perSlackLimit,
      evaluationLimit: combinationEvaluationLimit,
      diagnostics,
      requireAdjacency,
    });

    plans.push(...combinationPlans);
  }

  plans.sort((a, b) => comparePlans(a, b, weights));

  const fallbackReason = plans.length > 0 ? undefined : FALLBACK_NO_TABLES;

  diagnostics.totals.enumerated = diagnostics.combinationsEnumerated + diagnostics.singlesConsidered;
  diagnostics.totals.accepted = plans.length;

  return { plans, fallbackReason, diagnostics };
}

function computeMetrics(tables: Table[], partySize: number, adjacencyDepths: Map<string, number>): CandidateMetrics {
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

  return {
    overage,
    tableCount: tables.length,
    fragmentation,
    zoneBalance,
    adjacencyCost,
  };
}

function computeScore(metrics: CandidateMetrics, weights: SelectorScoringWeights): number {
  return (
    metrics.overage * weights.overage +
    (metrics.tableCount - 1) * weights.tableCount +
    metrics.fragmentation * weights.fragmentation +
    metrics.zoneBalance * weights.zoneBalance +
    metrics.adjacencyCost * weights.adjacencyCost
  );
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
  } = args;

  if (kMax <= 1) {
    return [];
  }

  const seenKeys = new Set<string>();
  const buckets = new Map<number, RankedTablePlan[]>();
  const sortedCandidates = [...candidates].sort((a, b) => {
    const capacityDiff = (a.capacity ?? 0) - (b.capacity ?? 0);
    if (capacityDiff !== 0) {
      return capacityDiff;
    }
    const nameA = a.tableNumber ?? a.id;
    const nameB = b.tableNumber ?? b.id;
    return nameA.localeCompare(nameB);
  });

  let evaluations = 0;
  let enumerated = diagnostics.combinationsEnumerated ?? 0;
  let accepted = diagnostics.combinationsAccepted ?? 0;
  let limitRecorded = false;
  let stopSearch = false;

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

  const dfs = (startIndex: number, selection: Table[], runningCapacity: number, baseZoneId: string | null) => {
    if (stopSearch) {
      return;
    }

    if (selection.length >= 2 && runningCapacity >= partySize) {
      enumerated += 1;
      diagnostics.combinationsEnumerated = enumerated;

      const key = buildTableKey(selection);
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        const adjacencyEvaluation = evaluateAdjacency(selection, adjacency);
        if (!adjacencyEvaluation.connected && requireAdjacency) {
          incrementCounter(diagnostics.skipped, "adjacency");
        } else {
          const metrics = computeMetrics(selection, partySize, adjacencyEvaluation.depths);
          const score = computeScore(metrics, weights);
          const totalCapacity = metrics.overage + partySize;
          const adjacencyStatus: RankedTablePlan["adjacencyStatus"] =
            selection.length <= 1
              ? "single"
              : adjacencyEvaluation.connected
                ? "connected"
                : "disconnected";
          const plan: RankedTablePlan = {
            tables: [...selection],
            totalCapacity,
            slack: metrics.overage,
            metrics,
            score,
            tableKey: key,
            adjacencyStatus,
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

    for (let index = startIndex; index < sortedCandidates.length; index += 1) {
      if (stopSearch) {
        break;
      }

      const candidate = sortedCandidates[index];

      if (selection.some((existing) => existing.id === candidate.id)) {
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
        // Capacities sorted ascending; further entries will exceed as well for this path.
        break;
      }

      if (requireAdjacency && selection.length > 0 && !isAdjacentToSelection(candidate, selection, adjacency)) {
        incrementCounter(diagnostics.skipped, "adjacency");
        continue;
      }

      const nextZoneId = baseZoneId ?? candidate.zoneId ?? null;

      dfs(index + 1, [...selection, candidate], nextCapacity, nextZoneId);
    }
  };

  for (let i = 0; i < sortedCandidates.length && !stopSearch; i += 1) {
    const base = sortedCandidates[i];
    dfs(i + 1, [base], base.capacity ?? 0, base.zoneId ?? null);
  }

  return Array.from(buckets.values())
    .flat()
    .sort((a, b) => comparePlans(a, b, weights));
}

function isAdjacentToSelection(candidate: Table, selection: Table[], adjacency: Map<string, Set<string>>): boolean {
  for (const table of selection) {
    const forward = adjacency.get(table.id);
    if (forward && forward.has(candidate.id)) {
      return true;
    }
    const backward = adjacency.get(candidate.id);
    if (backward && backward.has(table.id)) {
      return true;
    }
  }
  return false;
}

function evaluateAdjacency(
  tables: Table[],
  adjacency: Map<string, Set<string>>,
): { connected: boolean; depths: Map<string, number> } {
  if (tables.length === 0) {
    return { connected: true, depths: new Map() };
  }

  if (tables.length === 1) {
    return { connected: true, depths: new Map([[tables[0].id, 0]]) };
  }

  const tableIds = tables.map((table) => table.id);
  const selection = new Set(tableIds);
  const depths = new Map<string, number>();
  const queue: string[] = [];

  const [firstId] = tableIds;
  queue.push(firstId);
  depths.set(firstId, 0);

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }
    const neighbors = adjacency.get(current);
    if (!neighbors) {
      continue;
    }
    for (const neighbor of neighbors) {
      if (!selection.has(neighbor) || depths.has(neighbor)) {
        continue;
      }
      const depth = (depths.get(current) ?? 0) + 1;
      depths.set(neighbor, depth);
      queue.push(neighbor);
    }
  }

  const connected = depths.size === selection.size;
  return { connected, depths };
}
