'use client';

import { useMutationState, useQueryClient, type MutationOptions } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import { useBookingService } from '@/contexts/ops-services';
import { HttpError } from '@/lib/http/errors';
import { queryKeys } from '@/lib/query/keys';

import {
  cancelBookingQueries,
  captureBookingRollback,
  patchBookingCaches,
  readBookingRow,
  refreshBookingAfterConflict,
  rollbackBookingWrite,
  type BookingRollback,
} from './bookingCacheSync';
import { recordBookingWrite } from './bookingWriteEcho';

import type { AppMutationMeta } from '@/lib/query/meta';
import type { OpsBookingStatus } from '@/types/ops';

export type CancelBookingVariables = {
  bookingId: string;
  restaurantId: string;
  /** Kept for callers that still pass it; caches are patched by booking, on every date. */
  targetDate?: string | null;
};

export type CancelBookingResult = { id: string; status: string };

export type CancelBookingOutcome =
  | { status: 'done'; result: CancelBookingResult }
  | { status: 'failed'; error: unknown };

type CancelContext = { rollback: BookingRollback };

const CANCEL_ERROR_COPY: Partial<Record<string, string>> = {
  BOOKING_NOT_CANCELLABLE:
    'This booking can no longer be cancelled: it was seated, finished or marked as a no-show.',
  BOOKING_STATE_CONFLICT: 'This booking was already updated by someone else — refreshed.',
  CUTOFF_PASSED: 'This booking can no longer be cancelled.',
  BOOKING_NOT_FOUND: 'This booking no longer exists.',
};

function currentStatusOf(error: unknown): OpsBookingStatus | null {
  if (!(error instanceof HttpError) || error.status !== 409) return null;
  const details = error.details as Record<string, unknown> | undefined;
  const value = details?.currentStatus;
  return typeof value === 'string' ? (value as OpsBookingStatus) : null;
}

/**
 * The one ops cancellation mutation. Optimistic across every cache holding the booking
 * (summaries, lists, detail, dialog bundle) with a per-booking rollback that restores the lists
 * too. Runs in the booking's mutation scope, so it queues behind a lifecycle write on the same
 * booking. `cancel` never rejects; feedback is a toast unless `feedback: false`.
 */
export function useOpsCancelBooking(options: { feedback?: boolean } = {}) {
  const { feedback = true } = options;
  const bookingService = useBookingService();
  const queryClient = useQueryClient();

  const execute = useCallback(
    (variables: CancelBookingVariables): Promise<CancelBookingResult> => {
      const label = readBookingRow(queryClient, variables.bookingId)?.customerName ?? 'the booking';
      const meta: AppMutationMeta | undefined = feedback
        ? {
            feedback: {
              success: `Cancelled: ${label}`,
              error: {
                copy: CANCEL_ERROR_COPY,
                fallback: 'Unable to cancel the booking. Try again.',
              },
            },
          }
        : undefined;

      const mutationOptions: MutationOptions<
        CancelBookingResult,
        unknown,
        CancelBookingVariables,
        CancelContext
      > = {
        mutationKey: queryKeys.opsBookings.cancelMutation(),
        scope: { id: `booking:${variables.bookingId}` },
        meta,
        mutationFn: ({ bookingId }) => bookingService.cancelBooking({ id: bookingId }),
        onMutate: async ({ bookingId, restaurantId }) => {
          await cancelBookingQueries(queryClient, bookingId, restaurantId);
          const rollback = captureBookingRollback(queryClient, bookingId);
          patchBookingCaches(queryClient, bookingId, { status: 'cancelled' }, { restaurantId });
          return { rollback };
        },
        onSuccess: (result, { bookingId, restaurantId }) => {
          const status = (result.status || 'cancelled') as OpsBookingStatus;
          patchBookingCaches(
            queryClient,
            bookingId,
            { status },
            { restaurantId, pruneLists: true },
          );
          recordBookingWrite(queryClient, bookingId, { status });
          void queryClient.invalidateQueries({
            queryKey: queryKeys.opsDashboard.heatmapPrefix(restaurantId),
          });
          void queryClient.invalidateQueries({
            queryKey: queryKeys.opsBookings.statusSummaryPrefix(restaurantId),
          });
        },
        onError: (error, { bookingId, restaurantId }, context) => {
          const rollback = context ? rollbackBookingWrite(queryClient, context.rollback) : 'restored';
          if (rollback === 'deferred') return;
          if ((error instanceof HttpError && error.status === 409) || rollback === 'refresh') {
            void refreshBookingAfterConflict(queryClient, {
              bookingId,
              restaurantId,
              currentStatus: currentStatusOf(error),
              fetchBooking: () => bookingService.getBooking(bookingId),
            });
          }
        },
      };

      return queryClient.getMutationCache().build(queryClient, mutationOptions).execute(variables);
    },
    [bookingService, feedback, queryClient],
  );

  const cancel = useCallback(
    async (variables: CancelBookingVariables): Promise<CancelBookingOutcome> => {
      try {
        return { status: 'done', result: await execute(variables) };
      } catch (error) {
        return { status: 'failed', error };
      }
    },
    [execute],
  );

  const pendingIds = useMutationState({
    filters: { mutationKey: queryKeys.opsBookings.cancelMutation(), status: 'pending' },
    select: (mutation) =>
      (mutation.state.variables as CancelBookingVariables | undefined)?.bookingId,
  });

  const pendingBookingIds = useMemo(
    () => new Set(pendingIds.filter((id): id is string => typeof id === 'string')),
    [pendingIds],
  );

  const isPending = useCallback(
    (bookingId: string | null | undefined) =>
      Boolean(bookingId && pendingBookingIds.has(bookingId)),
    [pendingBookingIds],
  );

  return { cancel, isPending, pendingBookingIds };
}

export type OpsCancelBooking = ReturnType<typeof useOpsCancelBooking>;
