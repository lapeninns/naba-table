'use client';

import { type QueryKey, useMutation, useQueryClient } from '@tanstack/react-query';

import { track } from '@/lib/analytics';
import { emit } from '@/lib/analytics/emit';
import { fetchJson } from '@/lib/http/fetchJson';
import { queryKeys } from '@/lib/query/keys';
import { reservationKeys } from '@shared/api/queryKeys';

import type { BookingDTO, BookingsPage } from './useBookings';
import type { HttpError } from '@/lib/http/errors';
import type { Reservation } from '@entities/reservation/reservation.schema';

export type CancelBookingInput = {
  id: string;
};

export type CancelBookingResponse = {
  id: string;
  status: string;
};

export type CancelContext = {
  lists: Array<[QueryKey, BookingsPage | undefined]>;
  detail: BookingDTO | undefined;
  reservationDetail: Reservation | undefined;
};

export function useCancelBooking() {
  const queryClient = useQueryClient();

  return useMutation<CancelBookingResponse, HttpError, CancelBookingInput, CancelContext>({
    mutationFn: async ({ id }) => {
      emit('booking_cancel_requested', { bookingId: id });
      const response = await fetchJson<CancelBookingResponse>(`/api/bookings/${id}`, {
        method: 'DELETE',
      });

      emit('booking_cancel_success', { bookingId: id });
      return response;
    },
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.bookings.all });
      await queryClient.cancelQueries({ queryKey: queryKeys.bookings.detail(id) });
      await queryClient.cancelQueries({ queryKey: reservationKeys.detail(id) });

      const lists = queryClient.getQueriesData<BookingsPage>({ queryKey: queryKeys.bookings.all });
      const detail = queryClient.getQueryData<BookingDTO>(queryKeys.bookings.detail(id));
      const reservationDetail = queryClient.getQueryData<Reservation>(reservationKeys.detail(id));

      lists.forEach(([key, data]) => {
        if (!data || !Array.isArray(data.items)) return;
        queryClient.setQueryData<BookingsPage>(key, {
          ...data,
          items: data.items.map((booking) =>
            booking.id === id ? { ...booking, status: 'cancelled' } : booking,
          ),
        });
      });

      if (detail) {
        queryClient.setQueryData(queryKeys.bookings.detail(id), {
          ...detail,
          status: 'cancelled',
        });
      }

      if (reservationDetail) {
        queryClient.setQueryData(reservationKeys.detail(id), {
          ...reservationDetail,
          status: 'cancelled',
        });
      }

      return { lists, detail, reservationDetail };
    },
    onSuccess: ({ id }) => {
      emit('booking_cancelled', { bookingId: id });
      track('booking_cancelled', { bookingId: id });
    },
    onError: (error, variables, context) => {
      emit('booking_cancel_error', { bookingId: variables.id, code: error.code });
      track('booking_cancel_error', {
        bookingId: variables.id,
        status: error.status,
      });
      context?.lists.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
      if (context?.detail) {
        queryClient.setQueryData(queryKeys.bookings.detail(variables.id), context.detail);
      }
      if (context?.reservationDetail) {
        queryClient.setQueryData(
          reservationKeys.detail(variables.id),
          context.reservationDetail,
        );
      }
      if (error.code === 'PENDING_LOCKED' || error.code === 'BOOKING_IN_PAST') {
        emit('booking_cancel_blocked', { bookingId: variables.id, code: error.code });
      }
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.bookings.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.bookings.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: reservationKeys.detail(variables.id) });
    },
  });
}
