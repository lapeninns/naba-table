'use client';

import { useMutation, useQuery, useQueryClient, type UseMutationResult, type UseQueryResult } from '@tanstack/react-query';

import { useRestaurantService } from '@/contexts/ops-services';
import type { HttpError } from '@/lib/http/errors';
import { queryKeys } from '@/lib/query/keys';
import type { ServicePeriodRow } from '@/services/ops/restaurants';

export function useOpsServicePeriods(
  restaurantId?: string | null,
): UseQueryResult<ServicePeriodRow[], HttpError> {
  const restaurantService = useRestaurantService();

  return useQuery<ServicePeriodRow[], HttpError>({
    queryKey: restaurantId ? queryKeys.opsRestaurants.servicePeriods(restaurantId) : queryKeys.opsRestaurants.servicePeriods('none'),
    queryFn: () => {
      if (!restaurantId) {
        throw new Error('Restaurant id is required');
      }
      return restaurantService.getServicePeriods(restaurantId);
    },
    enabled: Boolean(restaurantId),
    staleTime: 60 * 1000,
  });
}

export function useOpsUpdateServicePeriods(
  restaurantId?: string | null,
): UseMutationResult<ServicePeriodRow[], HttpError | Error, ServicePeriodRow[]> {
  const restaurantService = useRestaurantService();
  const queryClient = useQueryClient();

  return useMutation<ServicePeriodRow[], HttpError | Error, ServicePeriodRow[]>({
    mutationFn: (rows) => {
      if (!restaurantId) {
        throw new Error('Restaurant id is required');
      }
      return restaurantService.updateServicePeriods(restaurantId, rows);
    },
    onSuccess: (periods) => {
      if (!restaurantId) return;
      queryClient.setQueryData(queryKeys.opsRestaurants.servicePeriods(restaurantId), periods);
    },
  });
}
