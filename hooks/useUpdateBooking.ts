'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';

import { emit } from '@/lib/analytics/emit';
import { BOOKING_IN_PAST_CUSTOMER_MESSAGE } from '@/lib/bookings/messages';
import { fetchJson } from '@/lib/http/fetchJson';
import { queryKeys } from '@/lib/query/keys';
import { reservationKeys } from '@shared/api/queryKeys';

import type { BookingDTO, BookingsPage } from './useBookings';
import type { HttpError } from '@/lib/http/errors';

export type UpdateBookingInput = {
  id: string;
  startIso: string;
  endIso?: string;
  partySize: number;
  notes?: string | null;
};

export function useUpdateBooking() {
  const queryClient = useQueryClient();

  type MutationContext = {
    lists: Array<[readonly unknown[], BookingsPage | undefined]>;
    detail?: BookingDTO;
    reservationDetail?: BookingDTO;
  };

  return useMutation<BookingDTO, HttpError, UpdateBookingInput, unknown>({
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
    onMutate: async (variables) => {
      const { id, ...body } = variables;

      await queryClient.cancelQueries({ queryKey: queryKeys.bookings.all });
      await queryClient.cancelQueries({ queryKey: queryKeys.bookings.detail(id) });
      await queryClient.cancelQueries({ queryKey: reservationKeys.detail(id) });

      const lists = queryClient.getQueriesData<BookingsPage>({ queryKey: queryKeys.bookings.all });
      const detail = queryClient.getQueryData<BookingDTO>(queryKeys.bookings.detail(id));
      const reservationDetail = queryClient.getQueryData<BookingDTO>(reservationKeys.detail(id));

      const patch = (booking: BookingDTO): BookingDTO => ({
        ...booking,
        startIso: body.startIso,
        endIso: body.endIso ?? booking.endIso,
        partySize: body.partySize,
        notes: body.notes ?? booking.notes ?? null,
      });

      lists.forEach(([key, data]) => {
        if (!data || !Array.isArray(data.items)) return;
        queryClient.setQueryData<BookingsPage>(key, {
          ...data,
          items: data.items.map((booking) => (booking.id === id ? patch(booking) : booking)),
        });
      });

      if (detail) {
        queryClient.setQueryData(queryKeys.bookings.detail(id), patch(detail));
      }

      if (reservationDetail) {
        queryClient.setQueryData(reservationKeys.detail(id), patch(reservationDetail));
      }

      return { lists, detail, reservationDetail };
    },
    onSuccess: (updated) => {
      toast.success('Booking updated');
      if (updated?.id) {
        queryClient.setQueryData(queryKeys.bookings.detail(updated.id), updated);
        queryClient.setQueryData(reservationKeys.detail(updated.id), updated);
      }
    },
    onError: (error, variables, context) => {
      const ctx = context as MutationContext | undefined;
      emit('booking_edit_failed', { bookingId: variables.id, code: (error as HttpError)?.code });
      ctx?.lists?.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
      if (ctx?.detail) {
        queryClient.setQueryData(queryKeys.bookings.detail(variables.id), ctx.detail);
      }
      if (ctx?.reservationDetail) {
        queryClient.setQueryData(reservationKeys.detail(variables.id), ctx.reservationDetail);
      }
      const message =
        error.code === 'BOOKING_IN_PAST'
          ? BOOKING_IN_PAST_CUSTOMER_MESSAGE
          : error.message;
      toast.error(message);
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.bookings.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.bookings.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: reservationKeys.detail(variables.id) });
      queryClient.invalidateQueries({
        predicate: (query) => Array.isArray(query.queryKey) && query.queryKey[0] === 'reservations' && query.queryKey[1] === 'schedule',
      });
    },
  });
}
