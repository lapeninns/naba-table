'use client';

import { useQuery } from '@tanstack/react-query';

import { reservationAdapter } from '@entities/reservation/adapter';
import { apiClient, type ApiError } from '@shared/api/client';
import { reservationKeys } from '@shared/api/queryKeys';

import type { Reservation } from '@entities/reservation/reservation.schema';

export function useReservation(reservationId: string | undefined) {
  return useQuery<Reservation, ApiError>({
    queryKey: reservationKeys.detail(reservationId),
    enabled: Boolean(reservationId),
    queryFn: async ({ signal }) => {
      if (!reservationId) {
        throw {
          code: 'MISSING_ID',
          message: 'Reservation id is required',
        } satisfies ApiError;
      }
      const response = await apiClient.get<{ booking: unknown }>(`/bookings/${reservationId}`, {
        signal,
      });
      if (!response?.booking) {
        throw {
          code: 'NOT_FOUND',
          message: 'Reservation not found',
        } satisfies ApiError;
      }
      return reservationAdapter(response.booking);
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
