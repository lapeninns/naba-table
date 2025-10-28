import { env } from "@/lib/env";

const loyaltyPilotIds = new Set(
  (env.featureFlags.loyaltyPilotRestaurantIds ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0),
);

function isProductionEnv(): boolean {
  return env.node.env === "production";
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

export function isCombinationPlannerEnabled(): boolean {
  return env.featureFlags.combinationPlanner ?? false;
}

export function isAdjacencyValidationEnabled(): boolean {
  return env.featureFlags.adjacencyValidation ?? false;
}

export function isOpsMetricsEnabled(): boolean {
  return env.featureFlags.opsMetrics ?? false;
}

export function isHoldsEnabled(): boolean {
  return env.featureFlags.holds.enabled ?? true;
}

export function isAllocatorMergesEnabled(): boolean {
  return env.featureFlags.allocator.mergesEnabled ?? !isProductionEnv();
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

export function getAllocatorKMax(): number {
  const configured = env.featureFlags.allocator.kMax ?? 3;
  return Math.max(1, Math.min(configured, 5));
}

export function getAllocatorAdjacencyMinPartySize(): number | null {
  const value = env.featureFlags.allocator.adjacencyMinPartySize;
  return typeof value === "number" ? value : null;
}

export function getSelectorPlannerLimits(): {
  maxPlansPerSlack?: number;
  maxCombinationEvaluations?: number;
} {
  const { selector } = env.featureFlags;
  const maxPlansPerSlack =
    typeof selector?.maxPlansPerSlack === "number" ? selector.maxPlansPerSlack : undefined;
  const maxCombinationEvaluations =
    typeof selector?.maxCombinationEvaluations === "number" ? selector.maxCombinationEvaluations : undefined;
  return {
    ...(maxPlansPerSlack ? { maxPlansPerSlack } : {}),
    ...(maxCombinationEvaluations ? { maxCombinationEvaluations } : {}),
  };
}
