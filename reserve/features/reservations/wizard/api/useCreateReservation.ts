'use client';

import {
  useMutation,
  useQueryClient,
  type MutateOptions,
  type UseMutationResult,
} from '@tanstack/react-query';
import { useCallback, useRef } from 'react';

import { emit } from '@/lib/analytics/emit';
import { generateIdempotencyKey } from '@/lib/utils/idempotency';
import { reservationAdapter, reservationListAdapter } from '@entities/reservation/adapter';
import { apiClient, type ApiError } from '@shared/api/client';
import { reservationKeys } from '@shared/api/queryKeys';
import { env } from '@shared/config/env';
import { track } from '@shared/lib/analytics';

import {
  createConflictRetryDelay,
  createIntentKeyStore,
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

const intentKeys = createIntentKeyStore(generateIdempotencyKey);

/** Forget the current booking intent's key (tests, or an explicit "start a new booking"). */
export function clearCreateReservationIntentKey(): void {
  intentKeys.clear();
}

type CreateReservationMutation = UseMutationResult<
  ReservationSubmissionResult,
  ApiError,
  CreateReservationVariables
>;
type CreateReservationMutateOptions = MutateOptions<
  ReservationSubmissionResult,
  ApiError,
  CreateReservationVariables
>;

function missingIdempotencyKeyError(): ApiError {
  return {
    code: 'MISSING_IDEMPOTENCY_KEY',
    message: 'This booking request could not be sent. Please try again.',
  } as ApiError;
}

export function useCreateReservation(): CreateReservationMutation {
  const queryClient = useQueryClient();
  // Privacy-safe correlation: attemptId is a random UUID stable across retries
  // of one logical submission; attemptCount distinguishes retries. Both are
  // sent as headers so server booking_create_* events can be joined to the
  // client wizard_submit_failed event.
  const attemptIdRef = useRef<string | null>(null);
  const attemptCountRef = useRef(0);

  // C5: the key lives in the mutation variables, fixed at mutate() time, so every retry and a
  // resumed mutation send the same key; mutationFn never generates one.
  const withIntentKey = useCallback(
    (variables: CreateReservationVariables): CreateReservationVariables => {
      if (variables.idempotencyKey) return variables;
      const { key, isNew } = intentKeys.resolve(
        reservationDraftFingerprint(variables.draft, variables.bookingId),
      );
      if (isNew) {
        attemptIdRef.current = null;
        attemptCountRef.current = 0;
      }
      return { ...variables, idempotencyKey: key };
    },
    [],
  );

  const mutation = useMutation<ReservationSubmissionResult, ApiError, CreateReservationVariables>({
    networkMode: 'offlineFirst',
    meta: { persist: true },
    // A transient 409 BOOKING_CONFLICT (retryable) is retried once after its retryAfter,
    // with the same key: the server either inserts or replays the first attempt's booking.
    retry: shouldRetryCreateConflict,
    retryDelay: createConflictRetryDelay,
    mutationFn: async (variables) => {
      const { draft, bookingId, idempotencyKey } = variables;
      if (!idempotencyKey) {
        throw missingIdempotencyKeyError();
      }
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
      intentKeys.clear();
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
        intentKeys.clear();
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

  const { mutate, mutateAsync } = mutation;
  const mutateWithKey = useCallback(
    (variables: CreateReservationVariables, options?: CreateReservationMutateOptions) =>
      mutate(withIntentKey(variables), options),
    [mutate, withIntentKey],
  );
  const mutateAsyncWithKey = useCallback(
    (variables: CreateReservationVariables, options?: CreateReservationMutateOptions) =>
      mutateAsync(withIntentKey(variables), options),
    [mutateAsync, withIntentKey],
  );

  return { ...mutation, mutate: mutateWithKey, mutateAsync: mutateAsyncWithKey };
}
