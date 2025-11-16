import { env } from "@/lib/env";
import { isAssignmentPipelineRuntimeDisabled } from "@/server/assignments/runtime-guard";
import { getFeatureFlagOverride, type FeatureFlagKey } from "@/server/feature-flags-overrides";

export type AdjacencyMode = "connected" | "pairwise" | "neighbors";

const loyaltyPilotIds = new Set(
  (env.featureFlags.loyaltyPilotRestaurantIds ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0),
);

const issuedSafetyWarnings = new Set<string>();

function warnUnsafeFeatureFlag(message: string, context: Record<string, unknown>): void {
  if (issuedSafetyWarnings.has(message)) {
    return;
  }
  issuedSafetyWarnings.add(message);
  console.warn("[feature-flags][safety]", { message, ...context });
}

function isProductionEnv(): boolean {
  return env.node.env === "production";
}

function resolveFeatureFlag(flag: FeatureFlagKey, fallback: boolean): boolean {
  const override = getFeatureFlagOverride(flag);
  if (typeof override === "boolean") {
    return override;
  }
  return fallback;
}

export function isLoyaltyPilotRestaurant(restaurantId: string): boolean {
  if (!restaurantId) return false;
  return loyaltyPilotIds.has(restaurantId);
}

export function isAllocationsDualWriteEnabled(): boolean {
  return env.featureFlags.allocationsDualWrite ?? false;
}

export function isSelectorScoringEnabled(): boolean {
  return env.featureFlags.selectorScoring ?? false;
}

export function isSelectorLookaheadEnabled(): boolean {
  // Debug override: allow disabling via env for rapid bisection
  if (process.env.CAPACITY_DISABLE_LOOKAHEAD === 'true' || process.env.CAPACITY_DISABLE_LOOKAHEAD === '1') {
    return false;
  }
  return env.featureFlags.selectorLookahead?.enabled ?? false;
}

export function getSelectorLookaheadWindowMinutes(): number {
  return env.featureFlags.selectorLookahead?.windowMinutes ?? 120;
}

export function getSelectorLookaheadPenaltyWeight(): number {
  return env.featureFlags.selectorLookahead?.penaltyWeight ?? 500;
}

export function getSelectorLookaheadBlockThreshold(): number {
  return env.featureFlags.selectorLookahead?.blockThreshold ?? 0;
}

export function isCombinationPlannerEnabled(): boolean {
  return env.featureFlags.combinationPlanner ?? false;
}

export function isAdjacencyValidationEnabled(): boolean {
  return env.featureFlags.adjacencyValidation ?? false;
}

export function isOpsMetricsEnabled(): boolean {
  return env.featureFlags.opsMetrics ?? false;
}

export function isOpsRejectionAnalyticsEnabled(): boolean {
  return env.featureFlags.opsRejectionAnalytics ?? false;
}

export function isHoldsEnabled(): boolean {
  return env.featureFlags.holds.enabled ?? true;
}

export function isAllocatorMergesEnabled(): boolean {
  return env.featureFlags.allocator.mergesEnabled ?? !isProductionEnv();
}

export function isPlannerTimePruningEnabled(): boolean {
  // Debug override: allow disabling via env for rapid bisection
  if (process.env.CAPACITY_DISABLE_TIME_PRUNING === 'true' || process.env.CAPACITY_DISABLE_TIME_PRUNING === '1') {
    return false;
  }
  const defaultValue = env.featureFlags.planner?.timePruningEnabled ?? false;
  return resolveFeatureFlag("planner.time_pruning.enabled", defaultValue);
}

export function isAllocatorV2ForceLegacy(): boolean {
  return env.featureFlags.allocatorV2?.forceLegacy ?? false;
}

export function isAllocatorV2Enabled(): boolean {
  if (isAllocatorV2ForceLegacy()) {
    return false;
  }
  return env.featureFlags.allocatorV2?.enabled ?? false;
}

export function isAllocatorV2ShadowMode(): boolean {
  if (isAllocatorV2ForceLegacy()) {
    return false;
  }
  return env.featureFlags.allocatorV2?.shadow ?? false;
}

export function isAllocatorAdjacencyRequired(): boolean {
  return env.featureFlags.allocator.requireAdjacency ?? true;
}

export function isAllocatorServiceFailHard(): boolean {
  const defaultValue = env.featureFlags.allocator?.service?.failHard ?? false;
  return resolveFeatureFlag("allocator.service.fail_hard", defaultValue);
}

export function getAllocatorKMax(): number {
  const configured = env.featureFlags.allocator.kMax ?? 3;
  return Math.max(1, Math.min(configured, 5));
}

export function getAllocatorAdjacencyMinPartySize(): number | null {
  const value = env.featureFlags.allocator.adjacencyMinPartySize;
  return typeof value === "number" ? value : null;
}

export function getAllocatorAdjacencyMode(): AdjacencyMode {
  const value = env.featureFlags.allocator.adjacencyMode;
  if (value === "pairwise" || value === "neighbors") {
    return value;
  }
  return "connected";
}

export function getManualAssignmentMaxSlack(): number | null {
  const value = env.featureFlags.manualAssignments?.maxSlack;
  return typeof value === "number" ? value : null;
}

