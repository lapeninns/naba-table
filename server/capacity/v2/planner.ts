import { buildScoredTablePlans, type BuildCandidatesResult, type BuildCandidatesOptions } from "../selector";

import type { SelectorScoringConfig } from "../policy";
import type { Table } from "../tables";

export type PlannerInput = {
  tables: Table[];
  partySize: number;
  adjacency: Map<string, Set<string>>;
  config: SelectorScoringConfig;
  enableCombinations: boolean;
  kMax: number;
  requireAdjacency: boolean;
  maxPlansPerSlack?: number;
  maxCombinationEvaluations?: number;
  demandMultiplier?: number;
  tableScarcityScores?: Map<string, number>;
};

export type PlannerResult = BuildCandidatesResult;

export function generateCandidatePlans(input: PlannerInput): PlannerResult {
  return buildScoredTablePlans(toBuildCandidatesOptions(input));
}

function toBuildCandidatesOptions(input: PlannerInput): BuildCandidatesOptions {
  return {
    tables: input.tables,
    partySize: input.partySize,
    adjacency: input.adjacency,
    config: input.config,
    enableCombinations: input.enableCombinations,
    kMax: input.kMax,
    requireAdjacency: input.requireAdjacency,
    maxPlansPerSlack: input.maxPlansPerSlack,
    maxCombinationEvaluations: input.maxCombinationEvaluations,
    demandMultiplier: input.demandMultiplier,
    tableScarcityScores: input.tableScarcityScores,
  };
}
