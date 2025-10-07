'use client';

import { type QueryKey, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';

import { fetchJson } from '@/lib/http/fetchJson';
import type { HttpError } from '@/lib/http/errors';
import { queryKeys } from '@/lib/query/keys';
import { emit } from '@/lib/analytics/emit';
import { track } from '@/lib/analytics';
import type { BookingDTO, BookingsPage } from './useBookings';

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
};

export function useCancelBooking() {
  const queryClient = useQueryClient();

  return useMutation<CancelBookingResponse, HttpError, CancelBookingInput, CancelContext>({
    mutationFn: async ({ id }) => {
      emit('booking_cancel_requested', { bookingId: id });
      return fetchJson<CancelBookingResponse>(`/api/bookings/${id}`, {
        method: 'DELETE',
      });
    },
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.bookings.all });
      await queryClient.cancelQueries({ queryKey: queryKeys.bookings.detail(id) });

      const lists = queryClient.getQueriesData<BookingsPage>({ queryKey: queryKeys.bookings.all });
      const detail = queryClient.getQueryData<BookingDTO>(queryKeys.bookings.detail(id));

      lists.forEach(([key, data]) => {
        if (!data) return;
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

      return { lists, detail };
    },
    onSuccess: ({ id }) => {
      emit('booking_cancelled', { bookingId: id });
      track('booking_cancelled', { bookingId: id });
      toast.success('Booking cancelled');
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
      toast.error(error.message);
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.bookings.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.bookings.detail(variables.id) });
    },
  });
}
