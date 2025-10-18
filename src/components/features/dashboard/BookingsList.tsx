'use client';

import {
  AlertTriangle,
  CalendarDays,
  ClipboardList,
  FileText,
  Settings,
  Users,
} from 'lucide-react';
import { useEffect, useMemo } from 'react';

import { BookingStatusBadge, StatusTransitionAnimator } from '@/components/features/booking-state-machine';
import { BookingStateMachineProvider, useBookingState, useBookingStateMachine } from '@/contexts/booking-state-machine';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { BookingActionButton } from '@/components/features/booking-state-machine';
import { cn } from '@/lib/utils';
import { formatTimeRange, getTodayInTimezone } from '@/lib/utils/datetime';
import { useBookingRealtime } from '@/hooks';

import { BookingDetailsDialog } from './BookingDetailsDialog';
import { inferMergeInfo } from '@/utils/ops/table-merges';

import type { BookingFilter } from './BookingsFilterBar';
import type { OpsTodayBooking, OpsTodayBookingsSummary } from '@/types/ops';

type BookingsListProps = {
  bookings: OpsTodayBooking[];
  filter: BookingFilter;
  summary: OpsTodayBookingsSummary;
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

type TableAssignmentDisplay = {
  text: string;
  state: 'unassigned' | 'single' | 'merge';
  mergeGroupId?: string | null;
};

const TIER_COLORS: Record<string, string> = {
  platinum: 'bg-purple-500 text-white border-purple-500',
  gold: 'bg-yellow-500 text-black border-yellow-500',
  silver: 'bg-gray-400 text-white border-gray-400',
  bronze: 'bg-amber-700 text-white border-amber-700',
};

function formatTableAssignmentDisplay(assignments: OpsTodayBooking['tableAssignments']): TableAssignmentDisplay {
  if (!assignments || assignments.length === 0) {
    return {
      text: 'Table assignment required',
      state: 'unassigned',
    };
  }

  const labels: string[] = [];
  let hasMerge = false;
  let mergeGroupId: string | null = null;

  for (const group of assignments) {
    const members = group.members ?? [];
    if (!mergeGroupId && group.groupId) {
      mergeGroupId = group.groupId;
    }

    const memberLabels = members.map((member) => member.tableNumber || '—');
    const baseLabel = memberLabels.length <= 1
      ? `Table ${memberLabels[0] ?? '—'}`
      : `Tables ${memberLabels.join(' + ')}`;

    const seatsLabel = group.capacitySum
      ? `${group.capacitySum} seat${group.capacitySum === 1 ? '' : 's'}`
      : null;

    let label = seatsLabel ? `${baseLabel} · ${seatsLabel}` : baseLabel;

    if (members.length > 1) {
      hasMerge = true;
      const inferred = inferMergeInfo(
        members.map((member) => ({
          tableNumber: member.tableNumber ?? '',
          capacity: member.capacity ?? null,
        })),
      );

      if (inferred) {
        const mergeParts = [`Merge ${inferred.displayName}`];
        if (inferred.patternLabel) {
          mergeParts.push(`(${inferred.patternLabel})`);
        }
        label = `${label} · ${mergeParts.join(' ')}`;
      }
    }

    labels.push(label);
  }

  return {
    text: labels.join('; '),
    state: hasMerge ? 'merge' : 'single',
    mergeGroupId,
  };
}

function renderList(values?: string[] | null): string {
  if (!values || values.length === 0) {
    return 'None';
  }
  return values.join(', ');
}

function filterBookings(bookings: OpsTodayBooking[], filter: BookingFilter) {
  if (filter === 'all') return bookings;
  if (filter === 'completed') {
    return bookings.filter((booking) => booking.status === 'checked_in' || booking.status === 'completed');
  }
  return bookings.filter((booking) => booking.status === filter);
}

export function BookingsList(props: BookingsListProps) {
  const initialSnapshots = useMemo(
    () =>
      props.bookings.map((booking) => ({
        id: booking.id,
        status: booking.status,
        updatedAt: null,
      })),
    [props.bookings],
  );

  return (
    <BookingStateMachineProvider initialBookings={initialSnapshots}>
      <BookingsListContent {...props} />
    </BookingStateMachineProvider>
  );
}

function BookingsListContent({
  bookings,
  filter,
  summary,
  onMarkNoShow,
  onUndoNoShow,
  onCheckIn,
  onCheckOut,
  pendingLifecycleAction,
  onAssignTable,
  onUnassignTable,
  tableActionState,
}: BookingsListProps) {
  const { registerBookings } = useBookingStateMachine();

  useEffect(() => {
    registerBookings(
      bookings.map((booking) => ({
        id: booking.id,
        status: booking.status,
        updatedAt: null,
      })),
    );
  }, [bookings, registerBookings]);

  const filtered = useMemo(() => filterBookings(bookings, filter), [bookings, filter]);
  const bookingIds = useMemo(() => bookings.map((booking) => booking.id), [bookings]);
  const visibleBookingIds = useMemo(() => filtered.map((booking) => booking.id), [filtered]);

  useBookingRealtime({
    restaurantId: summary.restaurantId,
    targetDate: summary.date,
    bookingIds,
    visibleBookingIds,
    enabled: bookings.length > 0,
  });

  const supportsTableAssignment = Boolean(onAssignTable && onUnassignTable);

  if (filtered.length === 0) {
    return (
      <Card className="border-dashed border-border/60 bg-background">
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <ClipboardList className="h-6 w-6 text-muted-foreground" aria-hidden />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">No bookings found</p>
            <p className="text-sm text-muted-foreground">
              {filter === 'all'
                ? 'There are no bookings scheduled for this date yet.'
                : `No bookings are marked as ${filter === 'completed' ? 'show' : 'no show'} on this date.`}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {filtered.map((booking) => (
        <BookingCard
          key={booking.id}
          booking={booking}
          summary={summary}
          pendingLifecycleAction={pendingLifecycleAction}
          onCheckIn={onCheckIn}
          onCheckOut={onCheckOut}
          onMarkNoShow={onMarkNoShow}
          onUndoNoShow={onUndoNoShow}
          supportsTableAssignment={supportsTableAssignment}
          onAssignTable={onAssignTable}
          onUnassignTable={onUnassignTable}
          tableActionState={tableActionState}
        />
      ))}
    </div>
  );
}

type BookingCardProps = {
  booking: OpsTodayBooking;
  summary: OpsTodayBookingsSummary;
  pendingLifecycleAction: BookingsListProps['pendingLifecycleAction'];
  onCheckIn: BookingsListProps['onCheckIn'];
  onCheckOut: BookingsListProps['onCheckOut'];
  onMarkNoShow: BookingsListProps['onMarkNoShow'];
  onUndoNoShow: BookingsListProps['onUndoNoShow'];
  supportsTableAssignment: boolean;
  onAssignTable: BookingsListProps['onAssignTable'];
  onUnassignTable: BookingsListProps['onUnassignTable'];
  tableActionState: BookingsListProps['tableActionState'];
};

function BookingCard({
  booking,
  summary,
  pendingLifecycleAction,
  onCheckIn,
  onCheckOut,
  onMarkNoShow,
  onUndoNoShow,
  supportsTableAssignment,
  onAssignTable,
  onUnassignTable,
  tableActionState,
}: BookingCardProps) {
  const bookingState = useBookingState(booking.id);
  const effectiveStatus = bookingState.effectiveStatus ?? booking.status;
  const showLifecycleBadges = effectiveStatus !== 'checked_in' && effectiveStatus !== 'completed';

  const serviceTime = formatTimeRange(booking.startTime, booking.endTime, summary.timezone);
  const tableAssignmentDisplay = formatTableAssignmentDisplay(booking.tableAssignments);
  const isTableActionPending =
    supportsTableAssignment && tableActionState?.bookingId === booking.id ? tableActionState?.type : null;
  const lifecyclePending = pendingLifecycleAction?.bookingId === booking.id ? pendingLifecycleAction.action : null;
  const lifecycleAvailability = useMemo(
    () => ({ isToday: getTodayInTimezone(summary.timezone) === summary.date }),
    [summary.date, summary.timezone],
  );

  return (
    <Card className="border-border/60">
      <CardContent className="flex flex-col gap-4 py-3 sm:py-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:gap-3">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <h3 className="text-base font-semibold text-foreground">{booking.customerName}</h3>
            {booking.loyaltyTier ? (
              <Badge variant="outline" className={cn('text-xs font-semibold', TIER_COLORS[booking.loyaltyTier])}>
                {booking.loyaltyTier}
              </Badge>
            ) : null}
            <StatusTransitionAnimator
              status={bookingState.status}
              effectiveStatus={bookingState.effectiveStatus}
              isTransitioning={bookingState.isTransitioning}
              className="inline-flex rounded-full"
              overlayClassName="inline-flex"
            >
              <BookingStatusBadge status={effectiveStatus} />
            </StatusTransitionAnimator>
            {showLifecycleBadges && booking.checkedInAt ? (
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700">
                Checked in
              </Badge>
            ) : null}
            {showLifecycleBadges && booking.checkedOutAt ? (
              <Badge variant="outline" className="bg-slate-100 text-slate-700">
                Checked out
              </Badge>
            ) : null}
            <Badge
              variant="outline"
              className={cn(
                'text-xs font-semibold',
                tableAssignmentDisplay.state === 'merge'
                  ? 'border-sky-200 bg-sky-50 text-sky-800'
                  : tableAssignmentDisplay.state === 'single'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border-amber-200 bg-amber-100 text-amber-800',
              )}
              aria-label={tableAssignmentDisplay.text}
            >
              {tableAssignmentDisplay.text}
            </Badge>
          </div>

          <div className="flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4 sm:gap-y-2">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4 shrink-0" aria-hidden /> {serviceTime}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Users className="h-4 w-4 shrink-0" aria-hidden />
              {booking.partySize} guests
            </span>
            {booking.allergies && booking.allergies.length > 0 ? (
              <span
                className="inline-flex items-center gap-1.5 text-xs text-orange-600"
                title={`Allergies: ${renderList(booking.allergies)}`}
              >
                <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
                Allergies
              </span>
            ) : null}
            {booking.seatingPreference || booking.dietaryRestrictions ? (
              <span className="inline-flex items-center gap-1.5 text-xs text-primary" title="Guest preferences available">
                <Settings className="h-4 w-4 shrink-0" aria-hidden />
                Preferences
              </span>
            ) : null}
            {booking.notes ? (
              <span className="inline-flex items-center gap-1.5 text-xs text-primary" title={booking.notes}>
                <FileText className="h-4 w-4 shrink-0" aria-hidden />
                Notes
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <BookingActionButton
            booking={booking}
            pendingAction={lifecyclePending ?? null}
            onCheckIn={() => onCheckIn(booking.id)}
            onCheckOut={() => onCheckOut(booking.id)}
            onMarkNoShow={(options) => onMarkNoShow(booking.id, options)}
            onUndoNoShow={(reason) => onUndoNoShow(booking.id, reason)}
            showConfirmation
            lifecycleAvailability={lifecycleAvailability}
          />

          <BookingDetailsDialog
            booking={booking}
            summary={summary}
            onCheckIn={() => onCheckIn(booking.id)}
            onCheckOut={() => onCheckOut(booking.id)}
            onMarkNoShow={(options) => onMarkNoShow(booking.id, options)}
            onUndoNoShow={(reason) => onUndoNoShow(booking.id, reason)}
            pendingLifecycleAction={
              lifecyclePending ? (lifecyclePending as 'check-in' | 'check-out' | 'no-show' | 'undo-no-show') : null
            }
            onAssignTable={
              supportsTableAssignment && onAssignTable ? (tableId) => onAssignTable(booking.id, tableId) : undefined
            }
            onUnassignTable={
              supportsTableAssignment && onUnassignTable ? (tableId) => onUnassignTable(booking.id, tableId) : undefined
            }
            tableActionState={
              supportsTableAssignment && tableActionState?.bookingId === booking.id ? tableActionState : null
            }
          />
        </div>
      </CardContent>
    </Card>
  );
}
