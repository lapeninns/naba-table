'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import { HttpError } from '@/lib/http/errors';
import { queryKeys } from '@/lib/query/keys';

import { useBookingLifecycle, type BookingLifecycleAction } from './useBookingLifecycle';

export type FloorPlanLifecycleAction = 'check-in' | 'complete' | 'no-show' | 'undo-no-show';

const TO_LIFECYCLE: Record<FloorPlanLifecycleAction, BookingLifecycleAction> = {
  'check-in': 'check-in',
  complete: 'check-out',
  'no-show': 'no-show',
  'undo-no-show': 'undo-no-show',
};

const FROM_LIFECYCLE: Record<BookingLifecycleAction, FloorPlanLifecycleAction> = {
  'check-in': 'check-in',
  'check-out': 'complete',
  'no-show': 'no-show',
  'undo-no-show': 'undo-no-show',
};

export function lifecycleErrorMessage(action: FloorPlanLifecycleAction, error: unknown): string {
  const verb =
    action === 'check-in'
      ? 'check in'
      : action === 'complete'
        ? 'complete'
        : action === 'no-show'
          ? 'mark as a no-show'
          : 'undo the no-show';
  if (error instanceof HttpError) {
    if (error.status === 409)
      return `Couldn’t ${verb}: the booking changed on another device. The plan has been refreshed.`;
    if (error.status === 401 || error.status === 403)
      return `You don’t have access to ${verb} bookings here.`;
    return `Couldn’t ${verb}. Try again.`;
  }
  return `Couldn’t ${verb}: the server didn’t respond. Check the connection and try again.`;
}

/**
 * Booking lifecycle actions for the floor plan, on the canonical `useBookingLifecycle` path
 * (optimistic per-booking update, offline queue, conflict refresh). The floor plan shows its own
 * copy (table names, undo), so the hook's toasts are off here. On success the table timeline,
 * which drives occupancy, is the one targeted revalidation.
 */
export function useOpsFloorPlanLifecycle({
  restaurantId,
  date,
}: {
  restaurantId: string | null;
  /** Same value passed to useOpsFloorPlan (null = today). */
  date: string | null;
}) {
  const queryClient = useQueryClient();
  const { run: runLifecycle, pendingActions } = useBookingLifecycle({ feedback: false });

  const busy = useMemo(() => {
    const byBooking: Record<string, FloorPlanLifecycleAction> = {};
    for (const [bookingId, pending] of Object.entries(pendingActions)) {
      byBooking[bookingId] = FROM_LIFECYCLE[pending.action];
    }
    return byBooking as Readonly<Record<string, FloorPlanLifecycleAction>>;
  }, [pendingActions]);

  /**
   * Resolves 'queued' when the device is offline (the action runs on reconnect, so callers must
   * not report it as done). Rejects with the server error when the action fails.
   */
  const run = useCallback(
    async (action: FloorPlanLifecycleAction, bookingId: string): Promise<'done' | 'queued'> => {
      if (!restaurantId) throw new Error('Restaurant id is required');
      const outcome = await runLifecycle({
        action: TO_LIFECYCLE[action],
        restaurantId,
        bookingId,
        targetDate: date,
      });
      if (outcome.status === 'failed') throw outcome.error;
      if (outcome.status === 'done') {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.opsTables.timelinePrefix(restaurantId),
        });
      }
      return outcome.status;
    },
    [date, queryClient, restaurantId, runLifecycle],
  );

  return { run, busy };
}
