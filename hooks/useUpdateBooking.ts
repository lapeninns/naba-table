'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';

import { BOOKING_IN_PAST_CUSTOMER_MESSAGE } from '@/lib/bookings/messages';
import { fetchJson } from '@/lib/http/fetchJson';
import type { HttpError } from '@/lib/http/errors';
import { queryKeys } from '@/lib/query/keys';
import { reservationKeys } from '@shared/api/queryKeys';
import { emit } from '@/lib/analytics/emit';
import type { BookingDTO } from './useBookings';

export type UpdateBookingInput = {
  id: string;
  startIso: string;
  endIso?: string;
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
    networkMode: 'offlineFirst',
    meta: { persist: true },
    onSuccess: (updated) => {
      toast.success('Booking updated');
      queryClient.invalidateQueries({
        predicate: (query) => {
          if (!Array.isArray(query.queryKey) || query.queryKey.length === 0) {
            return false;
          }
          const [scope, subScope] = query.queryKey as unknown[];
          if (scope === 'bookings') {
            return true;
          }
          if (scope === 'reservations' && subScope === 'schedule') {
            if (updated?.restaurantSlug && typeof query.queryKey[2] === 'string') {
              return query.queryKey[2] === updated.restaurantSlug;
            }
            return true;
          }
          return false;
        },
      });
      if (updated?.id) {
        queryClient.invalidateQueries({ queryKey: queryKeys.bookings.detail(updated.id) });
        queryClient.invalidateQueries({ queryKey: reservationKeys.detail(updated.id) });
      }
    },
    onError: (error, variables) => {
      emit('booking_edit_failed', { bookingId: variables.id, code: (error as HttpError)?.code });
      const message =
        error.code === 'BOOKING_IN_PAST'
          ? BOOKING_IN_PAST_CUSTOMER_MESSAGE
          : error.message;
      toast.error(message);
    },
  });
}
