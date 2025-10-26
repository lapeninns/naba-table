'use client';

import { useMutation, useQuery, useQueryClient, type UseMutationResult, type UseQueryResult } from '@tanstack/react-query';

import { useRestaurantService } from '@/contexts/ops-services';
import { queryKeys } from '@/lib/query/keys';

import type { HttpError } from '@/lib/http/errors';
import type { OperatingHoursSnapshot } from '@/services/ops/restaurants';

export function useOpsOperatingHours(
  restaurantId?: string | null,
): UseQueryResult<OperatingHoursSnapshot, HttpError> {
  const restaurantService = useRestaurantService();

  return useQuery<OperatingHoursSnapshot, HttpError>({
    queryKey: restaurantId ? queryKeys.opsRestaurants.hours(restaurantId) : queryKeys.opsRestaurants.hours('none'),
    queryFn: () => {
      if (!restaurantId) {
        throw new Error('Restaurant id is required');
      }
      return restaurantService.getOperatingHours(restaurantId);
    },
    enabled: Boolean(restaurantId),
    staleTime: 60 * 1000,
  });
}

export function useOpsUpdateOperatingHours(
  restaurantId?: string | null,
): UseMutationResult<OperatingHoursSnapshot, HttpError | Error, OperatingHoursSnapshot> {
  const restaurantService = useRestaurantService();
  const queryClient = useQueryClient();

  return useMutation<OperatingHoursSnapshot, HttpError | Error, OperatingHoursSnapshot>({
    mutationFn: (payload) => {
      if (!restaurantId) {
        throw new Error('Restaurant id is required');
      }
      return restaurantService.updateOperatingHours(restaurantId, payload);
    },
    onSuccess: (snapshot) => {
      if (!restaurantId) return;
      queryClient.setQueryData(queryKeys.opsRestaurants.hours(restaurantId), snapshot);
    },
  });
}
