'use client';

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';

import { useRestaurantService } from '@/contexts/ops-services';
import { queryKeys } from '@/lib/query/keys';

import type { HttpError } from '@/lib/http/errors';
import type {
  RestaurantBusinessContextSnapshot,
  UpdateRestaurantBusinessContextInput,
} from '@/services/ops/restaurants';

export function useOpsRestaurantBusinessContext(
  restaurantId?: string | null,
): UseQueryResult<RestaurantBusinessContextSnapshot, HttpError> {
  const restaurantService = useRestaurantService();

  return useQuery<RestaurantBusinessContextSnapshot, HttpError>({
    queryKey: restaurantId
      ? queryKeys.opsRestaurants.businessContext(restaurantId)
      : queryKeys.opsRestaurants.businessContext('none'),
    queryFn: () => {
      if (!restaurantId) {
        throw new Error('Restaurant id is required');
      }
      return restaurantService.getBusinessContext(restaurantId);
    },
    enabled: Boolean(restaurantId),
    staleTime: 30_000,
  });
}

export function useOpsUpdateRestaurantBusinessContext(
  restaurantId?: string | null,
): UseMutationResult<
  RestaurantBusinessContextSnapshot,
  HttpError | Error,
  UpdateRestaurantBusinessContextInput
> {
  const restaurantService = useRestaurantService();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: UpdateRestaurantBusinessContextInput) => {
      if (!restaurantId) {
        throw new Error('Restaurant id is required');
      }
      return restaurantService.updateBusinessContext(restaurantId, payload);
    },
    onSuccess: (snapshot) => {
      if (!restaurantId) {
        return;
      }
      queryClient.setQueryData(queryKeys.opsRestaurants.businessContext(restaurantId), snapshot);
    },
  });
}
