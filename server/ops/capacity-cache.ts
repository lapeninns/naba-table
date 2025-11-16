import { invalidateAdjacencyCache, invalidateInventoryCache } from "@/server/capacity/cache";

function safeInvalidate(fn: (restaurantId: string) => void, restaurantId: string, label: string): void {
  try {
    fn(restaurantId);
  } catch (error) {
    console.warn("[capacity-cache] invalidation failed", {
      restaurantId,
      label,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export function invalidateRestaurantCapacityCaches(restaurantId: string | null | undefined): void {
  if (!restaurantId) {
    return;
  }
  safeInvalidate(invalidateInventoryCache, restaurantId, "inventory");
  safeInvalidate(invalidateAdjacencyCache, restaurantId, "adjacency");
}
