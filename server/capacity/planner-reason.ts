import type { PlannerStrategyContext } from "./planner-telemetry";

export type PlannerReasonCategory = "hard" | "transient" | "unknown";

export type PlannerReasonClassification = {
  category: PlannerReasonCategory;
  code: string;
};

type ReasonPattern = {
  pattern: RegExp;
  code: string;
  category: PlannerReasonCategory;
};

const HARD_FAILURE_PATTERNS: ReasonPattern[] = [
  { pattern: /no suitable tables/i, code: "hard.no_suitable_tables", category: "hard" },
  { pattern: /no capacity/i, code: "hard.no_capacity", category: "hard" },
  { pattern: /insufficient capacity/i, code: "hard.insufficient_capacity", category: "hard" },
  { pattern: /no table/i, code: "hard.no_tables", category: "hard" },
  { pattern: /insufficient global capacity/i, code: "hard.global_capacity", category: "hard" },
  { pattern: /unable to satisfy max tables/i, code: "hard.max_tables", category: "hard" },
];

const TRANSIENT_FAILURE_PATTERNS: ReasonPattern[] = [
  { pattern: /hold conflict/i, code: "transient.hold_conflict", category: "transient" },
  { pattern: /timeout/i, code: "transient.timeout", category: "transient" },
  { pattern: /abort/i, code: "transient.abort", category: "transient" },
  { pattern: /rpc/i, code: "transient.rpc_error", category: "transient" },
  { pattern: /lock wait/i, code: "transient.lock_wait", category: "transient" },
];

const DEFAULT_CLASSIFICATION: PlannerReasonClassification = {
  category: "unknown",
  code: "unknown",
};

export function classifyPlannerReason(reason: string | null | undefined): PlannerReasonClassification {
  if (!reason || reason.trim().length === 0) {
    return DEFAULT_CLASSIFICATION;
  }

  for (const candidate of HARD_FAILURE_PATTERNS) {
    if (candidate.pattern.test(reason)) {
      return { category: candidate.category, code: candidate.code };
    }
  }

  for (const candidate of TRANSIENT_FAILURE_PATTERNS) {
    if (candidate.pattern.test(reason)) {
      return { category: candidate.category, code: candidate.code };
    }
  }

  return DEFAULT_CLASSIFICATION;
}

export function isDeterministicPlannerFailure(reason: string | null | undefined): boolean {
  return classifyPlannerReason(reason).category === "hard";
}

export function describePlannerStrategy(strategy: PlannerStrategyContext | undefined): string {
  if (!strategy) return "default";
  const adjacency = strategy.requireAdjacency === null ? "auto" : strategy.requireAdjacency ? "adjacent" : "non_adjacent";
  const maxTables = typeof strategy.maxTables === "number" && !Number.isNaN(strategy.maxTables) ? strategy.maxTables : "auto";
  return `${adjacency}|max_tables:${maxTables}`;
}
