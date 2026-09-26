'use client';

import { useMutationState, useQueryClient, type MutationOptions } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { toast } from 'sonner';

import { useBookingOfflineQueue } from '@/contexts/booking-offline-queue';
import { useOptionalBookingStateMachine } from '@/contexts/booking-state-machine';
import { useBookingService } from '@/contexts/ops-services';
import { track } from '@/lib/analytics';
import { HttpError } from '@/lib/http/errors';
import { queryKeys } from '@/lib/query/keys';

import {
  buildTableAssignments,
  cancelBookingQueries,
  captureBookingRollback,
  patchBookingCaches,
  readBookingRow,
  refreshBookingAfterConflict,
  rollbackBookingWrite,
  summaryKeysFor,
  type BookingRollback,
  type BookingRowPatch,
} from './bookingCacheSync';
import { recordBookingWrite } from './bookingWriteEcho';

import type { AppMutationMeta } from '@/lib/query/meta';
import type { BookingService, LifecycleResponse } from '@/services/ops/bookings';
import type { OpsBookingStatus, OpsTodayBooking } from '@/types/ops';
import type { QueryClient } from '@tanstack/react-query';

export type BookingLifecycleAction = 'check-in' | 'check-out' | 'no-show' | 'undo-no-show';

export type BookingLifecycleVariables = {
  action: BookingLifecycleAction;
  restaurantId: string;
  bookingId: string;
  /** The summary date the caller shows; used only for analytics. Caches are patched by booking. */
  targetDate?: string | null;
  performedAt?: string | null;
  reason?: string | null;
};

export type BookingLifecycleOutcome =
  | { status: 'done'; result: LifecycleResponse }
  | { status: 'queued' }
  | { status: 'failed'; error: unknown };

export type PendingLifecycleSnapshot = Pick<OpsTodayBooking, 'status' | 'startTime' | 'endTime'>;

export type PendingLifecycleAction = {
  bookingId: string;
  action: BookingLifecycleAction;
  /** The booking as it was before the action, so lists can keep its position while pending. */
  snapshot: PendingLifecycleSnapshot | null;
};

type LifecycleContext = {
  rollback: BookingRollback;
  previous: PendingLifecycleSnapshot | null;
  transitionStarted: boolean;
};

export type UseBookingLifecycleOptions = {
  /**
   * Toasts for success, failure and offline queueing. Default true. Pass false when the caller
   * shows its own copy (the floor plan); conflict refresh and cache sync still happen.
   */
  feedback?: boolean;
  /** Guest label for toasts; falls back to the cached customer name. */
  getBookingLabel?: (bookingId: string) => string | null | undefined;
};

export const BOOKING_STATE_CONFLICT_COPY =
  'This booking was already updated by someone else — refreshed.';

const LIFECYCLE_ERROR_COPY: Partial<Record<string, string>> = {
  BOOKING_STATE_CONFLICT: BOOKING_STATE_CONFLICT_COPY,
  LIFECYCLE_DATE_LOCKED: 'This booking can only be updated on its reservation date.',
  NO_SHOW_HISTORY_MISSING: 'There is no no-show to undo for this booking.',
  INVALID_TIMESTAMP: 'That time is not valid for this booking.',
  BOOKING_NOT_FOUND: 'This booking no longer exists.',
};

const ACTION_FALLBACK: Record<BookingLifecycleAction, string> = {
  'check-in': 'Unable to seat the guest. Try again.',
  'check-out': 'Unable to finish the booking. Try again.',
  'no-show': 'Unable to mark the no-show. Try again.',
  'undo-no-show': 'Unable to undo the no-show. Try again.',
};

const QUEUED_COPY: Record<BookingLifecycleAction, string> = {
  'check-in': 'Queued seat',
  'check-out': 'Queued finish',
  'no-show': 'Queued no-show',
  'undo-no-show': 'Queued undo no-show',
};

const ANALYTICS_EVENTS = {
  'check-in': ['booking_check_in'],
  'check-out': ['booking_check_out', 'booking_completed'],
  'no-show': ['booking_no_show'],
  'undo-no-show': [],
} as const satisfies Record<BookingLifecycleAction, readonly string[]>;

