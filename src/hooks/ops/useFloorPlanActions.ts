'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { useBookingService } from '@/contexts/ops-services';
import { useOpsBookingLifecycleActions } from '@/hooks/ops/useOpsBookingStatusActions';

export type UseFloorPlanActionsOptions = {
  restaurantId: string | null;
  date: string | null;
};

/**
 * Floor-plan seat/clear actions. Reuses the hardened booking lifecycle mutations
 * (checkIn → seated, checkOut → completed) and additionally invalidates the table
 * timeline query — which the lifecycle hook does not touch — so node colours refresh.
 */
export function useFloorPlanActions({ restaurantId, date }: UseFloorPlanActionsOptions) {
  const queryClient = useQueryClient();
  const bookingService = useBookingService();
  const { checkIn, checkOut, markNoShow } = useOpsBookingLifecycleActions();

  const invalidateTimeline = useCallback(() => {
    if (!restaurantId) return;
    // Prefix match invalidates every timeline variant for this restaurant.
    void queryClient.invalidateQueries({ queryKey: ['ops', 'tables', restaurantId, 'timeline'] });
  }, [queryClient, restaurantId]);

  const seatParty = useCallback(
    (bookingId: string) => {
      if (!restaurantId) return;
      checkIn.mutate({ restaurantId, bookingId, targetDate: date }, { onSuccess: invalidateTimeline });
    },
    [checkIn, restaurantId, date, invalidateTimeline],
  );

  const clearTable = useCallback(
    (bookingId: string) => {
      if (!restaurantId) return;
      checkOut.mutate(
        { restaurantId, bookingId, targetDate: date },
        { onSuccess: invalidateTimeline },
      );
    },
    [checkOut, restaurantId, date, invalidateTimeline],
  );

  const markNoShowParty = useCallback(
    (bookingId: string) => {
      if (!restaurantId) return;
      markNoShow.mutate(
        { restaurantId, bookingId, targetDate: date },
        { onSuccess: invalidateTimeline },
      );
    },
    [markNoShow, restaurantId, date, invalidateTimeline],
  );

  // Split a table out of its joined party (removes it from the booking's merge group).
  const splitTable = useCallback(
    (bookingId: string, tableId: string) => {
      bookingService
        .unassignTablesDirect({ bookingId, tableIds: [tableId] })
        .then(invalidateTimeline)
        .catch((error: unknown) => {
          console.error('[floor-plan] split failed', error);
        });
    },
    [bookingService, invalidateTimeline],
  );

  return {
    seatParty,
    clearTable,
    markNoShowParty,
    splitTable,
    isSeating: checkIn.isPending,
    isClearing: checkOut.isPending,
  };
}
