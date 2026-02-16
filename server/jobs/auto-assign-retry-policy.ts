import type { PlannerReasonClassification } from "@/server/capacity/planner-reason";

const DEFER_HARD_STOP_REASON_CODES = new Set<string>([
  "hard.no_tables",
  "hard.no_suitable_tables",
]);

export function shouldDeferHardStop(
  classification: PlannerReasonClassification,
  attemptIndex: number,
): boolean {
  if (classification.category !== "hard") return false;
  if (attemptIndex !== 0) return false;
  return DEFER_HARD_STOP_REASON_CODES.has(classification.code);
}

export function ensureMinimumAttemptsForDeferredHardStop(currentMaxAttempts: number): number {
  if (!Number.isFinite(currentMaxAttempts)) return 2;
  return Math.max(2, Math.floor(currentMaxAttempts));
}