/** Only BOOKING_STATE_CONFLICT means the booking changed elsewhere (not e.g. LIFECYCLE_DATE_LOCKED). */
function isStateConflict(error: unknown): error is HttpError {
  return (
    error instanceof HttpError && error.status === 409 && error.code === 'BOOKING_STATE_CONFLICT'
  );
}

/** Statuses an undo-no-show restores; a 409 carrying one of them is a replay of our own undo. */
const UNDO_NO_SHOW_RESTORED: ReadonlySet<OpsBookingStatus> = new Set([
  'pending',
  'pending_allocation',
  'confirmed',
]);

/**
 * no-show and undo-no-show are not same-state idempotent: a replay after success answers 409
 * BOOKING_STATE_CONFLICT with the already-applied status (S3a contract). Those are successes.
 */
function replayedStatus(
  action: BookingLifecycleAction,
  error: unknown,
): OpsBookingStatus | null {
  if (!isStateConflict(error)) return null;
  const current = conflictCurrentStatus(error);
  if (!current) return null;
  if (action === 'no-show' && current === 'no_show') return current;
  if (action === 'undo-no-show' && UNDO_NO_SHOW_RESTORED.has(current)) return current;
  return null;
}

function conflictCurrentStatus(error: HttpError): OpsBookingStatus | null {
  const details = error.details as Record<string, unknown> | undefined;
  const value = details?.currentStatus ?? details?.status;
  return typeof value === 'string' ? (value as OpsBookingStatus) : null;
}

function callService(
  service: BookingService,
  variables: BookingLifecycleVariables,
): Promise<LifecycleResponse> {
  const performedAt = variables.performedAt ?? undefined;
  switch (variables.action) {
    case 'check-in':
      return service.checkInBooking({ id: variables.bookingId, performedAt });
    case 'check-out':
      return service.checkOutBooking({ id: variables.bookingId, performedAt });
    case 'no-show':
      return service.markNoShowBooking({
        id: variables.bookingId,
        performedAt,
        reason: variables.reason ?? undefined,
      });
    case 'undo-no-show':
      return service.undoNoShowBooking({
        id: variables.bookingId,
        reason: variables.reason ?? undefined,
      });
  }
}

/** The optimistic patch; undo-no-show has none because the restored status is server-decided. */
function optimisticPatch(variables: BookingLifecycleVariables): BookingRowPatch | null {
  const at = variables.performedAt ?? new Date().toISOString();
  switch (variables.action) {
    case 'check-in':
      return { status: 'checked_in', checkedInAt: at };
    case 'check-out':
      return { status: 'completed', checkedOutAt: at };
    case 'no-show':
      return { status: 'no_show' };
    case 'undo-no-show':
      return null;
  }
}

function applyCanonicalResult(
  queryClient: QueryClient,
  variables: BookingLifecycleVariables,
  result: LifecycleResponse,
): void {
  const canonical = result.booking;
  const patch: BookingRowPatch = {
    status: canonical?.status ?? result.status,
    checkedInAt: canonical ? canonical.checkedInAt : result.checkedInAt,
    checkedOutAt: canonical ? canonical.checkedOutAt : result.checkedOutAt,
  };
  let needsRevalidation = false;
  if (result.assignments) {
    const { groups, complete } = buildTableAssignments(
      queryClient,
      variables.restaurantId,
      variables.bookingId,
      result.assignments.map((row) => row.table_id),
    );
    patch.tableAssignments = groups;
    needsRevalidation = !complete;
  }
  patchBookingCaches(queryClient, variables.bookingId, patch, {
    restaurantId: variables.restaurantId,
    pruneLists: true,
  });
  recordBookingWrite(queryClient, variables.bookingId, {
    status: patch.status ?? null,
    updatedAt: canonical?.updatedAt ?? null,
  });
  // Totals are recomputed from the patched rows; counts that live elsewhere are refreshed lazily.
  void queryClient.invalidateQueries({
    queryKey: queryKeys.opsDashboard.heatmapPrefix(variables.restaurantId),
  });
  void queryClient.invalidateQueries({
    queryKey: queryKeys.opsBookings.statusSummaryPrefix(variables.restaurantId),
  });
  if (needsRevalidation) {
    // Restored tables we cannot name from cache: one targeted summary revalidation.
    for (const key of summaryKeysFor(queryClient, variables.restaurantId)) {
      void queryClient.invalidateQueries({ queryKey: key, exact: true });
    }
  }
}

