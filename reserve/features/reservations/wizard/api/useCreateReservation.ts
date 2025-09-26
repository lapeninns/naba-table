'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { reservationAdapter, reservationListAdapter } from '@entities/reservation/adapter';
import { apiClient, type ApiError } from '@shared/api/client';

import type { ReservationSubmissionResult } from './types';
import type { ReservationDraft } from '../model/reducer';

export function useCreateReservation() {
  const queryClient = useQueryClient();

  return useMutation<
    ReservationSubmissionResult,
    ApiError,
    { draft: ReservationDraft; bookingId?: string }
  >({
    mutationFn: async ({ draft, bookingId }) => {
      const payload = {
        restaurantId: draft.restaurantId,
        date: draft.date,
        time: draft.time,
        party: draft.party,
        bookingType: draft.bookingType,
        seating: draft.seating,
        notes: draft.notes ?? undefined,
        name: draft.name,
        email: draft.email,
        phone: draft.phone,
        marketingOptIn: draft.marketingOptIn,
      };

      const path = bookingId ? `/bookings/${bookingId}` : '/bookings';
      const method = bookingId ? apiClient.put : apiClient.post;
      const response = await method<{
        booking?: unknown;
        bookings?: unknown;
        waitlisted?: boolean;
        allocationPending?: boolean;
      }>(path, payload);

      const booking = response?.booking ? reservationAdapter(response.booking) : null;
      const bookings = response?.bookings ? reservationListAdapter(response.bookings) : [];

      return {
        booking,
        bookings,
        waitlisted: Boolean(response?.waitlisted),
        allocationPending: Boolean(response?.allocationPending),
      } satisfies ReservationSubmissionResult;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      if (result.booking) {
        queryClient.setQueryData(['reservation', result.booking.id], result.booking);
      }
    },
  });
}
