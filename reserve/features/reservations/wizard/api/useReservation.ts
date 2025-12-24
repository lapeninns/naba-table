'use client';

import { useQuery } from '@tanstack/react-query';

import { reservationAdapter } from '@entities/reservation/adapter';
import { apiClient, type ApiError } from '@shared/api/client';
import { reservationKeys } from '@shared/api/queryKeys';

import type { Reservation } from '@entities/reservation/reservation.schema';

/**
 * Access level information from the API.
 * Returned by GET /api/bookings/{id} to indicate what actions the user can perform.
 */
export type AccessInfo = {
  level: 'owner' | 'staff' | 'token' | 'none';
  canModify: boolean;
  canCancel: boolean;
};

/**
 * Response shape from the reservation API including access information.
 */
export type ReservationWithAccess = {
  reservation: Reservation;
  access: AccessInfo;
};

/**
 * Default access info for backward compatibility when API doesn't return access field.
 */
const DEFAULT_ACCESS: AccessInfo = {
  level: 'none',
  canModify: false,
  canCancel: false,
};

/**
 * Hook to fetch a single reservation/booking with its access information.
 *
 * @param reservationId - The booking UUID
 * @param token - Optional access token for unauthenticated access
 * @returns Query result with reservation and access info
 */
export function useReservation(reservationId: string | undefined, token?: string | null) {
  return useQuery<ReservationWithAccess, ApiError>({
    queryKey: reservationKeys.detail(token ? `${reservationId}:${token}` : reservationId),
    enabled: Boolean(reservationId),
    queryFn: async ({ signal }) => {
      if (!reservationId) {
        throw {
          code: 'MISSING_ID',
          message: 'Reservation id is required',
        } satisfies ApiError;
      }
      const search = token ? `?token=${encodeURIComponent(token)}` : '';
      const response = await apiClient.get<{
        booking: unknown;
        access?: AccessInfo;
      }>(`/bookings/${reservationId}${search}`, {
        signal,
      });
      if (!response?.booking) {
        throw {
          code: 'NOT_FOUND',
          message: 'Reservation not found',
        } satisfies ApiError;
      }

      const reservation = reservationAdapter(response.booking);

      // Extract access info, with fallback for backward compatibility
      const access: AccessInfo = response.access ?? {
        ...DEFAULT_ACCESS,
        // If we got here, access was granted somehow
        level: token ? 'token' : 'none',
        canModify: true,
        canCancel: true,
      };

      return { reservation, access };
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  });
}