export function getSelectorPlannerLimits(): {
  maxPlansPerSlack?: number;
  maxCombinationEvaluations?: number;
  enumerationTimeoutMs?: number;
} {
  const { selector } = env.featureFlags;
  const maxPlansPerSlack =
    typeof selector?.maxPlansPerSlack === "number" ? selector.maxPlansPerSlack : undefined;
  const maxCombinationEvaluations =
    typeof selector?.maxCombinationEvaluations === "number" ? selector.maxCombinationEvaluations : undefined;
  const enumerationTimeoutMs =
    typeof selector?.enumerationTimeoutMs === "number" ? selector.enumerationTimeoutMs : undefined;
  return {
    ...(maxPlansPerSlack ? { maxPlansPerSlack } : {}),
    ...(maxCombinationEvaluations ? { maxCombinationEvaluations } : {}),
    ...(enumerationTimeoutMs ? { enumerationTimeoutMs } : {}),
  };
}

export function isHoldStrictConflictsEnabled(): boolean {
  const defaultValue = env.featureFlags.holds?.strictConflicts ?? false;
  return resolveFeatureFlag("holds.strict_conflicts.enabled", defaultValue);
}

export function isAdjacencyQueryUndirected(): boolean {
  const defaultValue = env.featureFlags.adjacency?.queryUndirected ?? true;
  return resolveFeatureFlag("adjacency.query.undirected", defaultValue);
}

export function getContextQueryPaddingMinutes(): number {
  // Narrow context queries to +/- X minutes around booking window
  // Defaults to 60 minutes if not configured
  const value = env.featureFlags.context?.queryPaddingMinutes;
  if (typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 240) {
    return Math.floor(value);
  }
  return 60;
}

export function isAssignmentPipelineV3Enabled(): boolean {
  if (isAssignmentPipelineRuntimeDisabled()) {
    return false;
  }
  return env.featureFlags.assignmentPipeline?.enabled ?? false;
}

export function isAssignmentPipelineV3ShadowMode(): boolean {
  if (isAssignmentPipelineRuntimeDisabled()) {
    return false;
  }
  return env.featureFlags.assignmentPipeline?.shadow ?? false;
}

export function getAssignmentPipelineMaxConcurrentPerRestaurant(): number {
  return env.featureFlags.assignmentPipeline?.maxConcurrentPerRestaurant ?? 3;
}

export function getHoldMinTtlSeconds(): number {
  const value = env.featureFlags.holds?.minTtlSeconds ?? 60;
  return Math.max(1, Math.min(value, 3600));
}

export function getHoldRateWindowSeconds(): number {
  const value = env.featureFlags.holds?.rate?.windowSeconds ?? 60;
  return Math.max(5, Math.min(value, 3600));
}

export function getHoldRateMaxPerBooking(): number {
  const value = env.featureFlags.holds?.rate?.maxPerBooking ?? 5;
  return Math.max(1, Math.min(value, 100));
}

export function isEmailQueueEnabled(): boolean {
  return env.featureFlags.emailQueueEnabled ?? false;
}

export function isPolicyRequoteEnabled(): boolean {
  return env.featureFlags.policyRequoteEnabled ?? true;
}

// ------------------------------
// Booking Auto-Assignment
// ------------------------------
export function isAutoAssignOnBookingEnabled(): boolean {
  return env.featureFlags.autoAssignOnBooking ?? false;
}

export function getAutoAssignMaxRetries(): number {
  return env.featureFlags.autoAssign?.maxRetries ?? 3;
}

export function getAutoAssignRetryDelaysMs(): number[] {
  const raw = env.featureFlags.autoAssign?.retryDelaysMs;
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return [5000, 15000, 45000];
  }
  const parts = raw.split(',').map((s) => Number(s.trim())).filter((n) => Number.isFinite(n) && n >= 0);
  if (parts.length === 0) return [5000, 15000, 45000];
  // clamp to reasonable
  return parts.map((n) => Math.max(0, Math.min(n, 5 * 60 * 1000)));
}

function validateFeatureFlagSafety(): void {
  const { holds, allocator, selectorLookahead } = env.featureFlags;

  if ((holds?.enabled ?? true) && !(holds?.strictConflicts ?? false)) {
    warnUnsafeFeatureFlag("holds.strictConflicts disabled while holds.enabled=true", {
      environment: env.node.env,
      strictConflicts: holds?.strictConflicts ?? null,
    });
  }

  if ((allocator?.mergesEnabled ?? false) && (allocator?.requireAdjacency === false)) {
    warnUnsafeFeatureFlag("allocator merges enabled while adjacency requirement disabled", {
      environment: env.node.env,
      mergesEnabled: allocator?.mergesEnabled ?? null,
      requireAdjacency: allocator?.requireAdjacency ?? null,
    });
  }

  if (selectorLookahead?.enabled && (selectorLookahead?.penaltyWeight ?? 0) === 0) {
    warnUnsafeFeatureFlag("selectorLookahead enabled but penaltyWeight equals 0", {
      environment: env.node.env,
      penaltyWeight: selectorLookahead?.penaltyWeight ?? null,
    });
  }
}

validateFeatureFlagSafety();

export function getAutoAssignStartCutoffMinutes(): number {
  return env.featureFlags.autoAssign?.startCutoffMinutes ?? 10;
}

export function getAutoAssignCreatedEmailDeferMinutes(): number {
  return env.featureFlags.autoAssign?.createdEmailDeferMinutes ?? 0;
}

export function isAutoAssignRetryPolicyV2Enabled(): boolean {
  return env.featureFlags.autoAssign?.retryPolicyV2 ?? false;
}
