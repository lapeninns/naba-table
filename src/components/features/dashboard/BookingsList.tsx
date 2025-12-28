'use client';

import {
  Search,
} from 'lucide-react';
import { DateTime } from 'luxon';
import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';

import { OpsBookingCard } from '@/components/dashboard/OpsBookingCard';
import { OpsBookingCardSkeleton } from '@/components/dashboard/OpsBookingCardSkeleton';
import { Pagination } from '@/components/dashboard/Pagination';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BookingStateMachineProvider,
  useBookingStateMachine,
  useOptionalBookingStateMachine,
} from '@/contexts/booking-state-machine';
import { useBookingRealtime } from '@/hooks';
import { getOpsBookingActionRequirements, getOpsBookingTemporalInfo } from '@/utils/ops/todayBookingsAttention';

const BookingDetailsDialog = dynamic(() => import('./BookingDetailsDialog').then((m) => m.BookingDetailsDialog), {
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
});

void BookingDetailsDialog;

import type { BookingFilter } from './BookingsFilterBar';
import type { BookingDTO } from '@/hooks/useBookings';
import type { OpsTodayBooking, OpsTodayBookingsSummary } from '@/types/ops';

// --- HELPER TYPES & COMPONENTS ---

type BookingsListProps = {
  bookings: OpsTodayBooking[];
  filter: BookingFilter;
  searchQuery?: string;
  summary: OpsTodayBookingsSummary;
  allowTableAssignments: boolean;
  isRefetching?: boolean; // Show list skeletons while data is being refetched
  onDetails?: (booking: BookingDTO) => void;
  onMarkNoShow: (bookingId: string, options?: { performedAt?: string | null; reason?: string | null }) => Promise<void>;
  onUndoNoShow: (bookingId: string, reason?: string | null) => Promise<void>;
  onCheckIn: (bookingId: string) => Promise<void>;
  onCheckOut: (bookingId: string) => Promise<void>;
  pendingLifecycleAction?: {
    bookingId: string | null;
    action: 'check-in' | 'check-out' | 'no-show' | 'undo-no-show';
  } | null;
  onAssignTable?: (bookingId: string, tableId: string) => Promise<OpsTodayBooking['tableAssignments']>;
  onUnassignTable?: (bookingId: string, tableId: string) => Promise<OpsTodayBooking['tableAssignments']>;
  tableActionState?: {
    type: 'assign' | 'unassign';
    bookingId: string | null;
    tableId?: string | null;
  } | null;
};




// Helper function for sorting
function sortBookings(
  bookings: OpsTodayBooking[],
  sortKey: 'time' | 'party' | 'name',
  sortDir: 'asc' | 'desc'
) {
  return [...bookings].sort((a, b) => {
    let comparison = 0;

    if (sortKey === 'time') {
      const tA = a.startTime ? new Date(`1970-01-01T${a.startTime}`).getTime() : Number.MAX_SAFE_INTEGER;
      const tB = b.startTime ? new Date(`1970-01-01T${b.startTime}`).getTime() : Number.MAX_SAFE_INTEGER;
      comparison = tA - tB;
    } else if (sortKey === 'party') {
      comparison = a.partySize - b.partySize;
    } else if (sortKey === 'name') {
      comparison = a.customerName.localeCompare(b.customerName);
    }

    return sortDir === 'asc' ? comparison : -comparison;
  });
}

