'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';

import { emit } from '@/lib/analytics/emit';
import { fetchJson } from '@/lib/http/fetchJson';
import { queryKeys } from '@/lib/query/keys';
import { generateIdempotencyKey } from '@/lib/utils/idempotency';
import { reservationAdapter, reservationListAdapter } from '@entities/reservation/adapter';
import { reservationKeys } from '@shared/api/queryKeys';
import { track } from '@shared/lib/analytics';

import {
  createConflictRetryDelay,
  reservationDraftFingerprint,
  shouldRetryCreateConflict,
} from './createReservationRetry';

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
    whatsappOptIn: draft.whatsappOptIn,
  } as const;
}

export type CreateOpsReservationVariables = {
  draft: ReservationDraft;
  bookingId?: string;
  /** Key for this walk-in intent; defaults to one key per draft content (see useCreateReservation). */
  idempotencyKey?: string;
};

type IntentKey = { fingerprint: string; key: string };

export function useCreateOpsReservation() {
  const queryClient = useQueryClient();
  const intentKeyRef = useRef<IntentKey | null>(null);

  const resolveIntentKey = ({ draft, bookingId, idempotencyKey }: CreateOpsReservationVariables) => {
    if (idempotencyKey) return idempotencyKey;
    const fingerprint = reservationDraftFingerprint(draft, bookingId);
    if (intentKeyRef.current?.fingerprint !== fingerprint) {
      intentKeyRef.current = { fingerprint, key: generateIdempotencyKey() };
    }
    return intentKeyRef.current.key;
  };

  return useMutation<ReservationSubmissionResult, OpsReservationError, CreateOpsReservationVariables>({
    networkMode: 'offlineFirst',
    meta: { persist: true },
    // A transient 409 BOOKING_CONFLICT (retryable) is retried once, with the same key.
    retry: shouldRetryCreateConflict,
    retryDelay: createConflictRetryDelay,
    onMutate: (variables) => {
      resolveIntentKey(variables);
    },
    mutationFn: async (variables) => {
      const { draft, bookingId } = variables;
      if (bookingId) {
        throw Object.assign(new Error('Editing bookings is not supported in ops wizard'), {
          code: 'UNSUPPORTED_OPERATION',
        });
      }

      const payload = buildOpsBookingPayload(draft);

      const idempotencyKey = resolveIntentKey(variables);

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
    onSuccess: (result, { draft }) => {
      intentKeyRef.current = null;
      queryClient.invalidateQueries({ queryKey: reservationKeys.all() });
      if (result.booking) {
        queryClient.setQueryData(reservationKeys.detail(result.booking.id), result.booking);
      }
      // A walk-in changes the dashboard summary for its date and the ops booking lists; the
      // dashboard updates now instead of waiting for realtime. The dashboard keys "today"
      // as a null date, so that summary is refreshed too.
      if (draft.restaurantId) {
        for (const date of [draft.date, null]) {
          void queryClient.invalidateQueries({
            queryKey: queryKeys.opsDashboard.summary(draft.restaurantId, date),
            exact: true,
          });
        }
      }
      void queryClient.invalidateQueries({ queryKey: queryKeys.opsBookings.listPrefix() });
    },
    onError: (error) => {
      if (isTerminalCreateError(error)) {
        intentKeyRef.current = null;
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