function successCopy(
  variables: BookingLifecycleVariables,
  result: LifecycleResponse,
  label: string,
): string | null {
  switch (variables.action) {
    case 'check-in':
      return `Seated: ${label}`;
    case 'check-out':
      return `Finished: ${label}`;
    case 'no-show':
      // Shown by the hook itself, because it carries an Undo action.
      return null;
    case 'undo-no-show': {
      const restoration = result.tableRestoration?.status;
      if (restoration === 'unavailable' || restoration === 'unknown') {
        return `No-show undone for ${label}. Tables were not restored, so assign a table.`;
      }
      return `Undo no-show: ${label}`;
    }
  }
}

/**
 * The one lifecycle mutation path for ops bookings (dashboard, bookings list, booking dialog and
 * floor plan).
 *
 * - Per-booking ordering: each write runs in the mutation scope `booking:<id>`, so rapid clicks on
 *   one booking serialize while different bookings run in parallel.
 * - Optimistic status (except undo-no-show, whose restored status only the server knows), with a
 *   per-booking rollback across every cache.
 * - Success writes the canonical server row into every cache (summaries, lists, detail, dialog
 *   bundle) and drops rows from status-filtered lists they no longer match. Nothing is refetched,
 *   except lazily-invalidated counts that live outside the booking rows.
 * - 409 conflicts show the conflict copy and refresh only that booking.
 * - Feedback through `meta.feedback` (the global MutationCache toast), opt-out per hook.
 * - Offline: the action is queued in the offline queue and runs on reconnect.
 *
 * `run` never rejects: it resolves `done`, `queued` or `failed` (feedback already shown).
 */
