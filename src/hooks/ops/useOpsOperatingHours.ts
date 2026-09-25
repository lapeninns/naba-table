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

import type { HttpError } from '@/lib/http/errors';
import type {
  GoogleBusinessProfileOperatingHoursSyncPayload,
  OperatingHoursSnapshot,
} from '@/services/ops/restaurants';

export function useOpsOperatingHours(
  restaurantId?: string | null,
): UseQueryResult<OperatingHoursSnapshot, HttpError> {
  const restaurantService = useRestaurantService();

  return useQuery<OperatingHoursSnapshot, HttpError>({
    queryKey: restaurantId
      ? queryKeys.opsRestaurants.hours(restaurantId)
      : queryKeys.opsRestaurants.hours('none'),
    queryFn: () => {
      if (!restaurantId) {
        throw new Error('Restaurant id is required');
      }
      return restaurantService.getOperatingHours(restaurantId);
    },
    enabled: Boolean(restaurantId),
    staleTime: OPS_SETTINGS_STALE_TIME.operatingHours,
  });
}

export function useOpsUpdateOperatingHours(
  restaurantId?: string | null,
): UseMutationResult<
  OperatingHoursSnapshot,
  HttpError | Error,
  OperatingHoursSnapshot,
  { previous?: OperatingHoursSnapshot }
> {
  const restaurantService = useRestaurantService();
  const queryClient = useQueryClient();

  return useMutation<
    OperatingHoursSnapshot,
    HttpError | Error,
    OperatingHoursSnapshot,
    { previous?: OperatingHoursSnapshot }
  >({
    mutationFn: (payload) => {
      if (!restaurantId) {
        throw new Error('Restaurant id is required');
      }
      return restaurantService.updateOperatingHours(restaurantId, payload);
    },
    onMutate: async (payload) => {
      if (!restaurantId) return { previous: undefined };
      await queryClient.cancelQueries({ queryKey: queryKeys.opsRestaurants.hours(restaurantId) });
      const previous = queryClient.getQueryData<OperatingHoursSnapshot>(
        queryKeys.opsRestaurants.hours(restaurantId),
      );
      queryClient.setQueryData(queryKeys.opsRestaurants.hours(restaurantId), payload);
      return { previous };
    },
    onError: (_error, _payload, context) => {
      if (!restaurantId || !context?.previous) return;
      queryClient.setQueryData(queryKeys.opsRestaurants.hours(restaurantId), context.previous);
    },
    onSuccess: (snapshot) => {
      if (!restaurantId) return;
      queryClient.setQueryData(queryKeys.opsRestaurants.hours(restaurantId), snapshot);
    },
    onSettled: () => {
      if (!restaurantId) return;
      void queryClient.invalidateQueries({
        queryKey: queryKeys.opsRestaurants.hours(restaurantId),
      });
    },
  });
}

export function useOpsSyncOperatingHoursWithGoogleBusinessProfile(
  restaurantId?: string | null,
): UseMutationResult<
  OperatingHoursSnapshot,
  HttpError | Error,
  GoogleBusinessProfileOperatingHoursSyncPayload
> {
  const restaurantService = useRestaurantService();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload) => {
      if (!restaurantId) {
        throw new Error('Restaurant id is required');
      }
      return restaurantService.syncOperatingHoursWithGoogleBusinessProfile(restaurantId, payload);
    },
    onSuccess: (snapshot) => {
      if (!restaurantId) return;
      queryClient.setQueryData(queryKeys.opsRestaurants.hours(restaurantId), snapshot);
      void queryClient.invalidateQueries({
        queryKey: queryKeys.opsRestaurants.googleBusinessProfile(restaurantId),
      });
    },
  });
}
