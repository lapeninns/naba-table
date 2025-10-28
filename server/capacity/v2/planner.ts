import { buildScoredTablePlans, type BuildCandidatesResult } from "../selector";
import type { Table } from "../tables";
import type { SelectorScoringConfig } from "../policy";

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
};

export type PlannerResult = BuildCandidatesResult;

export function generateCandidatePlans(input: PlannerInput): PlannerResult {
  return buildScoredTablePlans({
    tables: input.tables,
    partySize: input.partySize,
    adjacency: input.adjacency,
    config: input.config,
    enableCombinations: input.enableCombinations,
    kMax: input.kMax,
    requireAdjacency: input.requireAdjacency,
    maxPlansPerSlack: input.maxPlansPerSlack,
    maxCombinationEvaluations: input.maxCombinationEvaluations,
  });
}