export function useBookingLifecycle(options: UseBookingLifecycleOptions = {}) {
  const { feedback = true, getBookingLabel } = options;
  const bookingService = useBookingService();
  const queryClient = useQueryClient();
  const offlineQueue = useBookingOfflineQueue();
  const stateMachine = useOptionalBookingStateMachine();

  // The no-show toast's Undo runs through `run`, which is defined after `execute`.
  const runRef = useRef<((variables: BookingLifecycleVariables) => Promise<BookingLifecycleOutcome>) | null>(null);

  const labelFor = useCallback(
    (bookingId: string) =>
      getBookingLabel?.(bookingId) ??
      readBookingRow(queryClient, bookingId)?.customerName ??
      'the booking',
    [getBookingLabel, queryClient],
  );

  const execute = useCallback(
    function executeLifecycle(variables: BookingLifecycleVariables): Promise<LifecycleResponse> {
      const label = labelFor(variables.bookingId);
      const meta: AppMutationMeta | undefined = feedback
        ? {
            feedback: {
              success: (data) => successCopy(variables, data as LifecycleResponse, label),
              error: { copy: LIFECYCLE_ERROR_COPY, fallback: ACTION_FALLBACK[variables.action] },
            },
          }
        : undefined;

      const mutationOptions: MutationOptions<
        LifecycleResponse,
        unknown,
        BookingLifecycleVariables,
        LifecycleContext
      > = {
        mutationKey: queryKeys.opsBookings.lifecycleMutation(),
        scope: { id: `booking:${variables.bookingId}` },
        meta,
        mutationFn: async (vars) => {
          try {
            return await callService(bookingService, vars);
          } catch (error) {
            const replayed = replayedStatus(vars.action, error);
            if (replayed) {
              return { status: replayed, checkedInAt: null, checkedOutAt: null, changed: false };
            }
            throw error;
          }
        },
        onMutate: async (vars) => {
          await cancelBookingQueries(queryClient, vars.bookingId, vars.restaurantId);
          const rollback = captureBookingRollback(queryClient, vars.bookingId);
          const row = readBookingRow(queryClient, vars.bookingId);
          const previous = row
            ? { status: row.status, startTime: row.startTime, endTime: row.endTime }
            : null;
          const patch = optimisticPatch(vars);
          let transitionStarted = false;
          if (patch?.status) {
            patchBookingCaches(queryClient, vars.bookingId, patch, {
              restaurantId: vars.restaurantId,
            });
            stateMachine?.beginTransition(vars.bookingId, patch.status, {
              action: vars.action,
              performedAt: vars.performedAt ?? null,
            });
            transitionStarted = Boolean(stateMachine);
          }
          return { rollback, previous, transitionStarted };
        },
        onSuccess: (result, vars, context) => {
          applyCanonicalResult(queryClient, vars, result);
          if (context?.transitionStarted) {
            stateMachine?.commitTransition({
              id: vars.bookingId,
              status: result.booking?.status ?? result.status,
              updatedAt: result.booking?.updatedAt ?? null,
            });
          }
          for (const event of ANALYTICS_EVENTS[vars.action]) {
            track(event, {
              booking_id: vars.bookingId,
              restaurant_id: vars.restaurantId,
              date: vars.targetDate ?? null,
              is_online: true,
            });
          }
          if (feedback && vars.action === 'no-show') {
            toast.success(`Marked no-show: ${label}`, {
              duration: 5000,
              action: {
                label: 'Undo',
                onClick: () => {
                  void runRef.current?.({
                    ...vars,
                    action: 'undo-no-show',
                    performedAt: null,
                    reason: null,
                  });
                },
              },
            });
          }
        },
        onError: (error, vars, context) => {
          const rollback = context ? rollbackBookingWrite(queryClient, context.rollback) : 'restored';
          if (context?.transitionStarted) stateMachine?.rollbackTransition(vars.bookingId);
          // A write still queued on this booking settles it; otherwise refresh the one booking
          // when it changed elsewhere, or when our snapshot held an earlier write's guess.
          if (rollback !== 'deferred' && (isStateConflict(error) || rollback === 'refresh')) {
            void refreshBookingAfterConflict(queryClient, {
              bookingId: vars.bookingId,
              restaurantId: vars.restaurantId,
              currentStatus: isStateConflict(error) ? conflictCurrentStatus(error) : null,
              fetchBooking: () => bookingService.getBooking(vars.bookingId),
            });
          }
        },
      };

      return queryClient.getMutationCache().build(queryClient, mutationOptions).execute(variables);
    },
    [bookingService, feedback, labelFor, queryClient, stateMachine],
  );

  const run = useCallback(
    async (variables: BookingLifecycleVariables): Promise<BookingLifecycleOutcome> => {
      if (offlineQueue?.isOffline) {
        const label = labelFor(variables.bookingId);
        offlineQueue.enqueue({
          bookingId: variables.bookingId,
          action: variables.action,
          label: QUEUED_COPY[variables.action],
          perform: () => execute(variables),
        });
        if (feedback) {
          toast.message(`${QUEUED_COPY[variables.action]}: ${label}`, {
            description: 'This will sync automatically once you reconnect.',
          });
        }
        return { status: 'queued' };
      }
      try {
        return { status: 'done', result: await execute(variables) };
      } catch (error) {
        return { status: 'failed', error };
      }
    },
    [execute, feedback, labelFor, offlineQueue],
  );

  useEffect(() => {
    runRef.current = run;
  }, [run]);

  const pendingEntries = useMutationState({
    filters: { mutationKey: queryKeys.opsBookings.lifecycleMutation(), status: 'pending' },
    select: (mutation) => ({
      variables: mutation.state.variables as BookingLifecycleVariables | undefined,
      context: mutation.state.context as LifecycleContext | undefined,
    }),
  });

  const pendingActions = useMemo(() => {
    const byBooking: Record<string, PendingLifecycleAction> = {};
    for (const entry of pendingEntries) {
      const variables = entry.variables;
      if (!variables || byBooking[variables.bookingId]) continue;
      byBooking[variables.bookingId] = {
        bookingId: variables.bookingId,
        action: variables.action,
        snapshot: entry.context?.previous ?? null,
      };
    }
    return byBooking;
  }, [pendingEntries]);

  return { run, pendingActions };
}

export type BookingLifecycle = ReturnType<typeof useBookingLifecycle>;
