'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';

import { emit } from '@/lib/analytics/emit';
import { generateIdempotencyKey } from '@/lib/utils/idempotency';
import { reservationAdapter, reservationListAdapter } from '@entities/reservation/adapter';
import { apiClient, type ApiError } from '@shared/api/client';
import { reservationKeys } from '@shared/api/queryKeys';
import { env } from '@shared/config/env';
import { track } from '@shared/lib/analytics';

import {
  createConflictRetryDelay,
  reservationDraftFingerprint,
  shouldRetryCreateConflict,
} from './createReservationRetry';

import type { ReservationSubmissionResult } from './types';
import type { ReservationDraft } from '../model/reducer';

function isTerminalCreateError(error: ApiError | null | undefined): boolean {
  if (!error) return false;
  if (
    error.code === 'VALIDATION_ERROR' ||
    error.code === 'UNAUTHENTICATED' ||
    error.code === 'FORBIDDEN'
  ) {
    return true;
  }
  return (
    typeof error.status === 'number' && [400, 401, 403, 404, 409, 410, 422].includes(error.status)
  );
}

export type CreateReservationVariables = {
  draft: ReservationDraft;
  bookingId?: string;
  /**
   * Key for this booking intent. When omitted, the hook keeps one key per draft content:
   * reused across retries and repeat submits of the same draft, replaced when it changes.
   */
  idempotencyKey?: string;
};

type IntentKey = { fingerprint: string; key: string };

export function useCreateReservation() {
  const queryClient = useQueryClient();
  const intentKeyRef = useRef<IntentKey | null>(null);
  // Privacy-safe correlation: attemptId is a random UUID stable across retries
  // of one logical submission; attemptCount distinguishes retries. Both are
  // sent as headers so server booking_create_* events can be joined to the
  // client wizard_submit_failed event.
  const attemptIdRef = useRef<string | null>(null);
  const attemptCountRef = useRef(0);

  const resolveIntentKey = ({ draft, bookingId, idempotencyKey }: CreateReservationVariables) => {
    if (idempotencyKey) return idempotencyKey;
    const fingerprint = reservationDraftFingerprint(draft, bookingId);
    if (intentKeyRef.current?.fingerprint !== fingerprint) {
      intentKeyRef.current = { fingerprint, key: generateIdempotencyKey() };
      attemptIdRef.current = null;
      attemptCountRef.current = 0;
    }
    return intentKeyRef.current.key;
  };

  return useMutation<ReservationSubmissionResult, ApiError, CreateReservationVariables>({
    networkMode: 'offlineFirst',
    meta: { persist: true },
    // A transient 409 BOOKING_CONFLICT (retryable) is retried once after its retryAfter,
    // with the same key: the server either inserts or replays the first attempt's booking.
    retry: shouldRetryCreateConflict,
    retryDelay: createConflictRetryDelay,
    onMutate: (variables) => {
      // The intent key is fixed per mutate() call, before the first attempt.
      resolveIntentKey(variables);
    },
    mutationFn: async (variables) => {
      const { draft, bookingId } = variables;
      const payload = {
        restaurantId: draft.restaurantId,
        restaurantSlug: draft.restaurantSlug,
        date: draft.date,
        time: draft.time,
        party: draft.party,
        bookingType: draft.bookingType,
        notes: draft.notes ?? undefined,
        name: draft.name,
        email: draft.email ?? undefined,
        phone: draft.phone ?? undefined,
        marketingOptIn: draft.marketingOptIn,
        whatsappOptIn: draft.whatsappOptIn,
      };

      const path = bookingId ? `/bookings/${bookingId}` : '/bookings';
      const method = bookingId ? apiClient.put : apiClient.post;
      const submissionTimeoutMs = Math.max(env.API_TIMEOUT_MS * 2, 30_000);
      // Resolved in onMutate; resolving again here covers a paused mutation resumed from
      // persistence after a reload, and returns the same key otherwise.
      const idempotencyKey = resolveIntentKey(variables);
      const attemptId = attemptIdRef.current ?? generateIdempotencyKey();
      attemptIdRef.current = attemptId;
      attemptCountRef.current += 1;
      const response = await method<{
        booking?: unknown;
        bookings?: unknown;
      }>(path, payload, {
        headers: {
          'Idempotency-Key': idempotencyKey,
          'X-Booking-Attempt-Id': attemptId,
          'X-Booking-Attempt': String(attemptCountRef.current),
        },
        timeoutMs: submissionTimeoutMs,
      });

      const booking = response?.booking ? reservationAdapter(response.booking) : null;
      const bookings = response?.bookings ? reservationListAdapter(response.bookings) : [];

      return {
        booking,
        bookings,
      } satisfies ReservationSubmissionResult;
    },
    onSuccess: (result) => {
      intentKeyRef.current = null;
      attemptIdRef.current = null;
      attemptCountRef.current = 0;
      queryClient.invalidateQueries({ queryKey: reservationKeys.all() });
      if (result.booking) {
        queryClient.setQueryData(reservationKeys.detail(result.booking.id), result.booking);
      }
    },
    onError: (error, variables) => {
      const attemptId = attemptIdRef.current;
      const attempt = attemptCountRef.current;
      if (isTerminalCreateError(error)) {
        intentKeyRef.current = null;
        attemptIdRef.current = null;
        attemptCountRef.current = 0;
      }
      if (error?.code === 'REQUEST_ABORTED') {
        return;
      }
      // wizard_submit_failed is the single canonical client failure event for a
      // customer submission (the retired reserve_submit_failed duplicated it);
      // the server emits booking_create_failed as the canonical outcome, joined
      // via attemptId.
      const payload = {
        code: error?.code ?? 'UNKNOWN',
        status: error?.status,
        bookingId: variables?.bookingId ?? null,
        context: 'customer' as const,
        ...(attemptId ? { attemptId } : {}),
        ...(attempt > 0 ? { attempt } : {}),
      };
      track('wizard_submit_failed', payload);
      emit('wizard_submit_failed', payload);
    },
  });
}
