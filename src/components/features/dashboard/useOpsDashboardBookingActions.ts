'use client';

import { useCallback, useMemo, useState } from 'react';

import type { useOpsBookingLifecycleActions } from '@/hooks/ops/useOpsBookingStatusActions';
import type { useOpsTableAssignmentActions } from '@/hooks/ops/useOpsTableAssignments';
import type { OpsTodayBooking, OpsTodayBookingsSummary } from '@/types/ops';

type PendingBookingSnapshot = Pick<OpsTodayBooking, 'status' | 'startTime' | 'endTime'>;

export type PendingBookingAction = {
  bookingId: string;
  action: 'check-in' | 'check-out' | 'no-show' | 'undo-no-show';
  snapshot?: PendingBookingSnapshot | null;
};

type UseOpsDashboardBookingActionsParams = {
  summary: OpsTodayBookingsSummary | null;
  restaurantId: string | null;
  selectedDate: string | null;
  bookingLifecycleMutations: ReturnType<typeof useOpsBookingLifecycleActions>;
  tableAssignmentActions: ReturnType<typeof useOpsTableAssignmentActions>;
};

export function useOpsDashboardBookingActions({
  summary,
  restaurantId,
  selectedDate,
  bookingLifecycleMutations,
  tableAssignmentActions,
}: UseOpsDashboardBookingActionsParams) {
  const [pendingBookingAction, setPendingBookingAction] = useState<PendingBookingAction | null>(
    null,
  );

  const getPendingSnapshot = useCallback(
    (bookingId: string) => {
      if (!summary) return null;
      const booking = summary.bookings.find((item) => item.id === bookingId);
      if (!booking) return null;
      return {
        status: booking.status,
        startTime: booking.startTime ?? null,
        endTime: booking.endTime ?? null,
      };
    },
    [summary],
  );

  const tableActionState = useMemo(() => {
    if (tableAssignmentActions.assignTable.isPending) {
      const variables = tableAssignmentActions.assignTable.variables;
      return {
        type: 'assign' as const,
        bookingId: variables?.bookingId ?? null,
        tableId: variables?.tableId ?? null,
        tableName: variables?.tableName,
      };
    }
    if (tableAssignmentActions.unassignTable.isPending) {
      const variables = tableAssignmentActions.unassignTable.variables;
      return {
        type: 'unassign' as const,
        bookingId: variables?.bookingId ?? null,
        tableId: variables?.tableId ?? null,
      };
    }
    return null;
  }, [
    tableAssignmentActions.assignTable.isPending,
    tableAssignmentActions.assignTable.variables,
    tableAssignmentActions.unassignTable.isPending,
    tableAssignmentActions.unassignTable.variables,
  ]);

  const handleMarkNoShow = useCallback(
    async (
      bookingId: string,
      options?: { performedAt?: string | null; reason?: string | null },
    ) => {
      if (!restaurantId) return;
      setPendingBookingAction({
        bookingId,
        action: 'no-show',
        snapshot: getPendingSnapshot(bookingId),
      });
      try {
        await bookingLifecycleMutations.markNoShow.mutateAsync({
          restaurantId,
          bookingId,
          performedAt: options?.performedAt ?? null,
          reason: options?.reason ?? null,
          targetDate: selectedDate,
        });
      } finally {
        setPendingBookingAction(null);
      }
    },
    [bookingLifecycleMutations.markNoShow, getPendingSnapshot, restaurantId, selectedDate],
  );

  const handleUndoNoShow = useCallback(
    async (bookingId: string, reason?: string | null) => {
      if (!restaurantId) return;
      setPendingBookingAction({
        bookingId,
        action: 'undo-no-show',
        snapshot: getPendingSnapshot(bookingId),
      });
      try {
        await bookingLifecycleMutations.undoNoShow.mutateAsync({
          restaurantId,
          bookingId,
          reason: reason ?? null,
          targetDate: selectedDate,
        });
      } finally {
        setPendingBookingAction(null);
      }
    },
    [bookingLifecycleMutations.undoNoShow, getPendingSnapshot, restaurantId, selectedDate],
  );

  const handleCheckIn = useCallback(
    async (bookingId: string) => {
      if (!restaurantId) return;
      setPendingBookingAction({
        bookingId,
        action: 'check-in',
        snapshot: getPendingSnapshot(bookingId),
      });
      try {
        await bookingLifecycleMutations.checkIn.mutateAsync({
          restaurantId,
          bookingId,
          targetDate: selectedDate,
        });
      } finally {
        setPendingBookingAction(null);
      }
    },
    [bookingLifecycleMutations.checkIn, getPendingSnapshot, restaurantId, selectedDate],
  );

  const handleCheckOut = useCallback(
    async (bookingId: string) => {
      if (!restaurantId) return;
      setPendingBookingAction({
        bookingId,
        action: 'check-out',
        snapshot: getPendingSnapshot(bookingId),
      });
      try {
        await bookingLifecycleMutations.checkOut.mutateAsync({
          restaurantId,
          bookingId,
          targetDate: selectedDate,
        });
      } finally {
        setPendingBookingAction(null);
      }
    },
    [bookingLifecycleMutations.checkOut, getPendingSnapshot, restaurantId, selectedDate],
  );

  const handleAssignTable = useCallback(
    async (bookingId: string, tableId: string, tableName?: string) => {
      const result = await tableAssignmentActions.assignTable.mutateAsync({
        bookingId,
        tableId,
        tableName,
      });
      return result.tableAssignments;
    },
    [tableAssignmentActions.assignTable],
  );

  const handleUnassignTable = useCallback(
    async (bookingId: string, tableId: string) => {
      const result = await tableAssignmentActions.unassignTable.mutateAsync({ bookingId, tableId });
      return result.tableAssignments;
    },
    [tableAssignmentActions.unassignTable],
  );

  return {
    pendingBookingAction,
    tableActionState,
    handleMarkNoShow,
    handleUndoNoShow,
    handleCheckIn,
    handleCheckOut,
    handleAssignTable,
    handleUnassignTable,
  };
}
