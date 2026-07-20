'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';

import { emit } from '@/lib/analytics/emit';
import { reservationAdapter, reservationListAdapter } from '@entities/reservation/adapter';
import { apiClient, type ApiError } from '@shared/api/client';
import { reservationKeys } from '@shared/api/queryKeys';
import { env } from '@shared/config/env';
import { track } from '@shared/lib/analytics';

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

function generateClientId(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function useCreateReservation() {
  const queryClient = useQueryClient();
  const idempotencyKeyRef = useRef<string | null>(null);
  // Privacy-safe correlation: attemptId is a random UUID stable across retries
  // of one logical submission; attemptCount distinguishes retries. Both are
  // sent as headers so server booking_create_* events can be joined to the
  // client wizard_submit_failed event.
  const attemptIdRef = useRef<string | null>(null);
  const attemptCountRef = useRef(0);

  return useMutation<
    ReservationSubmissionResult,
    ApiError,
    { draft: ReservationDraft; bookingId?: string }
  >({
    networkMode: 'offlineFirst',
    meta: { persist: true },
    mutationFn: async ({ draft, bookingId }) => {
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
      const idempotencyKey = idempotencyKeyRef.current ?? generateClientId();
      idempotencyKeyRef.current = idempotencyKey;
      const attemptId = attemptIdRef.current ?? generateClientId();
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
      idempotencyKeyRef.current = null;
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
        idempotencyKeyRef.current = null;
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
