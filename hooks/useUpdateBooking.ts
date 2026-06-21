'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { emit } from '@/lib/analytics/emit';
import { fetchJson } from '@/lib/http/fetchJson';
import { queryKeys } from '@/lib/query/keys';
import { reservationAdapter } from '@entities/reservation/adapter';
import { reservationKeys } from '@shared/api/queryKeys';

import type { BookingDTO, BookingsPage } from './useBookings';
import type { HttpError } from '@/lib/http/errors';
import type { Reservation } from '@entities/reservation/reservation.schema';

export type UpdateBookingInput = {
  id: string;
  startIso: string;
  endIso?: string;
  partySize: number;
  notes?: string | null;
};

type UpdateBookingResponse = BookingDTO | { id?: string; booking?: unknown };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function extractBookingPayload(response: UpdateBookingResponse): unknown {
  if (isRecord(response) && 'booking' in response) {
    return response.booking;
  }
  return response;
}

function isBookingDTO(response: UpdateBookingResponse): response is BookingDTO {
  if (!isRecord(response)) {
    return false;
  }
  const record = response as Record<string, unknown>;
  return typeof record.id === 'string' && typeof record.startIso === 'string';
}

function firstRestaurantRecord(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    return firstRestaurantRecord(value[0]);
  }
  return isRecord(value) ? value : null;
}

function mergeCachedReservationContext(payload: unknown, cached: Reservation | undefined): unknown {
  if (!cached || !isRecord(payload)) {
    return payload;
  }

  const restaurant = firstRestaurantRecord(payload.restaurants);
  return {
    ...payload,
    restaurants: {
      ...(restaurant ?? {}),
      name:
        typeof restaurant?.name === 'string' ? restaurant.name : (cached.restaurantName ?? null),
      slug:
        typeof restaurant?.slug === 'string' ? restaurant.slug : (cached.restaurantSlug ?? null),
      timezone:
        typeof restaurant?.timezone === 'string'
          ? restaurant.timezone
          : (cached.restaurantTimezone ?? null),
    },
  };
}

export function useUpdateBooking() {
  const queryClient = useQueryClient();

  type MutationContext = {
    lists: Array<[readonly unknown[], BookingsPage | undefined]>;
    detail?: BookingDTO;
  };

  return useMutation<UpdateBookingResponse, HttpError, UpdateBookingInput, unknown>({
    mutationFn: async ({ id, ...body }) => {
      emit('booking_edit_submitted', { bookingId: id });
      const updated = await fetchJson<UpdateBookingResponse>(`/api/bookings/${id}`, {
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

      return { lists, detail };
    },
    onSuccess: (updated) => {
      if (isBookingDTO(updated)) {
        queryClient.setQueryData(queryKeys.bookings.detail(updated.id), updated);
      }
      const bookingPayload = extractBookingPayload(updated);
      if (bookingPayload) {
        try {
          const bookingId = isRecord(bookingPayload) ? bookingPayload.id : null;
          const cached =
            typeof bookingId === 'string'
              ? queryClient.getQueryData<Reservation>(reservationKeys.detail(bookingId))
              : undefined;
          const reservation = reservationAdapter(
            mergeCachedReservationContext(bookingPayload, cached),
          );
          queryClient.setQueryData(reservationKeys.detail(reservation.id), reservation);
        } catch {
          // Flat dashboard responses do not always contain the full reservation payload.
        }
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
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.bookings.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.bookings.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: reservationKeys.detail(variables.id) });
      queryClient.invalidateQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) &&
          query.queryKey[0] === 'reservations' &&
          query.queryKey[1] === 'schedule',
      });
    },
  });
}
