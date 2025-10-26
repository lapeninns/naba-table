'use client';

import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';

import { useTransitionToast, useBookingErrorBoundary } from '@/components/features/booking-state-machine';
import { useBookingOfflineQueue } from '@/contexts/booking-offline-queue';
import { useOptionalBookingStateMachine } from '@/contexts/booking-state-machine';
import { useBookingService } from '@/contexts/ops-services';
import { HttpError } from '@/lib/http/errors';
import { queryKeys } from '@/lib/query/keys';

import type { OpsBookingStatus, OpsTodayBooking, OpsTodayBookingsSummary } from '@/types/ops';

export type UpdateBookingStatusVariables = {
  restaurantId: string;
  bookingId: string;
  status: 'completed' | 'no_show';
  targetDate?: string | null;
};

export type BookingLifecycleVariables = {
  restaurantId: string;
  bookingId: string;
  performedAt?: string | null;
  targetDate?: string | null;
};

export type BookingLifecycleWithReasonVariables = BookingLifecycleVariables & {
  reason?: string | null;
};

type LifecycleMutationResult = {
  status: OpsBookingStatus;
  checkedInAt: string | null;
  checkedOutAt: string | null;
};

type MutationContext = {
  bookingId: string;
  summaryKey?: ReturnType<(typeof queryKeys)['opsDashboard']['summary']>;
  previousSummary?: OpsTodayBookingsSummary;
};

type OfflineActionType = 'check-in' | 'check-out' | 'no-show' | 'undo-no-show' | 'status-update';

function useInvalidateLifecycle(queryClient: ReturnType<typeof useQueryClient>) {
  return (restaurantId: string, targetDate?: string | null) => {
    const summaryKey = queryKeys.opsDashboard.summary(restaurantId, targetDate ?? null);
    queryClient.invalidateQueries({ queryKey: summaryKey });
    queryClient.invalidateQueries({ queryKey: ['ops', 'dashboard', restaurantId, 'heatmap'], exact: false });
    queryClient.invalidateQueries({ queryKey: ['ops', 'bookings'], exact: false });
  };
}

function toPayloadTimestamp(value?: string | null): string | undefined {
  if (!value) return undefined;
  return value;
}

