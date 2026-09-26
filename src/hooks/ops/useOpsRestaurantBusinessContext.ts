'use client';

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';

import { useRestaurantService } from '@/contexts/ops-services';
import { HttpError } from '@/lib/http/errors';
import { queryKeys } from '@/lib/query/keys';
import { OPS_SETTINGS_STALE_TIME } from '@/lib/query/staleTimes';

import { dualSyncQueryKeys } from './opsIntegrationQueries';

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

/**
 * One Discovery save: every changed section, applied in one transaction. `expectedRevision` is
 * the revision of the snapshot the draft is based on; the server refuses the save with
 * 409 STALE_WRITE when another write landed since.
 */
export type BusinessContextSaveInput = UpdateRestaurantBusinessContextInput & {
  expectedRevision?: number;
};

export function useOpsUpdateRestaurantBusinessContext(
  restaurantId?: string | null,
): UseMutationResult<
  RestaurantBusinessContextSnapshot,
  HttpError | Error,
  BusinessContextSaveInput
> {
  const restaurantService = useRestaurantService();
  const queryClient = useQueryClient();

  return useMutation({
    // Saves for one restaurant run serially so an older response cannot land last.
    scope: restaurantId ? { id: `ops-restaurant-business-context:${restaurantId}` } : undefined,
    mutationFn: (payload: BusinessContextSaveInput) => {
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
      // The canonical snapshot (with its new revision) from the one transactional save.
      queryClient.setQueryData(queryKeys.opsRestaurants.businessContext(restaurantId), snapshot);
      // Dual-sync state compares the live Core snapshot against Google, so drift moves with the save.
      void queryClient.invalidateQueries({ queryKey: dualSyncQueryKeys.state(restaurantId) });
    },
    onError: (error) => {
      if (!restaurantId) {
        return;
      }
      // Another write landed since the draft's snapshot. Load the latest one: the editor rebases
      // the draft onto it (keeping non-conflicting edits), so the next Save carries the current
      // revision instead of failing with the same stale one forever.
      if (error instanceof HttpError && error.code === 'STALE_WRITE') {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.opsRestaurants.businessContext(restaurantId),
          exact: true,
        });
      }
    },
  });
}
