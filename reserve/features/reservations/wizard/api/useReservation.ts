'use client';

import { useQuery } from '@tanstack/react-query';

import { reservationAdapter } from '@entities/reservation/adapter';
import { apiClient, type ApiError } from '@shared/api/client';
import { reservationKeys } from '@shared/api/queryKeys';

import type { Reservation } from '@entities/reservation/reservation.schema';

export function useReservation(
  reservationId: string | undefined,
  options?: { token?: string | null; enabled?: boolean },
) {
  return useQuery<Reservation, ApiError>({
    queryKey: reservationKeys.detail(reservationId),
    enabled: Boolean(reservationId) && (options?.enabled ?? true),
    queryFn: async ({ signal }) => {
      if (!reservationId) {
        throw {
          code: 'MISSING_ID',
          message: 'Reservation id is required',
        } satisfies ApiError;
      }
      const search = new URLSearchParams();
      if (options?.token) {
        search.set('token', options.token);
      }

      const path = search.size
        ? `/bookings/${reservationId}?${search.toString()}`
        : `/bookings/${reservationId}`;
      const response = await apiClient.get<{ booking: unknown }>(path, { signal });
      if (!response?.booking) {
        throw {
          code: 'NOT_FOUND',
          message: 'Reservation not found',
        } satisfies ApiError;
      }
      return reservationAdapter(response.booking);
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  });
}
