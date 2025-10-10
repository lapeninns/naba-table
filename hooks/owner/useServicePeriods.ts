'use client';

import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';

import { fetchJson } from '@/lib/http/fetchJson';
import { HttpError } from '@/lib/http/errors';
import { queryKeys } from '@/lib/query/keys';

export type ServicePeriod = {
  id: string;
  name: string;
  dayOfWeek: number | null;
  startTime: string;
  endTime: string;
  bookingOption: 'lunch' | 'dinner' | 'drinks';
};

export type UpdateServicePeriodInput = {
  id?: string;
  name: string;
  dayOfWeek?: number | null;
  startTime: string;
  endTime: string;
  bookingOption: 'lunch' | 'dinner' | 'drinks';
};

const DISABLED_KEY = ['owner', 'restaurants', 'disabled', 'service-periods'] as const;

export function useServicePeriods(restaurantId: string | null): UseQueryResult<ServicePeriod[], HttpError> {
  const queryKey = restaurantId ? queryKeys.ownerRestaurants.servicePeriods(restaurantId) : DISABLED_KEY;

  return useQuery<ServicePeriod[], HttpError>({
    queryKey,
    queryFn: async () => {
      if (!restaurantId) {
        throw new HttpError({ message: 'Restaurant id is required', status: 400, code: 'MISSING_RESTAURANT' });
      }

      const { periods } = await fetchJson<{ restaurantId: string; periods: ServicePeriod[] }>(
        `/api/owner/restaurants/${restaurantId}/service-periods`,
      );
      return periods;
    },
    enabled: Boolean(restaurantId),
  });
}

export function useUpdateServicePeriods(restaurantId: string | null) {
  const queryClient = useQueryClient();

  return useMutation<ServicePeriod[], HttpError, UpdateServicePeriodInput[]>({
    mutationFn: async (payload) => {
      if (!restaurantId) {
        throw new HttpError({ message: 'Restaurant id is required', status: 400, code: 'MISSING_RESTAURANT' });
      }

      const response = await fetchJson<{ restaurantId: string; periods: ServicePeriod[] }>(
        `/api/owner/restaurants/${restaurantId}/service-periods`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        },
      );

      return response.periods;
    },
    onSuccess: (periods) => {
      if (!restaurantId) return;
      queryClient.setQueryData(queryKeys.ownerRestaurants.servicePeriods(restaurantId), periods);
    },
  });
}
