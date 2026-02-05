'use client';

import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';

import { useBookingErrorBoundary } from '@/components/features/booking-state-machine';
import { useBookingOfflineQueue } from '@/contexts/booking-offline-queue';
import { useOptionalBookingStateMachine } from '@/contexts/booking-state-machine';
import { useBookingService } from '@/contexts/ops-services';
import { HttpError } from '@/lib/http/errors';
import { queryKeys } from '@/lib/query/keys';

import type {
  OpsBookingListItem,
  OpsBookingsPage,
  OpsBookingStatus,
  OpsTodayBooking,
  OpsTodayBookingsSummary,
} from '@/types/ops';

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
  previousOpsBookingDetail?: OpsBookingListItem | undefined;
};

type OfflineActionType = 'check-in' | 'check-out' | 'no-show' | 'undo-no-show';

function useInvalidateLifecycle(queryClient: ReturnType<typeof useQueryClient>) {
  return (
    restaurantId: string,
    targetDate?: string | null,
    options: {
      invalidateSummary?: boolean;
      refetchSummary?: boolean;
    } = { invalidateSummary: true, refetchSummary: true },
  ) => {
    const { invalidateSummary = true, refetchSummary = true } = options;
    const summaryKey = queryKeys.opsDashboard.summary(restaurantId, targetDate ?? null);
    if (invalidateSummary) {
      console.log('[booking-lifecycle] Invalidating summary cache:', {
        summaryKey,
        refetchSummary,
      });
      queryClient.invalidateQueries({
        queryKey: summaryKey,
        // Ensure active queries are refetched to update the UI immediately
        refetchType: refetchSummary ? 'active' : 'none',
      });
    }
    queryClient.invalidateQueries({
      queryKey: ['ops', 'dashboard', restaurantId, 'heatmap'],
      exact: false,
    });
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
  const bookingErrorBoundary = useBookingErrorBoundary();
  const offlineQueue = useBookingOfflineQueue();
  const opsBookingsListKey = ['ops', 'bookings', 'list'] as const;

  const applyOpsBookingsPatch = (
    bookingId: string,
    patch: (booking: OpsBookingListItem) => OpsBookingListItem,
  ) => {
    queryClient.setQueriesData<OpsBookingsPage>(
      { queryKey: opsBookingsListKey, exact: false },
      (current) => {
        if (!current) return current;
        let didChange = false;
        const items = current.items.map((item) => {
          if (item.id !== bookingId) return item;
          didChange = true;
          return patch(item);
        });
        return didChange ? { ...current, items } : current;
      },
    );

    const detailKey = queryKeys.opsBookings.detail(bookingId);
    queryClient.setQueryData<OpsBookingListItem>(detailKey, (current) =>
      current ? patch(current) : current,
    );
  };

  const findOpsBookingInLists = (bookingId: string) => {
    const queries = queryClient.getQueriesData<OpsBookingsPage>({
      queryKey: opsBookingsListKey,
      exact: false,
    });
    for (const [, data] of queries) {
      const match = data?.items.find((item) => item.id === bookingId);
      if (match) return match;
    }
    return undefined;
  };

  const applyOpsBookingsSnapshot = (
    bookingId: string,
    snapshot: {
      status: OpsBookingStatus;
      checkedInAt?: string | null;
      checkedOutAt?: string | null;
    },
  ) => {
    applyOpsBookingsPatch(bookingId, (booking) => {
      const next: OpsBookingListItem = { ...booking, status: snapshot.status };
      if (snapshot.checkedInAt !== undefined) {
        next.checkedInAt = snapshot.checkedInAt;
      }
      if (snapshot.checkedOutAt !== undefined) {
        next.checkedOutAt = snapshot.checkedOutAt;
      }
      return next;
    });
  };

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
    const detailsStatus = (details?.currentStatus ?? details?.status) as
      | OpsBookingStatus
      | undefined;
    const detailsUpdatedAt =
      typeof details?.updatedAt === 'string' ? (details.updatedAt as string) : undefined;

    bookingErrorBoundary.reportConflict({
      bookingId: variables.bookingId,
      attemptedStatus,
      currentStatus: detailsStatus ?? entry?.status ?? null,
      message: error.message,
      updatedAt: detailsUpdatedAt ?? entry?.updatedAt ?? null,
      onReload:
        variables.restaurantId && typeof variables.restaurantId === 'string'
          ? () =>
              invalidate(variables.restaurantId as string, variables.targetDate ?? null, {
                invalidateSummary: true,
                refetchSummary: true,
              })
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

  const applyOptimisticTransition = async (
    bookingId: string,
    expectedStatus: OpsBookingStatus,
    variables: { restaurantId?: string | null; targetDate?: string | null },
    patch: (booking: OpsTodayBooking) => OpsTodayBooking,
    meta: Record<string, unknown>,
    listPatch?: (booking: OpsBookingListItem) => OpsBookingListItem,
  ): Promise<MutationContext> => {
    let summaryKey: ReturnType<(typeof queryKeys)['opsDashboard']['summary']> | undefined;
    let previousSummary: OpsTodayBookingsSummary | undefined;
    let previousOpsBookingDetail: OpsBookingListItem | undefined;

    if (variables.restaurantId) {
      summaryKey = queryKeys.opsDashboard.summary(
        variables.restaurantId,
        variables.targetDate ?? null,
      );

      // Cancel any in-flight refetches to prevent them from overwriting our optimistic update
      await queryClient.cancelQueries({ queryKey: summaryKey });

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

    if (listPatch) {
      const detailKey = queryKeys.opsBookings.detail(bookingId);
      previousOpsBookingDetail =
        queryClient.getQueryData<OpsBookingListItem>(detailKey) ?? findOpsBookingInLists(bookingId);
      applyOpsBookingsPatch(bookingId, listPatch);
    }

    bookingStateMachine?.beginTransition(bookingId, expectedStatus, meta);

    return { bookingId, summaryKey, previousSummary, previousOpsBookingDetail };
  };

  const rollbackOptimisticTransition = (bookingId: string, context?: MutationContext) => {
    if (context?.summaryKey && context.previousSummary) {
      queryClient.setQueryData(context.summaryKey, context.previousSummary);
    }
    if (context && 'previousOpsBookingDetail' in context) {
      if (context.previousOpsBookingDetail) {
        applyOpsBookingsPatch(
          bookingId,
          () => context.previousOpsBookingDetail as OpsBookingListItem,
        );
      } else {
        queryClient.invalidateQueries({ queryKey: opsBookingsListKey, exact: false });
      }
      queryClient.setQueryData(
        queryKeys.opsBookings.detail(bookingId),
        context.previousOpsBookingDetail,
      );
    }
    bookingStateMachine?.rollbackTransition(bookingId);
  };

  const commitOptimisticTransition = (
    bookingId: string,
    context: MutationContext | undefined,
    snapshot: {
      status: OpsBookingStatus;
      checkedInAt?: string | null;
      checkedOutAt?: string | null;
      updatedAt?: string | null;
    },
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

  const checkInMutation = useMutation<
    LifecycleMutationResult,
    Error,
    BookingLifecycleVariables,
    MutationContext
  >({
    mutationFn: ({ bookingId, performedAt }) =>
      bookingService.checkInBooking({
        id: bookingId,
        performedAt: toPayloadTimestamp(performedAt),
      }),
    onMutate: async (variables) => {
      const performedAt = variables.performedAt ?? null;
      const optimisticCheckedInAt = performedAt ?? new Date().toISOString();
      return await applyOptimisticTransition(
        variables.bookingId,
        'checked_in',
        { restaurantId: variables.restaurantId, targetDate: variables.targetDate ?? null },
        (booking) => ({
          ...booking,
          status: 'checked_in',
          checkedInAt: optimisticCheckedInAt,
        }),
        { action: 'check-in', performedAt },
        (booking) => ({
          ...booking,
          status: 'checked_in',
          checkedInAt: optimisticCheckedInAt,
        }),
      );
    },
    onSuccess: (updated, variables, context) => {
      commitOptimisticTransition(variables.bookingId, context, {
        status: updated.status,
        checkedInAt: updated.checkedInAt,
        checkedOutAt: updated.checkedOutAt,
      });
      applyOpsBookingsSnapshot(variables.bookingId, {
        status: updated.status,
        checkedInAt: updated.checkedInAt,
        checkedOutAt: updated.checkedOutAt,
      });
      invalidate(variables.restaurantId, variables.targetDate ?? null);
    },
    onError: (error, variables, context) => {
      rollbackOptimisticTransition(variables.bookingId, context);
      if (handleConflict(error, variables, 'checked_in')) {
        return;
      }
    },
  });

  const checkOutMutation = useMutation<
    LifecycleMutationResult,
    Error,
    BookingLifecycleVariables,
    MutationContext
  >({
    mutationFn: ({ bookingId, performedAt }) =>
      bookingService.checkOutBooking({
        id: bookingId,
        performedAt: toPayloadTimestamp(performedAt),
      }),
    onMutate: async (variables) => {
      const performedAt = variables.performedAt ?? null;
      const optimisticCheckedOutAt = performedAt ?? new Date().toISOString();
      return await applyOptimisticTransition(
        variables.bookingId,
        'completed',
        { restaurantId: variables.restaurantId, targetDate: variables.targetDate ?? null },
        (booking) => ({
          ...booking,
          status: 'completed',
          checkedOutAt: optimisticCheckedOutAt,
        }),
        { action: 'check-out', performedAt },
        (booking) => ({
          ...booking,
          status: 'completed',
          checkedOutAt: optimisticCheckedOutAt,
        }),
      );
    },
    onSuccess: (updated, variables, context) => {
      commitOptimisticTransition(variables.bookingId, context, {
        status: updated.status,
        checkedInAt: updated.checkedInAt,
        checkedOutAt: updated.checkedOutAt,
      });
      applyOpsBookingsSnapshot(variables.bookingId, {
        status: updated.status,
        checkedInAt: updated.checkedInAt,
        checkedOutAt: updated.checkedOutAt,
      });
      invalidate(variables.restaurantId, variables.targetDate ?? null);
    },
    onError: (error, variables, context) => {
      rollbackOptimisticTransition(variables.bookingId, context);
      if (handleConflict(error, variables, 'completed')) {
        return;
      }
    },
  });

  const markNoShowMutation = useMutation<
    LifecycleMutationResult,
    Error,
    BookingLifecycleWithReasonVariables,
    MutationContext
  >({
    mutationFn: ({ bookingId, performedAt, reason }) =>
      bookingService.markNoShowBooking({
        id: bookingId,
        performedAt: toPayloadTimestamp(performedAt),
        reason: reason ?? undefined,
      }),
    onMutate: async (variables) => {
      const performedAt = variables.performedAt ?? null;
      return await applyOptimisticTransition(
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
        (booking) => ({
          ...booking,
          status: 'no_show',
          checkedOutAt: booking.checkedOutAt ?? null,
          checkedInAt: booking.checkedInAt ?? null,
        }),
      );
    },
    onSuccess: (updated, variables, context) => {
      commitOptimisticTransition(variables.bookingId, context, {
        status: updated.status,
        checkedInAt: updated.checkedInAt,
        checkedOutAt: updated.checkedOutAt,
      });
      applyOpsBookingsSnapshot(variables.bookingId, {
        status: updated.status,
        checkedInAt: updated.checkedInAt,
        checkedOutAt: updated.checkedOutAt,
      });
      invalidate(variables.restaurantId, variables.targetDate ?? null);
    },
    onError: (error, variables, context) => {
      rollbackOptimisticTransition(variables.bookingId, context);
      if (handleConflict(error, variables, 'no_show')) {
        return;
      }
    },
  });

  const undoNoShowMutation = useMutation<
    LifecycleMutationResult,
    Error,
    BookingLifecycleWithReasonVariables,
    MutationContext
  >({
    mutationFn: ({ bookingId, reason }) =>
      bookingService.undoNoShowBooking({
        id: bookingId,
        reason: reason ?? undefined,
      }),
    onMutate: async (variables) => {
      return await applyOptimisticTransition(
        variables.bookingId,
        'confirmed',
        { restaurantId: variables.restaurantId, targetDate: variables.targetDate ?? null },
        (booking) => ({
          ...booking,
          status: 'confirmed',
        }),
        { action: 'undo-no-show' },
        (booking) => ({
          ...booking,
          status: 'confirmed',
        }),
      );
    },
    onSuccess: (updated, variables, context) => {
      commitOptimisticTransition(variables.bookingId, context, {
        status: updated.status,
        checkedInAt: updated.checkedInAt,
        checkedOutAt: updated.checkedOutAt,
      });
      applyOpsBookingsSnapshot(variables.bookingId, {
        status: updated.status,
        checkedInAt: updated.checkedInAt,
        checkedOutAt: updated.checkedOutAt,
      });
      invalidate(variables.restaurantId, variables.targetDate ?? null);
    },
    onError: (error, variables, context) => {
      rollbackOptimisticTransition(variables.bookingId, context);
      if (handleConflict(error, variables, 'confirmed')) {
        return;
      }
    },
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
    checkIn,
    checkOut,
    markNoShow,
    undoNoShow,
  };
}

export const useOpsBookingStatusActions = useOpsBookingLifecycleActions;
