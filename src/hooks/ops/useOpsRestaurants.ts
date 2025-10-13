'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useRestaurantService } from '@/contexts/ops-services';
import type { HttpError } from '@/lib/http/errors';
import { queryKeys } from '@/lib/query/keys';
import type { OpsRestaurantOption } from '@/types/ops';
import type { RestaurantRole } from '@/lib/owner/auth/roles';

export function useOpsRestaurantsList(options: { enabled?: boolean } = {}): UseQueryResult<
  Array<OpsRestaurantOption & { role: RestaurantRole }>,
  HttpError
> {
  const restaurantService = useRestaurantService();

  return useQuery({
    queryKey: queryKeys.opsRestaurants.list(),
    queryFn: () => restaurantService.listRestaurants(),
    staleTime: 2 * 60 * 1000,
    enabled: options.enabled ?? true,
  });
}
