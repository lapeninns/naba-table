"use client";

import { useQuery, type UseQueryOptions } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query/keys";

import { fetchRestaurants } from "./api";

import type { RestaurantFilters, RestaurantSummary } from "./types";

type UseRestaurantsOptions = {
  queryFn?: (filters: RestaurantFilters) => Promise<RestaurantSummary[]>;
  initialData?: RestaurantSummary[];
  enabled?: boolean;
  placeholderData?: RestaurantSummary[];
} & Pick<UseQueryOptions<RestaurantSummary[], Error>, "refetchOnWindowFocus" | "retry" | "staleTime" | "gcTime">;

const DEFAULT_STALE_TIME = 5 * 60 * 1000;
const DEFAULT_GC_TIME = 10 * 60 * 1000;

export function useRestaurants(
  filters: RestaurantFilters = {},
  options: UseRestaurantsOptions = {},
) {
  const queryFn = options.queryFn ?? ((currentFilters: RestaurantFilters) => fetchRestaurants(currentFilters));

  return useQuery<RestaurantSummary[], Error>({
    queryKey: queryKeys.restaurants.list(filters),
    queryFn: () => queryFn(filters),
    initialData: options.initialData,
    placeholderData: options.placeholderData,
    enabled: options.enabled,
    staleTime: options.staleTime ?? DEFAULT_STALE_TIME,
    gcTime: options.gcTime ?? DEFAULT_GC_TIME,
    retry: options.retry ?? false,
    refetchOnWindowFocus: options.refetchOnWindowFocus ?? false,
  });
}