export function BookingsList(props: BookingsListProps) {
  const existingStateMachine = useOptionalBookingStateMachine();
  const initialSnapshots = useMemo(
    () =>
      props.bookings.map((booking) => ({
        id: booking.id,
        status: booking.status,
        updatedAt: null,
      })),
    [props.bookings],
  );

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
  allowTableAssignments,
  isRefetching = false,
  onDetails,
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
  const [now, setNow] = useState(() => DateTime.now().setZone(summary.timezone));

  // Pagination and Sorting State
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [sortKey, setSortKey] = useState<'time' | 'party' | 'name'>('time');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    registerBookings(
      bookings.map((booking) => ({
        id: booking.id,
        status: booking.status,
        updatedAt: null,
      })),
    );
  }, [bookings, registerBookings]);

  useEffect(() => {
    setNow(DateTime.now().setZone(summary.timezone));
    const interval = setInterval(() => {
      setNow(DateTime.now().setZone(summary.timezone));
    }, 60_000);
    return () => clearInterval(interval);
  }, [summary.timezone, summary.date]);

  // Reset page when filter changes
  useEffect(() => {
    setPage(1);
  }, [filter, sortKey, sortDir, searchQuery]);

  const hasAssignmentHandlers = Boolean(onAssignTable && onUnassignTable);

  const filtered = useMemo(() => {
    let result = bookings;

    // Search Filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((b) =>
        b.customerName.toLowerCase().includes(q) ||
        (b.reference && b.reference.toLowerCase().includes(q))
      );
    }

    if (filter === 'all') return result;

    // IMPORTANT: Use actual booking status (not optimistic) so cards stay in place
    // during loading. Cards only move after server confirms the change.
    if (filter === 'upcoming') {
      return result.filter((b) => b.status === 'confirmed' || b.status === 'PRIORITY_WAITLIST' || b.status === 'pending' || b.status === 'pending_allocation');
    }
    if (filter === 'seated') {
      return result.filter((b) => b.status === 'checked_in');
    }
    if (filter === 'finished' || filter === 'completed') {
      return result.filter((b) => ['completed', 'cancelled', 'no_show'].includes(b.status));
    }
    if (filter === 'no_show') {
      return result.filter((b) => b.status === 'no_show');
    }

    // Default 'attention' logic - uses actual status
    return result.filter((booking) => {
      const temporalInfo = getOpsBookingTemporalInfo(booking, summary, now);
      const requirements = getOpsBookingActionRequirements({
        booking,
        temporalInfo,
        now,
        statusForActions: booking.status,
        allowTableAssignments,
        hasAssignmentHandlers,
      });
      return requirements.needsAttention;
    });
  }, [bookings, filter, summary, now, allowTableAssignments, hasAssignmentHandlers, searchQuery]);

  const sorted = useMemo(() => sortBookings(filtered, sortKey, sortDir), [filtered, sortKey, sortDir]);

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, page, pageSize]);

  const bookingIds = useMemo(() => bookings.map((booking) => booking.id), [bookings]);
  const visibleBookingIds = useMemo(() => paginated.map((booking) => booking.id), [paginated]);

  useBookingRealtime({
    restaurantId: summary.restaurantId,
    targetDate: summary.date,
    bookingIds,
    visibleBookingIds,
    enabled: bookings.length > 0,
  });

  if (filtered.length === 0) {
    return (
      <Card className="border-dashed border-border/60 bg-muted/30">
        <div className="flex flex-col items-center gap-3 py-10 px-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-card shadow-sm ring-1 ring-border/50">
            <Search className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <p className="text-base font-semibold text-foreground">No bookings found</p>
            <p className="text-sm text-muted-foreground">
              Adjust filters to see more results.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Sort Controls */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
        <span className="text-sm font-medium text-muted-foreground">Sort</span>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
          <Select value={sortKey} onValueChange={(val) => setSortKey(val as 'time' | 'party' | 'name')}>
            <SelectTrigger className="h-9 w-full rounded-lg bg-card sm:w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="time">Time</SelectItem>
              <SelectItem value="party">Party Size</SelectItem>
              <SelectItem value="name">Guest Name</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortDir} onValueChange={(val) => setSortDir(val as 'asc' | 'desc')}>
            <SelectTrigger className="h-9 w-full rounded-lg bg-card sm:w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="asc">Ascending</SelectItem>
              <SelectItem value="desc">Descending</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Booking Cards or Skeletons */}
      <div className="grid grid-cols-1 gap-3">
        {isRefetching ? (
          // Show skeletons while refetching new data
          Array.from({ length: Math.min(paginated.length || 4, 6) }).map((_, index) => (
            <div
              key={`skeleton-${index}`}
              className="animate-pulse"
            >
              <OpsBookingCardSkeleton />
            </div>
          ))
        ) : (
          paginated.map((booking, index) => {
            const temporalInfo = getOpsBookingTemporalInfo(booking, summary, now);
            const allowAssignmentsForBooking = allowTableAssignments && hasAssignmentHandlers && temporalInfo.state !== 'past';

            const pendingAction = pendingLifecycleAction?.bookingId === booking.id ? pendingLifecycleAction.action : null;

            const toIsoTime = (date: string, time: string | null) => {
              if (!time) return '';
              const match = time.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
              if (!match) {
                return `${date}T${time}`;
              }
              const hours = match[1]?.padStart(2, '0') ?? '00';
              const minutes = match[2] ?? '00';
              const seconds = match[3] ?? '00';
              return `${date}T${hours}:${minutes}:${seconds}`;
            };

            const startIso = toIsoTime(summary.date, booking.startTime ?? null);
            const endIso = toIsoTime(summary.date, booking.endTime ?? null);

            const bookingDTO: BookingDTO = {
              id: booking.id,
              reference: booking.reference ?? null,
              status: booking.status,
              startIso,
              endIso: endIso || startIso,
              partySize: booking.partySize,
              customerName: booking.customerName,
              customerEmail: booking.customerEmail ?? null,
              customerPhone: booking.customerPhone ?? null,
              restaurantName: 'Restaurant',
              restaurantSlug: null,
              notes: booking.notes ?? null,
              allergies: booking.allergies ?? null,
              dietaryRestrictions: booking.dietaryRestrictions ?? null,
              seatingPreference: booking.seatingPreference ?? null,
              loyaltyTier: booking.loyaltyTier ?? null,
              tableAssignments: booking.tableAssignments,
              requiresTableAssignment: booking.requiresTableAssignment,
            };

            return (
              <div
                key={booking.id}
                className="animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-backwards"
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <OpsBookingCard
                  booking={bookingDTO}
                  timezone={summary.timezone}
                  now={now}
                  onCheckIn={onCheckIn}
                  onCheckOut={onCheckOut}
                  onMarkNoShow={onMarkNoShow}
                  onUndoNoShow={onUndoNoShow}
                  onDetails={onDetails}
                  onAssignTable={onAssignTable}
                  onUnassignTable={onUnassignTable}
                  pendingAction={pendingAction}
                  allowTableAssignments={allowAssignmentsForBooking}
                  highlightUrgency
                />
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {sorted.length > pageSize ? (
        <Pagination
          page={page}
          pageSize={pageSize}
          total={sorted.length}
          onPageChange={setPage}
        />
      ) : null}
    </div>
  );
}

// Legacy BookingCard removed; this file renders `OpsBookingCard` for the list.
