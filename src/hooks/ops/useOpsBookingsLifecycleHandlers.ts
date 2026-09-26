'use client';

import { useCallback, useMemo } from 'react';

import { useBookingLifecycle } from './useBookingLifecycle';

import type { BookingAction } from '@/components/features/booking-state-machine';

export type UseOpsBookingsLifecycleHandlersParams = {
  restaurantId: string | null;
  targetDate: string | null;
  /** Kept for API stability: offline queueing is decided by the offline-queue context. */
  isOnline?: boolean;
  getBookingLabel: (bookingId: string) => string;
};

/**
 * Bookings-list bindings over the canonical `useBookingLifecycle` hook. Pending state is per
 * booking from the mutation cache; toasts, analytics, offline queueing and conflict refresh all
 * live in the canonical hook, so these handlers resolve and never throw.
 */
export function useOpsBookingsLifecycleHandlers({
  restaurantId,
  targetDate,
  getBookingLabel,
}: UseOpsBookingsLifecycleHandlersParams) {
  const { run, pendingActions } = useBookingLifecycle({ getBookingLabel });

  const pendingActionsByBookingId = useMemo(() => {
    const byBooking: Record<string, BookingAction | null> = {};
    for (const [bookingId, pending] of Object.entries(pendingActions)) {
      byBooking[bookingId] = pending.action;
    }
    return byBooking;
  }, [pendingActions]);

  const onCheckIn = useCallback(
    async (bookingId: string) => {
      if (!restaurantId) return;
      await run({ action: 'check-in', restaurantId, bookingId, targetDate });
    },
    [restaurantId, run, targetDate],
  );

  const onCheckOut = useCallback(
    async (bookingId: string) => {
      if (!restaurantId) return;
      await run({ action: 'check-out', restaurantId, bookingId, targetDate });
    },
    [restaurantId, run, targetDate],
  );

  const onMarkNoShow = useCallback(
    async (
      bookingId: string,
      options?: { performedAt?: string | null; reason?: string | null },
    ) => {
      if (!restaurantId) return;
      await run({
        action: 'no-show',
        restaurantId,
        bookingId,
        targetDate,
        performedAt: options?.performedAt ?? null,
        reason: options?.reason ?? null,
      });
    },
    [restaurantId, run, targetDate],
  );

  const onUndoNoShow = useCallback(
    async (bookingId: string, reason?: string | null) => {
      if (!restaurantId) return;
      await run({
        action: 'undo-no-show',
        restaurantId,
        bookingId,
        targetDate,
        reason: reason ?? null,
      });
    },
    [restaurantId, run, targetDate],
  );

  return {
    pendingActionsByBookingId,
    onCheckIn,
    onCheckOut,
    onMarkNoShow,
    onUndoNoShow,
  } as const;
}
