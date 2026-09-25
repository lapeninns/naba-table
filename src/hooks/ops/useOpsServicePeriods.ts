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
  GoogleBusinessProfileServicePeriodsSyncPayload,
  ServicePeriodRow,
} from '@/services/ops/restaurants';

export function useOpsServicePeriods(
  restaurantId?: string | null,
): UseQueryResult<ServicePeriodRow[], HttpError> {
  const restaurantService = useRestaurantService();

  return useQuery<ServicePeriodRow[], HttpError>({
    queryKey: restaurantId
      ? queryKeys.opsRestaurants.servicePeriods(restaurantId)
      : queryKeys.opsRestaurants.servicePeriods('none'),
    queryFn: ({ signal }) => {
      if (!restaurantId) {
        throw new Error('Restaurant id is required');
      }
      return restaurantService.getServicePeriods(restaurantId, { signal });
    },
    enabled: Boolean(restaurantId),
    staleTime: OPS_SETTINGS_STALE_TIME.servicePeriods,
  });
}

export function useOpsUpdateServicePeriods(
  restaurantId?: string | null,
): UseMutationResult<
  ServicePeriodRow[],
  HttpError | Error,
  ServicePeriodRow[],
  { previous?: ServicePeriodRow[] }
> {
  const restaurantService = useRestaurantService();
  const queryClient = useQueryClient();

  return useMutation<
    ServicePeriodRow[],
    HttpError | Error,
    ServicePeriodRow[],
    { previous?: ServicePeriodRow[] }
  >({
    mutationFn: (rows) => {
      if (!restaurantId) {
        throw new Error('Restaurant id is required');
      }
      return restaurantService.updateServicePeriods(restaurantId, rows);
    },
    onMutate: async (rows) => {
      if (!restaurantId) return { previous: undefined };
      await queryClient.cancelQueries({
        queryKey: queryKeys.opsRestaurants.servicePeriods(restaurantId),
      });
      const previous = queryClient.getQueryData<ServicePeriodRow[]>(
        queryKeys.opsRestaurants.servicePeriods(restaurantId),
      );
      queryClient.setQueryData(queryKeys.opsRestaurants.servicePeriods(restaurantId), rows);
      return { previous };
    },
    onError: (_error, _rows, context) => {
      if (!restaurantId || !context?.previous) return;
      queryClient.setQueryData(
        queryKeys.opsRestaurants.servicePeriods(restaurantId),
        context.previous,
      );
    },
    onSuccess: (periods) => {
      if (!restaurantId) return;
      queryClient.setQueryData(queryKeys.opsRestaurants.servicePeriods(restaurantId), periods);
    },
    onSettled: () => {
      if (!restaurantId) return;
      void queryClient.invalidateQueries({
        queryKey: queryKeys.opsRestaurants.servicePeriods(restaurantId),
      });
    },
  });
}

export function useOpsSyncServicePeriodsWithGoogleBusinessProfile(
  restaurantId?: string | null,
): UseMutationResult<
  ServicePeriodRow[],
  HttpError | Error,
  GoogleBusinessProfileServicePeriodsSyncPayload
> {
  const restaurantService = useRestaurantService();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload) => {
      if (!restaurantId) {
        throw new Error('Restaurant id is required');
      }
      return restaurantService.syncServicePeriodsWithGoogleBusinessProfile(restaurantId, payload);
    },
    onSuccess: (periods) => {
      if (!restaurantId) return;
      queryClient.setQueryData(queryKeys.opsRestaurants.servicePeriods(restaurantId), periods);
      void queryClient.invalidateQueries({
        queryKey: queryKeys.opsRestaurants.googleBusinessProfile(restaurantId),
      });
    },
  });
}
