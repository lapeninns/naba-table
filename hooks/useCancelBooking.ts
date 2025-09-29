'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';

import { fetchJson } from '@/lib/http/fetchJson';
import type { HttpError } from '@/lib/http/errors';
import { queryKeys } from '@/lib/query/keys';
import { emit } from '@/lib/analytics/emit';

export type CancelBookingInput = {
  id: string;
};

export type CancelBookingResponse = {
  id: string;
  status: string;
};

export function useCancelBooking() {
  const queryClient = useQueryClient();

  return useMutation<CancelBookingResponse, HttpError, CancelBookingInput>({
    mutationFn: async ({ id }) => {
      emit('booking_cancel_confirmed', { bookingId: id });
      const response = await fetchJson<CancelBookingResponse>(`/api/bookings/${id}`, {
        method: 'DELETE',
      });
      emit('booking_cancel_succeeded', { bookingId: id });
      return response;
    },
    onSuccess: ({ id }) => {
      toast.success('Booking cancelled');
      queryClient.invalidateQueries({ queryKey: queryKeys.bookings.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.bookings.detail(id) });
    },
    onError: (error, variables) => {
      emit('booking_cancel_failed', { bookingId: variables.id, code: error.code });
      toast.error(error.message);
    },
  });
}
