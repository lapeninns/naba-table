'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo } from 'react';

import { Button } from '@/components/ui/button';
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
import type { BookingDTO } from '@/hooks/useBookings';
import type { OpsTodayBooking, OpsTodayBookingsSummary } from '@/types/ops';

const BookingDetailsDialog = dynamic(
  () => import('./BookingDetailsDialog').then((m) => m.BookingDetailsDialog),
  {
    loading: () => (
      <Button
        id="booking-details-loading"
        variant="outline"
        size="sm"
        className="h-11 min-w-[120px]"
        disabled
        aria-busy
      >
        Loading…
      </Button>
    ),
  },
);

void BookingDetailsDialog;

// --- HELPER TYPES & COMPONENTS ---

type BookingsListProps = {
  bookings: OpsTodayBooking[];
  filter: BookingFilter;
  searchQuery?: string;
  summary: OpsTodayBookingsSummary;
  initialNowIso: string;
  allowTableAssignments: boolean;
  restaurantSlug?: string | null;
  sortKey: BookingSortKey;
  sortDir: BookingSortDir;
  onSortKeyChange: (value: BookingSortKey) => void;
  onSortDirChange: (value: BookingSortDir) => void;
  isRefetching?: boolean; // Show list skeletons while data is being refetched
  onDetails?: (booking: BookingDTO) => void;
  onEdit?: (booking: BookingDTO) => void;
  onCancel?: (booking: BookingDTO) => void;
  onMarkNoShow: (
    bookingId: string,
    options?: { performedAt?: string | null; reason?: string | null },
  ) => Promise<void>;
  onUndoNoShow: (bookingId: string, reason?: string | null) => Promise<void>;
  onCheckIn: (bookingId: string) => Promise<void>;
  onCheckOut: (bookingId: string) => Promise<void>;
  pendingLifecycleAction?: {
    bookingId: string | null;
    action: 'check-in' | 'check-out' | 'no-show' | 'undo-no-show';
    snapshot?: Pick<OpsTodayBooking, 'status' | 'startTime' | 'endTime'> | null;
  } | null;
  onAssignTable?: (
    bookingId: string,
    tableId: string,
  ) => Promise<OpsTodayBooking['tableAssignments']>;
  onUnassignTable?: (
    bookingId: string,
    tableId: string,
  ) => Promise<OpsTodayBooking['tableAssignments']>;
  tableActionState?: {
    type: 'assign' | 'unassign';
    bookingId: string | null;
    tableId?: string | null;
  } | null;
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
  filter,
  searchQuery,
  summary,
  initialNowIso,
  allowTableAssignments,
  restaurantSlug,
  sortKey,
  sortDir,
  onSortKeyChange,
  onSortDirChange,
  isRefetching = false,
  onDetails,
  onEdit,
  onCancel,
  onMarkNoShow,
  onUndoNoShow,
  onCheckIn,
  onCheckOut,
  pendingLifecycleAction,
  onAssignTable,
  onUnassignTable,
  tableActionState: _tableActionState,
}: BookingsListProps) {
  const { registerBookings } = useBookingStateMachine();
  const hasAssignmentHandlers = Boolean(onAssignTable && onUnassignTable);

  useEffect(() => {
    registerBookings(
      bookings.map((booking) => ({
        id: booking.id,
        status: booking.status,
        updatedAt: null,
      })),
    );
  }, [bookings, registerBookings]);

  const { now, nowDate, filtered, sorted } = useBookingsListState({
    bookings,
    filter,
    searchQuery,
    summary,
    initialNowIso,
    allowTableAssignments,
    hasAssignmentHandlers,
    sortKey,
    sortDir,
    pendingLifecycleAction,
  });

  if (filtered.length === 0) {
    return <BookingsListEmptyState />;
  }

  return (
    <div className="flex flex-col gap-4">
      <BookingsListControls
        sortKey={sortKey}
        sortDir={sortDir}
        onSortKeyChange={onSortKeyChange}
        onSortDirChange={onSortDirChange}
        isRefetching={isRefetching}
      />

      <BookingsListVirtualized
        bookings={bookings}
        sorted={sorted}
        summary={summary}
        now={now}
        nowDate={nowDate}
        allowTableAssignments={allowTableAssignments}
        restaurantSlug={restaurantSlug}
        isRefetching={isRefetching}
        onDetails={onDetails}
        onEdit={onEdit}
        onCancel={onCancel}
        onMarkNoShow={onMarkNoShow}
        onUndoNoShow={onUndoNoShow}
        onCheckIn={onCheckIn}
        onCheckOut={onCheckOut}
        pendingLifecycleAction={pendingLifecycleAction}
        onAssignTable={onAssignTable}
        onUnassignTable={onUnassignTable}
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
