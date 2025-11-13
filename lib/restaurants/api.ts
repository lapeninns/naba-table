import { fetchJson } from "@/lib/http/fetchJson";

import type { RestaurantFilters, RestaurantSummary } from "./types";

type RestaurantsResponse = {
  data?: RestaurantSummary[];
};

const buildSearchParams = (filters: RestaurantFilters = {}): URLSearchParams => {
  const params = new URLSearchParams();

  if (filters.search) {
    params.set("search", filters.search);
  }

  if (filters.timezone) {
    params.set("timezone", filters.timezone);
  }

  if (typeof filters.minCapacity === "number" && Number.isFinite(filters.minCapacity)) {
    params.set("minCapacity", String(filters.minCapacity));
  }

  return params;
};

export async function fetchRestaurants(filters: RestaurantFilters = {}) {
  const params = buildSearchParams(filters);
  const query = params.toString();
  const url = query.length > 0 ? `/api/v1/restaurants?${query}` : "/api/v1/restaurants";
  const response = await fetchJson<RestaurantsResponse>(url);
  return response.data ?? [];
}

export { buildSearchParams };
