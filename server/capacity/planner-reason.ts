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
  { pattern: /insufficient filtered capacity/i, code: "hard.insufficient_filtered_capacity", category: "hard" },
  { pattern: /no suitable tables/i, code: "hard.no_suitable_tables", category: "hard" },
  { pattern: /no capacity/i, code: "hard.no_capacity", category: "hard" },
  { pattern: /insufficient capacity/i, code: "hard.insufficient_capacity", category: "hard" },
  { pattern: /no table/i, code: "hard.no_tables", category: "hard" },
  { pattern: /insufficient global capacity/i, code: "hard.global_capacity", category: "hard" },
  { pattern: /unable to satisfy max tables/i, code: "hard.max_tables", category: "hard" },
  // A concurrent allocation that trips the allocations_no_overlap exclusion
  // constraint is a hard concurrency conflict, not a transient blip: the slot is
  // genuinely taken. The job surfaces this through the AssignTablesRpcError it
  // throws, so this must classify as hard (and win over the generic /rpc/i
  // transient pattern) so the job backs off the same way the inline path does.
  { pattern: /allocations?_no_overlap/i, code: "hard.allocations_overlap", category: "hard" },
];

const TRANSIENT_FAILURE_PATTERNS: ReasonPattern[] = [
  { pattern: /hold conflict/i, code: "transient.hold_conflict", category: "transient" },
  { pattern: /evaluation limit/i, code: "transient.evaluation_limit", category: "transient" },
  // Genuinely-retryable DB conditions. These are checked BEFORE the hard
  // AssignTablesRpcError name fallback so a transient DB failure wrapped in that
  // error type (the job composes `${name}: ${message}`) still gets retried.
  { pattern: /lock wait/i, code: "transient.lock_wait", category: "transient" },
  { pattern: /deadlock/i, code: "transient.deadlock", category: "transient" },
  { pattern: /serialization failure/i, code: "transient.serialization", category: "transient" },
  { pattern: /timeout/i, code: "transient.timeout", category: "transient" },
  { pattern: /abort/i, code: "transient.abort", category: "transient" },
];

// Hard fallback for the assign-tables RPC error type. The job only had the error
// name (AssignTablesRpcError) available historically, and that name matched the
// broad /rpc/i transient rule -> a genuinely-taken slot was retried up to 4x.
// Treat the RPC error name as hard so the job stops retrying, but only AFTER the
// specific transient DB patterns above so true transient failures remain
// retryable. This intentionally sits ahead of the generic /rpc/i rule below.
const HARD_FALLBACK_PATTERNS: ReasonPattern[] = [
  { pattern: /AssignTablesRpcError/i, code: "hard.assign_tables_rpc", category: "hard" },
];

// Lowest-priority transient catch-alls. A bare "rpc error" with no more specific
// signal is treated as transient, preserving the historical default for
// non-AssignTablesRpcError RPC hiccups.
const TRANSIENT_FALLBACK_PATTERNS: ReasonPattern[] = [
  { pattern: /rpc/i, code: "transient.rpc_error", category: "transient" },
];

const DEFAULT_CLASSIFICATION: PlannerReasonClassification = {
  category: "unknown",
  code: "unknown",
};

export function classifyPlannerReason(reason: string | null | undefined): PlannerReasonClassification {
  if (!reason || reason.trim().length === 0) {
    return DEFAULT_CLASSIFICATION;
  }

  // Ordered by precedence: definitive hard (capacity / overlap) -> specific
  // retryable transient -> hard RPC-name fallback -> generic transient.
  const orderedPatternGroups: ReasonPattern[][] = [
    HARD_FAILURE_PATTERNS,
    TRANSIENT_FAILURE_PATTERNS,
    HARD_FALLBACK_PATTERNS,
    TRANSIENT_FALLBACK_PATTERNS,
  ];

  for (const group of orderedPatternGroups) {
    for (const candidate of group) {
      if (candidate.pattern.test(reason)) {
        return { category: candidate.category, code: candidate.code };
      }
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
