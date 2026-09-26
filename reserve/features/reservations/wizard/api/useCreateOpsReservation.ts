'use client';

import {
  useMutation,
  useQueryClient,
  type MutateOptions,
  type UseMutationResult,
} from '@tanstack/react-query';
import { useCallback } from 'react';

import { emit } from '@/lib/analytics/emit';
import { fetchJson } from '@/lib/http/fetchJson';
import { queryKeys } from '@/lib/query/keys';
import { generateIdempotencyKey } from '@/lib/utils/idempotency';
import { reservationAdapter, reservationListAdapter } from '@entities/reservation/adapter';
import { reservationKeys } from '@shared/api/queryKeys';
import { track } from '@shared/lib/analytics';

import {
  createConflictRetryDelay,
  createIntentKeyStore,
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

const intentKeys = createIntentKeyStore(generateIdempotencyKey);

/** Forget the current walk-in intent's key (tests, or an explicit "start a new booking"). */
export function clearCreateOpsReservationIntentKey(): void {
  intentKeys.clear();
}

/** C5: the key lives in the variables, fixed at mutate() time (see useCreateReservation). */
function withIntentKey(variables: CreateOpsReservationVariables): CreateOpsReservationVariables {
  if (variables.idempotencyKey) return variables;
  const { key } = intentKeys.resolve(
    reservationDraftFingerprint(variables.draft, variables.bookingId),
  );
  return { ...variables, idempotencyKey: key };
}

type CreateOpsReservationMutation = UseMutationResult<
  ReservationSubmissionResult,
  OpsReservationError,
  CreateOpsReservationVariables
>;
type CreateOpsReservationMutateOptions = MutateOptions<
  ReservationSubmissionResult,
  OpsReservationError,
  CreateOpsReservationVariables
>;

export function useCreateOpsReservation(): CreateOpsReservationMutation {
  const queryClient = useQueryClient();

  const mutation = useMutation<
    ReservationSubmissionResult,
    OpsReservationError,
    CreateOpsReservationVariables
  >({
    networkMode: 'offlineFirst',
    meta: { persist: true },
    // A transient 409 BOOKING_CONFLICT (retryable) is retried once, with the same key.
    retry: shouldRetryCreateConflict,
    retryDelay: createConflictRetryDelay,
    mutationFn: async (variables) => {
      const { draft, bookingId, idempotencyKey } = variables;
      if (bookingId) {
        throw Object.assign(new Error('Editing bookings is not supported in ops wizard'), {
          code: 'UNSUPPORTED_OPERATION',
        });
      }

      if (!idempotencyKey) {
        throw Object.assign(new Error('This booking request could not be sent. Please try again.'), {
          code: 'MISSING_IDEMPOTENCY_KEY',
        });
      }

      const payload = buildOpsBookingPayload(draft);

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
      intentKeys.clear();
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
        intentKeys.clear();
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

  const { mutate, mutateAsync } = mutation;
  const mutateWithKey = useCallback(
    (variables: CreateOpsReservationVariables, options?: CreateOpsReservationMutateOptions) =>
      mutate(withIntentKey(variables), options),
    [mutate],
  );
  const mutateAsyncWithKey = useCallback(
    (variables: CreateOpsReservationVariables, options?: CreateOpsReservationMutateOptions) =>
      mutateAsync(withIntentKey(variables), options),
    [mutateAsync],
  );

  return { ...mutation, mutate: mutateWithKey, mutateAsync: mutateAsyncWithKey };
}
