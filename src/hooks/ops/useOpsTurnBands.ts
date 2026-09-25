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

import {
  availabilityMutationScope,
  invalidateAvailabilityDependents,
} from './availabilityQueryDependencies';

import type { HttpError } from '@/lib/http/errors';
import type { TurnBandsPayload, TurnBandsSnapshot } from '@/services/ops/restaurants';

export function useOpsTurnBands(
  restaurantId?: string | null,
): UseQueryResult<TurnBandsSnapshot, HttpError | Error> {
  const restaurantService = useRestaurantService();

  return useQuery<TurnBandsSnapshot, HttpError | Error>({
    queryKey: restaurantId
      ? queryKeys.opsRestaurants.turnBands(restaurantId)
      : queryKeys.opsRestaurants.turnBands('none'),
    queryFn: ({ signal }) => {
      if (!restaurantId) {
        throw new Error('Restaurant id is required');
      }
      return restaurantService.getTurnBands(restaurantId, { signal });
    },
    enabled: Boolean(restaurantId),
    staleTime: OPS_SETTINGS_STALE_TIME.turnBands,
  });
}

export function useOpsUpdateTurnBands(
  restaurantId?: string | null,
): UseMutationResult<
  TurnBandsSnapshot,
  HttpError | Error,
  TurnBandsPayload,
  { previous?: TurnBandsSnapshot }
> {
  const restaurantService = useRestaurantService();
  const queryClient = useQueryClient();

  return useMutation<
    TurnBandsSnapshot,
    HttpError | Error,
    TurnBandsPayload,
    { previous?: TurnBandsSnapshot }
  >({
    scope: availabilityMutationScope('turn-bands', restaurantId),
    mutationFn: (payload) => {
      if (!restaurantId) {
        throw new Error('Restaurant id is required');
      }
      return restaurantService.updateTurnBands(restaurantId, payload);
    },
    onMutate: async (payload) => {
      if (!restaurantId) return { previous: undefined };
      await queryClient.cancelQueries({
        queryKey: queryKeys.opsRestaurants.turnBands(restaurantId),
      });
      const previous = queryClient.getQueryData<TurnBandsSnapshot>(
        queryKeys.opsRestaurants.turnBands(restaurantId),
      );
      if (previous) {
        queryClient.setQueryData(queryKeys.opsRestaurants.turnBands(restaurantId), {
          ...previous,
          bands: payload,
        });
      }
      return { previous };
    },
    onError: (_error, _payload, context) => {
      if (!restaurantId) return;
      if (context?.previous) {
        queryClient.setQueryData(
          queryKeys.opsRestaurants.turnBands(restaurantId),
          context.previous,
        );
      }
      // Re-sync after a rollback; on success the PUT response is already authoritative.
      void queryClient.invalidateQueries({
        queryKey: queryKeys.opsRestaurants.turnBands(restaurantId),
      });
    },
    onSuccess: (snapshot) => {
      if (!restaurantId) return;
      queryClient.setQueryData(queryKeys.opsRestaurants.turnBands(restaurantId), snapshot);
      void invalidateAvailabilityDependents(queryClient, 'turn-bands', restaurantId);
    },
  });
}
