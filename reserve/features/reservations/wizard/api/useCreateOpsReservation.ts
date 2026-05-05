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

function isTerminalCreateError(error: OpsReservationError | null | undefined): boolean {
  if (!error) return false;
  if (
    error.code === 'VALIDATION_ERROR' ||
    error.code === 'UNAUTHENTICATED' ||
    error.code === 'FORBIDDEN' ||
    error.code === 'UNSUPPORTED_OPERATION'
  ) {
    return true;
  }
  return (
    typeof error.status === 'number' && [400, 401, 403, 404, 409, 410, 422].includes(error.status)
  );
}

export function buildOpsBookingPayload(draft: ReservationDraft) {
  return {
    restaurantId: draft.restaurantId,
    date: draft.date,
    time: draft.time,
    party: draft.party,
    bookingType: draft.bookingType,
    seating: DEFAULT_OPS_SEATING_PREFERENCE,
    notes: draft.notes ?? undefined,
    name: draft.name,
    email: draft.email ?? null,
    phone: draft.phone ?? null,
    marketingOptIn: draft.marketingOptIn,
  } as const;
}

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

      const payload = buildOpsBookingPayload(draft);

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
        body: JSON.stringify(payload),
      });

      const booking = response?.booking ? reservationAdapter(response.booking) : null;
      const bookings = response?.bookings ? reservationListAdapter(response.bookings) : [];

      return {
        booking,
        bookings,
      } satisfies ReservationSubmissionResult;
    },
    onSuccess: (result) => {
      idempotencyKeyRef.current = null;
      queryClient.invalidateQueries({ queryKey: reservationKeys.all() });
      if (result.booking) {
        queryClient.setQueryData(reservationKeys.detail(result.booking.id), result.booking);
      }
    },
    onError: (error) => {
      if (isTerminalCreateError(error)) {
        idempotencyKeyRef.current = null;
      }
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