export function useOpsBookingLifecycleActions() {
  const bookingService = useBookingService();
  const queryClient = useQueryClient();
  const invalidate = useInvalidateLifecycle(queryClient);
  const bookingStateMachine = useOptionalBookingStateMachine();
  const transitionToast = useTransitionToast();
  const bookingErrorBoundary = useBookingErrorBoundary();
  const offlineQueue = useBookingOfflineQueue();

  const maybeQueueOffline = <TVariables extends { bookingId: string }>(
    action: OfflineActionType,
    variables: TVariables,
    label: string,
    executor: () => Promise<unknown>,
  ): boolean => {
    if (!offlineQueue || !offlineQueue.isOffline) {
      return false;
    }
    offlineQueue.enqueue({
      bookingId: variables.bookingId,
      action,
      label,
      perform: executor,
    });
    transitionToast.showQueued({
      action,
      bookingLabel: variables.bookingId,
    });
    return true;
  };

  const handleConflict = (
    error: Error,
    variables: { bookingId: string; restaurantId?: string | null; targetDate?: string | null },
    attemptedStatus: OpsBookingStatus,
  ): boolean => {
    if (!(error instanceof HttpError) || error.status !== 409 || !bookingErrorBoundary) {
      return false;
    }
    const entry = bookingStateMachine?.getEntry(variables.bookingId);
    const details = (error.details as Record<string, unknown> | undefined) ?? {};
    const detailsStatus = (details?.currentStatus ?? details?.status) as OpsBookingStatus | undefined;
    const detailsUpdatedAt = typeof details?.updatedAt === 'string' ? (details.updatedAt as string) : undefined;

    bookingErrorBoundary.reportConflict({
      bookingId: variables.bookingId,
      attemptedStatus,
      currentStatus: detailsStatus ?? entry?.status ?? null,
      message: error.message,
      updatedAt: detailsUpdatedAt ?? entry?.updatedAt ?? null,
      onReload:
        variables.restaurantId && typeof variables.restaurantId === 'string'
          ? () => invalidate(variables.restaurantId as string, variables.targetDate ?? null)
          : null,
    });
    return true;
  };

  const wrapMutation = <TData, TError, TVariables extends { bookingId: string }, TContext>(
    mutation: UseMutationResult<TData, TError, TVariables, TContext>,
    config: { action: OfflineActionType; label: (variables: TVariables) => string },
  ): typeof mutation => {
    const mutate: typeof mutation.mutate = (variables, options) => {
      const queued = maybeQueueOffline(config.action, variables, config.label(variables), () =>
        mutation.mutateAsync(variables, options as Parameters<typeof mutation.mutateAsync>[1]),
      );
      if (queued) {
        return;
      }
      mutation.mutate(variables, options);
    };

    const mutateAsync: typeof mutation.mutateAsync = async (variables, options) => {
      const queued = maybeQueueOffline(config.action, variables, config.label(variables), () =>
        mutation.mutateAsync(variables, options),
      );
      if (queued) {
        return Promise.resolve(undefined as TData) as Promise<TData>;
      }
      return mutation.mutateAsync(variables, options);
    };

    return {
      ...mutation,
      mutate,
      mutateAsync,
    };
  };

  const applyOptimisticTransition = (
    bookingId: string,
    expectedStatus: OpsBookingStatus,
    variables: { restaurantId?: string | null; targetDate?: string | null },
    patch: (booking: OpsTodayBooking) => OpsTodayBooking,
    meta: Record<string, unknown>,
  ): MutationContext => {
    let summaryKey: ReturnType<(typeof queryKeys)['opsDashboard']['summary']> | undefined;
    let previousSummary: OpsTodayBookingsSummary | undefined;

    if (variables.restaurantId) {
      summaryKey = queryKeys.opsDashboard.summary(variables.restaurantId, variables.targetDate ?? null);
      const currentSummary = queryClient.getQueryData<OpsTodayBookingsSummary>(summaryKey);
      if (currentSummary) {
        previousSummary = currentSummary;
        const updatedSummary: OpsTodayBookingsSummary = {
          ...currentSummary,
          bookings: currentSummary.bookings.map((booking) =>
            booking.id === bookingId ? patch({ ...booking }) : booking,
          ),
        };
        queryClient.setQueryData(summaryKey, updatedSummary);
      }
    }

    bookingStateMachine?.beginTransition(bookingId, expectedStatus, meta);

    return { bookingId, summaryKey, previousSummary };
  };

  const rollbackOptimisticTransition = (bookingId: string, context?: MutationContext) => {
    if (context?.summaryKey && context.previousSummary) {
      queryClient.setQueryData(context.summaryKey, context.previousSummary);
    }
    bookingStateMachine?.rollbackTransition(bookingId);
  };

  const commitOptimisticTransition = (
    bookingId: string,
    context: MutationContext | undefined,
    snapshot: { status: OpsBookingStatus; checkedInAt?: string | null; checkedOutAt?: string | null; updatedAt?: string | null },
  ) => {
    if (context?.summaryKey) {
      queryClient.setQueryData<OpsTodayBookingsSummary>(context.summaryKey, (current) => {
        if (!current) return current;
        return {
          ...current,
          bookings: current.bookings.map((booking) => {
            if (booking.id !== bookingId) {
              return booking;
            }
            const next: OpsTodayBooking = {
              ...booking,
              status: snapshot.status,
            };
            if (snapshot.checkedInAt !== undefined) {
              next.checkedInAt = snapshot.checkedInAt;
            }
            if (snapshot.checkedOutAt !== undefined) {
              next.checkedOutAt = snapshot.checkedOutAt;
            }
            return next;
          }),
        };
      });
    }

    bookingStateMachine?.commitTransition({
      id: bookingId,
      status: snapshot.status,
      updatedAt: snapshot.updatedAt ?? null,
    });
  };

  const markStatusMutation = useMutation<{ status: OpsBookingStatus }, Error, UpdateBookingStatusVariables, MutationContext>({
    mutationFn: ({ bookingId, status }) => bookingService.updateBookingStatus({ id: bookingId, status }),
    onMutate: (variables) => {
      return applyOptimisticTransition(
        variables.bookingId,
        variables.status,
        { restaurantId: variables.restaurantId, targetDate: variables.targetDate ?? null },
        (booking) => ({
          ...booking,
          status: variables.status,
        }),
        { action: 'mark-status', targetStatus: variables.status },
      );
    },
    onSuccess: (updated, variables, context) => {
      commitOptimisticTransition(variables.bookingId, context, { status: updated.status });
      invalidate(variables.restaurantId, variables.targetDate ?? null);
      transitionToast.showSuccess({ action: 'status-update' });
    },
    onError: (error, variables, context) => {
      rollbackOptimisticTransition(variables.bookingId, context);
      if (handleConflict(error, variables, variables.status)) {
        return;
      }
      transitionToast.showError({
        action: 'status-update',
        errorMessage: error.message || 'Failed to update booking',
      });
    },
  });

  const checkInMutation = useMutation<LifecycleMutationResult, Error, BookingLifecycleVariables, MutationContext>({
    mutationFn: ({ bookingId, performedAt }) =>
      bookingService.checkInBooking({ id: bookingId, performedAt: toPayloadTimestamp(performedAt) }),
    onMutate: (variables) => {
      const performedAt = variables.performedAt ?? new Date().toISOString();
      return applyOptimisticTransition(
        variables.bookingId,
        'checked_in',
        { restaurantId: variables.restaurantId, targetDate: variables.targetDate ?? null },
        (booking) => ({
          ...booking,
          status: 'checked_in',
          checkedInAt: performedAt,
          checkedOutAt: null,
        }),
        { action: 'check-in', performedAt },
      );
    },
    onSuccess: (updated, variables, context) => {
      commitOptimisticTransition(variables.bookingId, context, {
        status: updated.status,
        checkedInAt: updated.checkedInAt,
        checkedOutAt: updated.checkedOutAt,
      });
      invalidate(variables.restaurantId, variables.targetDate ?? null);
      transitionToast.showSuccess({ action: 'check-in' });
    },
    onError: (error, variables, context) => {
      rollbackOptimisticTransition(variables.bookingId, context);
      if (handleConflict(error, variables, 'checked_in')) {
        return;
      }
      transitionToast.showError({
        action: 'check-in',
        errorMessage: error.message || 'Failed to check in guest',
      });
    },
  });

  const checkOutMutation = useMutation<LifecycleMutationResult, Error, BookingLifecycleVariables, MutationContext>({
    mutationFn: ({ bookingId, performedAt }) =>
      bookingService.checkOutBooking({ id: bookingId, performedAt: toPayloadTimestamp(performedAt) }),
    onMutate: (variables) => {
      const performedAt = variables.performedAt ?? new Date().toISOString();
      return applyOptimisticTransition(
        variables.bookingId,
        'completed',
        { restaurantId: variables.restaurantId, targetDate: variables.targetDate ?? null },
        (booking) => ({
          ...booking,
          status: 'completed',
          checkedOutAt: performedAt,
        }),
        { action: 'check-out', performedAt },
      );
    },
    onSuccess: (updated, variables, context) => {
      commitOptimisticTransition(variables.bookingId, context, {
        status: updated.status,
        checkedInAt: updated.checkedInAt,
        checkedOutAt: updated.checkedOutAt,
      });
      invalidate(variables.restaurantId, variables.targetDate ?? null);
      transitionToast.showSuccess({ action: 'check-out' });
    },
    onError: (error, variables, context) => {
      rollbackOptimisticTransition(variables.bookingId, context);
      if (handleConflict(error, variables, 'completed')) {
        return;
      }
      transitionToast.showError({
        action: 'check-out',
        errorMessage: error.message || 'Failed to check out guest',
      });
    },
  });

  const markNoShowMutation = useMutation<LifecycleMutationResult, Error, BookingLifecycleWithReasonVariables, MutationContext>({
    mutationFn: ({ bookingId, performedAt, reason }) =>
      bookingService.markNoShowBooking({
        id: bookingId,
        performedAt: toPayloadTimestamp(performedAt),
        reason: reason ?? undefined,
      }),
    onMutate: (variables) => {
      const performedAt = variables.performedAt ?? null;
      return applyOptimisticTransition(
        variables.bookingId,
        'no_show',
        { restaurantId: variables.restaurantId, targetDate: variables.targetDate ?? null },
        (booking) => ({
          ...booking,
          status: 'no_show',
          checkedOutAt: booking.checkedOutAt,
          checkedInAt: booking.checkedInAt,
        }),
        { action: 'mark-no-show', performedAt },
      );
    },
    onSuccess: (updated, variables, context) => {
      commitOptimisticTransition(variables.bookingId, context, {
        status: updated.status,
        checkedInAt: updated.checkedInAt,
        checkedOutAt: updated.checkedOutAt,
      });
      invalidate(variables.restaurantId, variables.targetDate ?? null);
      transitionToast.showSuccess({ action: 'no-show' });
    },
    onError: (error, variables, context) => {
      rollbackOptimisticTransition(variables.bookingId, context);
      if (handleConflict(error, variables, 'no_show')) {
        return;
      }
      transitionToast.showError({
        action: 'no-show',
        errorMessage: error.message || 'Failed to mark booking as no-show',
      });
    },
  });

  const undoNoShowMutation = useMutation<LifecycleMutationResult, Error, BookingLifecycleWithReasonVariables, MutationContext>({
    mutationFn: ({ bookingId, reason }) =>
      bookingService.undoNoShowBooking({
        id: bookingId,
        reason: reason ?? undefined,
      }),
    onMutate: (variables) => {
      return applyOptimisticTransition(
        variables.bookingId,
        'confirmed',
        { restaurantId: variables.restaurantId, targetDate: variables.targetDate ?? null },
        (booking) => ({
          ...booking,
          status: 'confirmed',
        }),
        { action: 'undo-no-show' },
      );
    },
    onSuccess: (updated, variables, context) => {
      commitOptimisticTransition(variables.bookingId, context, {
        status: updated.status,
        checkedInAt: updated.checkedInAt,
        checkedOutAt: updated.checkedOutAt,
      });
      invalidate(variables.restaurantId, variables.targetDate ?? null);
      transitionToast.showSuccess({ action: 'undo-no-show' });
    },
    onError: (error, variables, context) => {
      rollbackOptimisticTransition(variables.bookingId, context);
      if (handleConflict(error, variables, 'confirmed')) {
        return;
      }
      transitionToast.showError({
        action: 'undo-no-show',
        errorMessage: error.message || 'Failed to undo no-show',
      });
    },
  });

  const markStatus = wrapMutation(markStatusMutation, {
    action: 'status-update',
    label: () => 'Update status',
  });
  const checkIn = wrapMutation(checkInMutation, {
    action: 'check-in',
    label: () => 'Check in',
  });
  const checkOut = wrapMutation(checkOutMutation, {
    action: 'check-out',
    label: () => 'Check out',
  });
  const markNoShow = wrapMutation(markNoShowMutation, {
    action: 'no-show',
    label: () => 'Mark no-show',
  });
  const undoNoShow = wrapMutation(undoNoShowMutation, {
    action: 'undo-no-show',
    label: () => 'Undo no-show',
  });

  return {
    markStatus,
    checkIn,
    checkOut,
    markNoShow,
    undoNoShow,
  };
}

export const useOpsBookingStatusActions = useOpsBookingLifecycleActions;
