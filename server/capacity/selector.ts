import type { SelectorScoringConfig, SelectorScoringWeights } from "./policy";
import type { Table } from "./tables";

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
};

export type CandidateDiagnostics = {
  singlesConsidered: number;
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

const FALLBACK_NO_TABLES = "No tables meet the capacity requirements for this party size.";

export function buildScoredTablePlans(options: BuildCandidatesOptions): BuildCandidatesResult {
  const { tables, partySize, config } = options;
  const { maxOverage, weights } = config;

  const plans: RankedTablePlan[] = [];
  const diagnostics: CandidateDiagnostics = {
    singlesConsidered: 0,
    skipped: Object.create(null) as Record<string, number>,
  };

  const maxAllowedCapacity = partySize + Math.max(maxOverage, 0);

  const singleTableCandidates = tables.filter((table) => {
    const capacity = table.capacity ?? 0;
    if (!Number.isFinite(capacity) || capacity <= 0) {
      return false;
    }
    if (capacity < partySize) {
      return false;
    }
    if (capacity > maxAllowedCapacity) {
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
    });
  }

  plans.sort((a, b) => comparePlans(a, b, weights));

  const fallbackReason = plans.length > 0 ? undefined : FALLBACK_NO_TABLES;

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
