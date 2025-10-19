import type { Table } from "./tables";
import type { SelectorScoringConfig, SelectorScoringWeights } from "./policy";

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
  mergeType: "single" | "merge";
  metrics: CandidateMetrics;
  score: number;
  tableKey: string;
};

export type CandidateDiagnostics = {
  singlesConsidered: number;
  mergeCombosEvaluated: number;
  skipped: Record<string, number>;
};

export type BuildCandidatesOptions = {
  tables: Table[];
  partySize: number;
  adjacency: Map<string, Set<string>>;
  config: SelectorScoringConfig;
};

export type BuildCandidatesResult = {
  plans: RankedTablePlan[];
  fallbackReason?: string;
  diagnostics: CandidateDiagnostics;
};

type CandidateState = {
  tables: Table[];
  totalCapacity: number;
  adjacencyDepths: Map<string, number>;
  zoneId: string | null;
};

const FALLBACK_NO_TABLES = "No tables meet the capacity requirements for this party size.";
const FALLBACK_NO_MERGE = "Unable to find an adjacency-connected merge of up to three tables within the allowed overage.";

function deriveMergeFallback(diagnostics: CandidateDiagnostics): string {
  const adjacencyIssues =
    (diagnostics.skipped["no_adjacency"] ?? 0) +
    (diagnostics.skipped["adjacent_table_unavailable"] ?? 0) +
    (diagnostics.skipped["cross_zone"] ?? 0);

  if (adjacencyIssues > 0) {
    return "Merge requires adjacency-connected, same-zone tables.";
  }

  if ((diagnostics.skipped["merge_ineligible"] ?? 0) > 0) {
    return "Merge candidates must be marked as merge-eligible for this restaurant.";
  }

  if ((diagnostics.skipped["overage_limit"] ?? 0) > 0) {
    return "Merge combinations exceed the configured overage allowance.";
  }

  return FALLBACK_NO_MERGE;
}

export function buildScoredTablePlans(options: BuildCandidatesOptions): BuildCandidatesResult {
  const { tables, partySize, adjacency, config } = options;
  const { maxOverage, maxTables, weights } = config;

  const tableById = new Map<string, Table>(tables.map((table) => [table.id, table]));
  const plans: RankedTablePlan[] = [];
  const diagnostics: CandidateDiagnostics = {
    singlesConsidered: 0,
    mergeCombosEvaluated: 0,
    skipped: Object.create(null) as Record<string, number>,
  };

  const maxAllowedCapacity = partySize + Math.max(maxOverage, 0);

  const registerPlan = (candidate: Table[], mergeType: "single" | "merge", adjacencyDepths: Map<string, number>) => {
    const metrics = computeMetrics(candidate, partySize, adjacencyDepths);
    const score = computeScore(metrics, weights);
    const totalCapacity = metrics.overage + partySize;
    const tableKey = buildTableKey(candidate);
    plans.push({
      tables: candidate,
      totalCapacity,
      slack: metrics.overage,
      mergeType,
      metrics,
      score,
      tableKey,
    });
  };

  // Evaluate single tables first
  const singleTableCandidates = tables.filter((table) => {
    if (!Number.isFinite(table.capacity) || (table.capacity ?? 0) <= 0) {
      return false;
    }
    if ((table.capacity ?? 0) < partySize) {
      return false;
    }
    if (typeof table.maxPartySize === "number" && table.maxPartySize > 0 && partySize > table.maxPartySize) {
      return false;
    }
    return true;
  });

  diagnostics.singlesConsidered = singleTableCandidates.length;

  for (const table of singleTableCandidates) {
    const adjacencyDepths = new Map<string, number>([[table.id, 0]]);
    registerPlan([table], "single", adjacencyDepths);
  }

  // BFS for merge combinations up to maxTables
  if (maxTables > 1) {
    const seen = new Set<string>();
    const queue: CandidateState[] = [];

    for (const table of tables) {
      if (!table.mergeEligible) {
        continue;
      }
      const adjacencyDepths = new Map<string, number>([[table.id, 0]]);
      const state: CandidateState = {
        tables: [table],
        totalCapacity: table.capacity ?? 0,
        adjacencyDepths,
        zoneId: table.zoneId ?? null,
      };
      queue.push(state);
    }

    while (queue.length > 0) {
      const state = queue.shift()!;

      if (state.tables.length >= maxTables) {
        continue;
      }

      const alreadyIncluded = new Set(state.tables.map((table) => table.id));

      for (const existingTable of state.tables) {
        const neighbours = adjacency.get(existingTable.id);
        if (!neighbours || neighbours.size === 0) {
          incrementSkip(diagnostics.skipped, "no_adjacency");
          continue;
        }

        for (const neighbourId of neighbours) {
          if (alreadyIncluded.has(neighbourId)) {
            continue;
          }
          const neighbour = tableById.get(neighbourId);
          if (!neighbour) {
            incrementSkip(diagnostics.skipped, "adjacent_table_unavailable");
            continue;
          }

          if (!neighbour.mergeEligible) {
            incrementSkip(diagnostics.skipped, "merge_ineligible");
            continue;
          }

          const neighbourCapacity = neighbour.capacity ?? 0;
          if (!Number.isFinite(neighbourCapacity) || neighbourCapacity <= 0) {
            incrementSkip(diagnostics.skipped, "invalid_capacity");
            continue;
          }

          if (state.zoneId && neighbour.zoneId && neighbour.zoneId !== state.zoneId) {
            incrementSkip(diagnostics.skipped, "cross_zone");
            continue;
          }

          const totalCapacity = state.totalCapacity + neighbourCapacity;
          if (totalCapacity > maxAllowedCapacity) {
            incrementSkip(diagnostics.skipped, "overage_limit");
            continue;
          }

          const adjacencyDepths = new Map(state.adjacencyDepths);
          const parentDepth = adjacencyDepths.get(existingTable.id) ?? 0;
          const currentDepth = adjacencyDepths.get(neighbour.id);
          const candidateDepth = parentDepth + 1;
          if (currentDepth === undefined || candidateDepth < currentDepth) {
            adjacencyDepths.set(neighbour.id, candidateDepth);
          }

          const nextTables = [...state.tables, neighbour];
          const comboKey = buildIdKey(nextTables);
          if (seen.has(comboKey)) {
            continue;
          }
          seen.add(comboKey);

          const nextState: CandidateState = {
            tables: nextTables,
            totalCapacity,
            adjacencyDepths,
            zoneId: state.zoneId ?? neighbour.zoneId ?? null,
          };

          queue.push(nextState);
          diagnostics.mergeCombosEvaluated += 1;

          if (totalCapacity >= partySize) {
            registerPlan(nextTables, "merge", adjacencyDepths);
          }
        }
      }
    }
  }

  plans.sort((a, b) => comparePlans(a, b, weights));

  const fallbackReason =
    plans.length > 0
      ? undefined
      : singleTableCandidates.length === 0
        ? FALLBACK_NO_TABLES
        : deriveMergeFallback(diagnostics);

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
  const adjacencyCost = Math.max(...(adjacencyDepths.size > 0 ? [...adjacencyDepths.values()] : [0]));

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

function comparePlans(a: RankedTablePlan, b: RankedTablePlan, weights: SelectorScoringWeights): number {
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

function buildIdKey(tables: Table[]): string {
  return tables
    .map((table) => table.id)
    .sort((a, b) => a.localeCompare(b))
    .join("|");
}

function incrementSkip(skipped: Record<string, number>, key: string) {
  skipped[key] = (skipped[key] ?? 0) + 1;
}
