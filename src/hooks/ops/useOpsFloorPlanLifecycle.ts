'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

import { useBookingOfflineQueue } from '@/contexts/booking-offline-queue';
import { useOpsBookingLifecycleActions } from '@/hooks/ops/useOpsBookingStatusActions';
import { HttpError } from '@/lib/http/errors';
import { queryKeys } from '@/lib/query/keys';

export type FloorPlanLifecycleAction = 'check-in' | 'complete' | 'no-show' | 'undo-no-show';

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
 * Booking lifecycle actions for the floor plan. Delegates to the shared
 * lifecycle hook (optimistic summary update, offline queue, conflict handling)
 * and additionally refreshes the table timeline, which drives occupancy.
 */
export function useOpsFloorPlanLifecycle({
  restaurantId,
  date,
}: {
  restaurantId: string | null;
  /** Same value passed to useOpsFloorPlan (null = today), so cache keys match. */
  date: string | null;
}) {
  const queryClient = useQueryClient();
  const { checkIn, checkOut, markNoShow, undoNoShow } = useOpsBookingLifecycleActions();
  const offlineQueue = useBookingOfflineQueue();
  const [busy, setBusy] = useState<Readonly<Record<string, FloorPlanLifecycleAction>>>({});

  /**
   * Resolves 'queued' when the device is offline: the shared hook then only
   * queues the action for later and changes nothing yet, so callers must not
   * report it as done.
   */
  const run = useCallback(
    async (action: FloorPlanLifecycleAction, bookingId: string): Promise<'done' | 'queued'> => {
      if (!restaurantId) throw new Error('Restaurant id is required');
      const variables = { restaurantId, bookingId, targetDate: date };
      const queued = Boolean(offlineQueue?.isOffline);
      setBusy((current) => ({ ...current, [bookingId]: action }));
      try {
        if (action === 'check-in') await checkIn.mutateAsync(variables);
        else if (action === 'complete') await checkOut.mutateAsync(variables);
        else if (action === 'no-show') await markNoShow.mutateAsync(variables);
        else await undoNoShow.mutateAsync(variables);
        return queued ? 'queued' : 'done';
      } finally {
        setBusy((current) => {
          const next = { ...current };
          delete next[bookingId];
          return next;
        });
        void queryClient.invalidateQueries({
          queryKey: queryKeys.opsTables.timelinePrefix(restaurantId),
        });
      }
    },
    [checkIn, checkOut, date, markNoShow, offlineQueue, queryClient, restaurantId, undoNoShow],
  );

  return { run, busy };
}
