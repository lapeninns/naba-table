import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useOpsDashboardBookingActions } from '@/components/features/dashboard/useOpsDashboardBookingActions';

import type { PendingBookingAction } from '@/components/features/dashboard/useOpsDashboardBookingActions';
import type { OpsTodayBookingsSummary } from '@/types/ops';

function deferredPromise<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function createSummary(): OpsTodayBookingsSummary {
  return {
    meta: {
      date: '2026-03-29',
      timezone: 'Europe/London',
      restaurantId: 'rest-1',
    },
    date: '2026-03-29',
    timezone: 'Europe/London',
    restaurantId: 'rest-1',
    totals: {
      total: 1,
      confirmed: 1,
      completed: 0,
      pending: 0,
      cancelled: 0,
      noShow: 0,
      upcoming: 1,
      covers: 2,
    },
    bookings: [
      {
        id: 'booking-1',
        status: 'confirmed',
        startTime: '18:00',
        endTime: '19:30',
        partySize: 2,
        customerName: 'Alex Example',
        customerEmail: null,
        customerPhone: null,
        notes: null,
        reference: null,
        details: null,
        source: null,
        tableAssignments: [],
        requiresTableAssignment: true,
        checkedInAt: null,
        checkedOutAt: null,
      },
    ],
  };
}

describe('useOpsDashboardBookingActions', () => {
  it('tracks pending lifecycle state around check-in without needing a summary refetch callback', async () => {
    const checkInDeferred = deferredPromise<void>();
    const checkIn = vi.fn(() => checkInDeferred.promise);
    const checkOut = vi.fn().mockResolvedValue(undefined);
    const markNoShow = vi.fn().mockResolvedValue(undefined);
    const undoNoShow = vi.fn().mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      useOpsDashboardBookingActions({
        summary: createSummary(),
        restaurantId: 'rest-1',
        selectedDate: '2026-03-29',
        bookingLifecycleMutations: {
          checkIn: { mutateAsync: checkIn },
          checkOut: { mutateAsync: checkOut },
          markNoShow: { mutateAsync: markNoShow },
          undoNoShow: { mutateAsync: undoNoShow },
        } as never,
        tableAssignmentActions: {
          assignTable: { isPending: false, variables: undefined },
          unassignTable: { isPending: false, variables: undefined },
        } as never,
      }),
    );

    let pendingPromise: Promise<void>;
    await act(async () => {
      pendingPromise = result.current.handleCheckIn('booking-1');
    });

    expect(result.current.pendingBookingAction).toEqual<PendingBookingAction>({
      bookingId: 'booking-1',
      action: 'check-in',
      snapshot: {
        status: 'confirmed',
        startTime: '18:00',
        endTime: '19:30',
      },
    });
    expect(checkIn).toHaveBeenCalledWith({
      restaurantId: 'rest-1',
      bookingId: 'booking-1',
      targetDate: '2026-03-29',
    });

    await act(async () => {
      checkInDeferred.resolve(undefined);
      await pendingPromise!;
    });

    expect(result.current.pendingBookingAction).toBeNull();
  });
});
