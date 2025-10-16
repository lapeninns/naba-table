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
