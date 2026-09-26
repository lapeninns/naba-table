'use client';

import { useCallback } from 'react';

import type { DashboardPendingLifecycleActions } from './types';
import type { BookingLifecycle } from '@src/hooks/ops/useBookingLifecycle';
import type { OpsTableAssignmentActions } from '@src/hooks/ops/useOpsTableAssignments';

type UseOpsDashboardBookingActionsParams = {
  restaurantId: string | null;
  selectedDate: string | null;
  lifecycle: BookingLifecycle;
  tableAssignmentActions: OpsTableAssignmentActions;
};

/**
 * Thin dashboard bindings over the canonical booking hooks. Pending state is per booking (read
 * from the mutation cache), so actions on different bookings never block each other, and
 * feedback comes from the hooks, so the handlers resolve instead of throwing.
 */
export function useOpsDashboardBookingActions({
  restaurantId,
  selectedDate,
  lifecycle,
  tableAssignmentActions,
}: UseOpsDashboardBookingActionsParams) {
  const { run, pendingActions } = lifecycle;

  const pendingLifecycleActions: DashboardPendingLifecycleActions = pendingActions;

  const tableActionState = tableAssignmentActions.pendingAction;

  const handleMarkNoShow = useCallback(
    async (
      bookingId: string,
      options?: { performedAt?: string | null; reason?: string | null },
    ) => {
      if (!restaurantId) return;
      await run({
        action: 'no-show',
        restaurantId,
        bookingId,
        targetDate: selectedDate,
        performedAt: options?.performedAt ?? null,
        reason: options?.reason ?? null,
      });
    },
    [restaurantId, run, selectedDate],
  );

  const handleUndoNoShow = useCallback(
    async (bookingId: string, reason?: string | null) => {
      if (!restaurantId) return;
      await run({
        action: 'undo-no-show',
        restaurantId,
        bookingId,
        targetDate: selectedDate,
        reason: reason ?? null,
      });
    },
    [restaurantId, run, selectedDate],
  );

  const handleCheckIn = useCallback(
    async (bookingId: string) => {
      if (!restaurantId) return;
      await run({ action: 'check-in', restaurantId, bookingId, targetDate: selectedDate });
    },
    [restaurantId, run, selectedDate],
  );

  const handleCheckOut = useCallback(
    async (bookingId: string) => {
      if (!restaurantId) return;
      await run({ action: 'check-out', restaurantId, bookingId, targetDate: selectedDate });
    },
    [restaurantId, run, selectedDate],
  );

  const { assign, unassign } = tableAssignmentActions;

  const handleAssignTable = useCallback(
    (bookingId: string, tableId: string, tableName?: string) =>
      assign({ bookingId, tableId, tableName }),
    [assign],
  );

  const handleUnassignTable = useCallback(
    (bookingId: string, tableId: string) => unassign({ bookingId, tableId }),
    [unassign],
  );

  return {
    pendingLifecycleActions,
    tableActionState,
    handleMarkNoShow,
    handleUndoNoShow,
    handleCheckIn,
    handleCheckOut,
    handleAssignTable,
    handleUnassignTable,
  };
}
