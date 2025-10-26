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

export function isAllocatorAdjacencyRequired(): boolean {
  return env.featureFlags.allocator.requireAdjacency ?? true;
}

export function getAllocatorKMax(): number {
  const configured = env.featureFlags.allocator.kMax ?? 3;
  return Math.max(1, Math.min(configured, 5));
}
