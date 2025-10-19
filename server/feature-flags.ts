import { env } from "@/lib/env";

const loyaltyPilotIds = new Set(
  (env.featureFlags.loyaltyPilotRestaurantIds ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0),
);

export function isLoyaltyPilotRestaurant(restaurantId: string): boolean {
  if (!restaurantId) return false;
  return loyaltyPilotIds.has(restaurantId);
}

export function isCapacityAdminDashboardEnabled(): boolean {
  return env.featureFlags.capacityAdminDashboard ?? false;
}

export function isRpcAssignAtomicEnabled(): boolean {
  return env.featureFlags.rpcAssignAtomic ?? false;
}

export function isAssignAtomicEnabled(): boolean {
  return env.featureFlags.assignAtomic ?? false;
}

export function isAllocationsDualWriteEnabled(): boolean {
  return env.featureFlags.allocationsDualWrite ?? false;
}

export function isSelectorScoringEnabled(): boolean {
  return env.featureFlags.selectorScoring ?? false;
}

export function isCapacityConfigEnabled(): boolean {
  return env.featureFlags.capacityConfig ?? false;
}

export function isAdjacencyValidationEnabled(): boolean {
  return env.featureFlags.adjacencyValidation ?? false;
}

export function isOpsMetricsEnabled(): boolean {
  return env.featureFlags.opsMetrics ?? false;
}
