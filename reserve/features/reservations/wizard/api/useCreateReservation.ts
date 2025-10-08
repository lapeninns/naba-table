'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';

import { emit } from '@/lib/analytics/emit';
import { reservationAdapter, reservationListAdapter } from '@entities/reservation/adapter';
import { apiClient, type ApiError } from '@shared/api/client';
import { reservationKeys } from '@shared/api/queryKeys';
import { track } from '@shared/lib/analytics';

import type { ReservationSubmissionResult } from './types';
import type { ReservationDraft } from '../model/reducer';

export function useCreateReservation() {
  const queryClient = useQueryClient();
  const idempotencyKeyRef = useRef<string | null>(null);

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
      const idempotencyKey =
        idempotencyKeyRef.current ??
        (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
      idempotencyKeyRef.current = idempotencyKey;
      try {
        const response = await method<{
          booking?: unknown;
          bookings?: unknown;
        }>(path, payload, {
          headers: { 'Idempotency-Key': idempotencyKey },
        });

        const booking = response?.booking ? reservationAdapter(response.booking) : null;
        const bookings = response?.bookings ? reservationListAdapter(response.bookings) : [];

        return {
          booking,
          bookings,
        } satisfies ReservationSubmissionResult;
      } finally {
        idempotencyKeyRef.current = null;
      }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: reservationKeys.all() });
      if (result.booking) {
        queryClient.setQueryData(reservationKeys.detail(result.booking.id), result.booking);
      }
    },
    onError: (error, variables) => {
      idempotencyKeyRef.current = null;
      const payload = {
        code: error?.code ?? 'UNKNOWN',
        status: error?.status,
        bookingId: variables?.bookingId ?? null,
      };
      track('wizard_submit_failed', payload);
      emit('wizard_submit_failed', payload);
    },
  });
}
