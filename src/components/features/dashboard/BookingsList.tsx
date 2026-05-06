'use client';

import { useEffect, useMemo } from 'react';

import {
  BookingStateMachineProvider,
  useBookingStateMachine,
  useOptionalBookingStateMachine,
} from '@/contexts/booking-state-machine';

import { BookingsListControls } from './list/BookingsListControls';
import { BookingsListEmptyState } from './list/BookingsListEmptyState';
import { BookingsListVirtualized } from './list/BookingsListVirtualized';
import { useBookingsListState } from './list/useBookingsListState';

import type { BookingFilter } from './BookingsFilterBar';
import type { BookingSortDir, BookingSortKey } from './list/utils';
import type { DashboardBookingActionHandlers } from './types';
import type { OpsTodayBooking, OpsTodayBookingsSummary } from '@/types/ops';

// --- HELPER TYPES & COMPONENTS ---

type BookingsListProps = {
  bookings: OpsTodayBooking[];
  controls: {
    filter: BookingFilter;
    searchQuery?: string;
    sortKey: BookingSortKey;
    sortDir: BookingSortDir;
    onSortKeyChange: (value: BookingSortKey) => void;
    onSortDirChange: (value: BookingSortDir) => void;
    isRefetching?: boolean;
    dataUpdatedAt?: number | null;
  };
  bookingActions: DashboardBookingActionHandlers;
  summary: OpsTodayBookingsSummary;
  initialNowIso: string;
  allowTableAssignments: boolean;
  restaurantSlug?: string | null;
};

export function BookingsList(props: BookingsListProps) {
  const existingStateMachine = useOptionalBookingStateMachine();
  const initialSnapshots = useMemoSnapshots(props.bookings);

  if (existingStateMachine) {
    return <BookingsListContent {...props} />;
  }

  return (
    <BookingStateMachineProvider initialBookings={initialSnapshots}>
      <BookingsListContent {...props} />
    </BookingStateMachineProvider>
  );
}

function BookingsListContent({
  bookings,
  controls,
  bookingActions,
  summary,
  initialNowIso,
  allowTableAssignments,
  restaurantSlug,
}: BookingsListProps) {
  const { registerBookings } = useBookingStateMachine();
  const hasAssignmentHandlers = Boolean(
    bookingActions.onAssignTable && bookingActions.onUnassignTable,
  );

  useEffect(() => {
    registerBookings(
      bookings.map((booking) => ({
        id: booking.id,
        status: booking.status,
        updatedAt: null,
      })),
    );
  }, [bookings, registerBookings]);

  const { nowDate, filtered, sorted } = useBookingsListState({
    bookings,
    filter: controls.filter,
    searchQuery: controls.searchQuery,
    summary,
    initialNowIso,
    allowTableAssignments,
    hasAssignmentHandlers,
    sortKey: controls.sortKey,
    sortDir: controls.sortDir,
    pendingLifecycleAction: bookingActions.pendingLifecycleAction,
  });

  if (filtered.length === 0) {
    return <BookingsListEmptyState />;
  }

  return (
    <div className="flex flex-col gap-4">
      <BookingsListControls
        sortKey={controls.sortKey}
        sortDir={controls.sortDir}
        onSortKeyChange={controls.onSortKeyChange}
        onSortDirChange={controls.onSortDirChange}
        isRefetching={controls.isRefetching}
        dataUpdatedAt={controls.dataUpdatedAt}
      />

      <BookingsListVirtualized
        sorted={sorted}
        summary={summary}
        nowDate={nowDate}
        restaurantSlug={restaurantSlug}
        bookingActions={bookingActions}
      />
    </div>
  );
}

function useMemoSnapshots(bookings: OpsTodayBooking[]) {
  return useMemo(
    () =>
      bookings.map((booking) => ({
        id: booking.id,
        status: booking.status,
        updatedAt: null,
      })),
    [bookings],
  );
}
