'use client';

import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';

import { fetchJson } from '@/lib/http/fetchJson';
import { HttpError } from '@/lib/http/errors';
import { queryKeys } from '@/lib/query/keys';

export type WeeklyOperatingHourInput = {
  dayOfWeek: number;
  opensAt?: string | null;
  closesAt?: string | null;
  isClosed?: boolean;
  notes?: string | null;
};

export type OperatingHourOverrideInput = {
  id?: string;
  effectiveDate: string;
  opensAt?: string | null;
  closesAt?: string | null;
  isClosed?: boolean;
  notes?: string | null;
};

export type OperatingHoursResponse = {
  restaurantId: string;
  timezone: string;
  weekly: Array<{
    dayOfWeek: number;
    opensAt: string | null;
    closesAt: string | null;
    isClosed: boolean;
    notes: string | null;
  }>;
  overrides: Array<{
    id: string;
    effectiveDate: string;
    opensAt: string | null;
    closesAt: string | null;
    isClosed: boolean;
    notes: string | null;
  }>;
};

export type UpdateOperatingHoursInput = {
  weekly: WeeklyOperatingHourInput[];
  overrides: OperatingHourOverrideInput[];
};

const DISABLED_HOURS_KEY = ['owner', 'restaurants', 'disabled', 'hours'] as const;

export function useOperatingHours(
  restaurantId: string | null,
): UseQueryResult<OperatingHoursResponse, HttpError> {
  const queryKey = restaurantId ? queryKeys.ownerRestaurants.hours(restaurantId) : DISABLED_HOURS_KEY;

  return useQuery<OperatingHoursResponse, HttpError>({
    queryKey,
    queryFn: async () => {
      if (!restaurantId) {
        throw new HttpError({ message: 'Restaurant id is required', status: 400, code: 'MISSING_RESTAURANT' });
      }

      return fetchJson<OperatingHoursResponse>(`/api/owner/restaurants/${restaurantId}/hours`);
    },
    enabled: Boolean(restaurantId),
  });
}

export function useUpdateOperatingHours(restaurantId: string | null) {
  const queryClient = useQueryClient();

  return useMutation<OperatingHoursResponse, HttpError, UpdateOperatingHoursInput>({
    mutationFn: async (input) => {
      if (!restaurantId) {
        throw new HttpError({ message: 'Restaurant id is required', status: 400, code: 'MISSING_RESTAURANT' });
      }

      return fetchJson<OperatingHoursResponse>(`/api/owner/restaurants/${restaurantId}/hours`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
      });
    },
    onSuccess: (data) => {
      if (!restaurantId) return;
      queryClient.setQueryData(queryKeys.ownerRestaurants.hours(restaurantId), data);
    },
  });
}
