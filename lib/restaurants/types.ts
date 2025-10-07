export interface RestaurantSummary {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  capacity: number | null;
}

export interface RestaurantFilters {
  search?: string;
  timezone?: string;
  minCapacity?: number;
}
