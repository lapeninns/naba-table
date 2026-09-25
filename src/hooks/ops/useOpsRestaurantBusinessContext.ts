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
import { OPS_SETTINGS_STALE_TIME } from '@/lib/query/staleTimes';

import { dualSyncQueryKeys } from './opsIntegrationQueries';

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
    queryFn: ({ signal }) => {
      if (!restaurantId) {
        throw new Error('Restaurant id is required');
      }
      return restaurantService.getBusinessContext(restaurantId, { signal });
    },
    enabled: Boolean(restaurantId),
    staleTime: OPS_SETTINGS_STALE_TIME.businessContext,
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
    // Saves for one restaurant run serially so an older response cannot land last.
    scope: restaurantId ? { id: `ops-restaurant-business-context:${restaurantId}` } : undefined,
    mutationFn: (payload: UpdateRestaurantBusinessContextInput) => {
      if (!restaurantId) {
        throw new Error('Restaurant id is required');
      }
      return restaurantService.updateBusinessContext(restaurantId, payload);
    },
    onMutate: async () => {
      if (!restaurantId) return;
      // An in-flight GET started before the save would otherwise overwrite the saved snapshot.
      await queryClient.cancelQueries({
        queryKey: queryKeys.opsRestaurants.businessContext(restaurantId),
      });
    },
    onSuccess: (snapshot) => {
      if (!restaurantId) {
        return;
      }
      queryClient.setQueryData(queryKeys.opsRestaurants.businessContext(restaurantId), snapshot);
      // Dual-sync state compares the live Core snapshot against Google, so drift moves with the save.
      void queryClient.invalidateQueries({ queryKey: dualSyncQueryKeys.state(restaurantId) });
    },
  });
}
