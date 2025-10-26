import { useQuery } from '@tanstack/react-query';

import { fetchJson } from '@/lib/http/fetchJson';
import { queryKeys } from '@/lib/query/keys';

import type { RestaurantsListResponse } from '@/app/api/ops/restaurants/schema';

export type RestaurantsFilters = {
  page?: number;
  pageSize?: number;
  search?: string;
  sort?: 'name' | 'created_at';
};

async function fetchRestaurants(filters: RestaurantsFilters): Promise<RestaurantsListResponse> {
  const params = new URLSearchParams();
  if (filters.page) params.set('page', String(filters.page));
  if (filters.pageSize) params.set('pageSize', String(filters.pageSize));
  if (filters.search) params.set('search', filters.search);
  if (filters.sort) params.set('sort', filters.sort);

  const response = await fetchJson<RestaurantsListResponse>(`/api/ops/restaurants?${params.toString()}`);

  return response;
}

export function useRestaurants(filters: RestaurantsFilters) {
  return useQuery({
    queryKey: queryKeys.opsRestaurants.list(filters),
    queryFn: () => fetchRestaurants(filters),
  });
}
