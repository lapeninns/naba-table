'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';

import { BOOKING_IN_PAST_OPS_MESSAGE } from '@/lib/bookings/messages';
import { fetchJson } from '@/lib/http/fetchJson';
import { queryKeys } from '@/lib/query/keys';

import type { BookingDTO } from '@/hooks/useBookings';
import type { HttpError } from '@/lib/http/errors';

export type OpsUpdateBookingInput = {
  id: string;
  startIso: string;
  endIso?: string;
  partySize: number;
  notes?: string | null;
};

export function useOpsUpdateBooking() {
  const queryClient = useQueryClient();

  return useMutation<BookingDTO, HttpError, OpsUpdateBookingInput>({
    mutationFn: async ({ id, ...body }) =>
      fetchJson<BookingDTO>(`/api/ops/bookings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    onSuccess: (booking) => {
      toast.success('Booking updated');
      queryClient.invalidateQueries({ queryKey: queryKeys.opsBookings.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.opsBookings.detail(booking.id) });
    },
    onError: (error) => {
      const message =
        error.code === 'BOOKING_IN_PAST' ? BOOKING_IN_PAST_OPS_MESSAGE : error.message;
      toast.error(message);
    },
  });
}
