'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';

import { fetchJson } from '@/lib/http/fetchJson';
import type { HttpError } from '@/lib/http/errors';
import { queryKeys } from '@/lib/query/keys';
import { emit } from '@/lib/analytics/emit';
import type { BookingDTO } from './useBookings';

export type UpdateBookingInput = {
  id: string;
  startIso: string;
  endIso: string;
  partySize: number;
  notes?: string | null;
};

export function useUpdateBooking() {
  const queryClient = useQueryClient();

  return useMutation<BookingDTO, HttpError, UpdateBookingInput>({
    mutationFn: async ({ id, ...body }) => {
      emit('booking_edit_submitted', { bookingId: id });
      const updated = await fetchJson<BookingDTO>(`/api/bookings/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      emit('booking_edit_succeeded', { bookingId: id });
      return updated;
    },
    onSuccess: () => {
      toast.success('Booking updated');
      queryClient.invalidateQueries({ queryKey: queryKeys.bookings.all });
    },
    onError: (error, variables) => {
      emit('booking_edit_failed', { bookingId: variables.id, code: (error as HttpError)?.code });
      toast.error(error.message);
    },
  });
}
