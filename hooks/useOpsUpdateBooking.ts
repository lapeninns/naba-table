'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';

import type { BookingDTO } from '@/hooks/useBookings';
import { fetchJson } from '@/lib/http/fetchJson';
import type { HttpError } from '@/lib/http/errors';
import { queryKeys } from '@/lib/query/keys';

export type OpsUpdateBookingInput = {
  id: string;
  startIso: string;
  endIso: string;
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
      toast.error(error.message);
    },
  });
}
