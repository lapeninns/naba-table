'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';

import { emit } from '@/lib/analytics/emit';
import { fetchJson } from '@/lib/http/fetchJson';
import { reservationAdapter, reservationListAdapter } from '@entities/reservation/adapter';
import { reservationKeys } from '@shared/api/queryKeys';
import { track } from '@shared/lib/analytics';

import type { ReservationSubmissionResult } from './types';
import type { ReservationDraft } from '../model/reducer';

const DEFAULT_OPS_SEATING_PREFERENCE = 'any';

type OpsReservationError = {
  code?: string;
  message?: string;
  status?: number;
};

export function useCreateOpsReservation() {
  const queryClient = useQueryClient();
  const idempotencyKeyRef = useRef<string | null>(null);

  return useMutation<
    ReservationSubmissionResult,
    OpsReservationError,
    { draft: ReservationDraft; bookingId?: string }
  >({
    networkMode: 'offlineFirst',
    meta: { persist: true },
    mutationFn: async ({ draft, bookingId }) => {
      if (bookingId) {
        throw Object.assign(new Error('Editing bookings is not supported in ops wizard'), {
          code: 'UNSUPPORTED_OPERATION',
        });
      }

      const payload = {
        restaurantId: draft.restaurantId,
        restaurantSlug: draft.restaurantSlug,
        date: draft.date,
        time: draft.time,
        party: draft.party,
        bookingType: draft.bookingType,
        seating: DEFAULT_OPS_SEATING_PREFERENCE,
        notes: draft.notes ?? undefined,
        name: draft.name,
        email: draft.email ?? undefined,
        phone: draft.phone ?? undefined,
        marketingOptIn: draft.marketingOptIn,
      } as const;

      const idempotencyKey =
        idempotencyKeyRef.current ??
        (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
      idempotencyKeyRef.current = idempotencyKey;

      const response = await fetchJson<{
        booking?: unknown;
        bookings?: unknown;
      }>('/api/ops/bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({
          ...payload,
          email: draft.email ?? null,
          phone: draft.phone ?? null,
        }),
      });

      const booking = response?.booking ? reservationAdapter(response.booking) : null;
      const bookings = response?.bookings ? reservationListAdapter(response.bookings) : [];

      idempotencyKeyRef.current = null;

      return {
        booking,
        bookings,
      } satisfies ReservationSubmissionResult;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: reservationKeys.all() });
      if (result.booking) {
        queryClient.setQueryData(reservationKeys.detail(result.booking.id), result.booking);
      }
    },
    onError: (error) => {
      idempotencyKeyRef.current = null;
      const payload = {
        code: error?.code ?? 'UNKNOWN',
        status: error?.status,
        context: 'ops',
      };
      track('wizard_submit_failed', payload);
      emit('wizard_submit_failed', payload);
    },
  });
}
