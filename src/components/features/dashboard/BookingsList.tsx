'use client';

import Link from 'next/link';
import {
  AlertTriangle,
  CalendarDays,
  ClipboardList,
  FileText,
  LogIn,
  LogOut,
  Settings,
  Users,
} from 'lucide-react';
import { DateTime } from 'luxon';
import { useEffect, useMemo, useState } from 'react';

import { BookingStatusBadge, StatusTransitionAnimator } from '@/components/features/booking-state-machine';
import { BookingActionButton } from '@/components/features/booking-state-machine';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { BookingStateMachineProvider, useBookingState, useBookingStateMachine } from '@/contexts/booking-state-machine';
import { useBookingRealtime } from '@/hooks';
import { cn } from '@/lib/utils';
import { formatTimeRange, getTodayInTimezone } from '@/lib/utils/datetime';

import { BookingDetailsDialog } from './BookingDetailsDialog';

import type { BookingFilter } from './BookingsFilterBar';
import type { OpsTodayBooking, OpsTodayBookingsSummary } from '@/types/ops';

const CHECK_IN_ELIGIBLE_STATUSES: OpsTodayBooking['status'][] = ['pending', 'pending_allocation', 'confirmed'];

type BookingsListProps = {
  bookings: OpsTodayBooking[];
  filter: BookingFilter;
  summary: OpsTodayBookingsSummary;
  allowTableAssignments: boolean;
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
  state: 'unassigned' | 'assigned' | 'locked' | 'imminent';
};

const TIER_COLORS: Record<string, string> = {
  platinum: 'bg-purple-500 text-white border-purple-500',
  gold: 'bg-yellow-500 text-black border-yellow-500',
  silver: 'bg-gray-400 text-white border-gray-400',
  bronze: 'bg-amber-700 text-white border-amber-700',
};

type BookingTemporalInfo = {
  state: 'past' | 'imminent' | 'upcoming' | 'unknown';
  diffMinutes: number | null;
  start: DateTime | null;
  end: DateTime | null;
};

function getBookingTemporalInfo(
  booking: OpsTodayBooking,
  summary: OpsTodayBookingsSummary,
  now: DateTime,
): BookingTemporalInfo {
  if (!booking.startTime) {
    const end = booking.endTime
      ? DateTime.fromISO(
        /^[0-9]{4}-[0-9]{2}-[0-9]{2}T/.test(booking.endTime ?? '') ? booking.endTime! : `${summary.date}T${booking.endTime}`,
        { zone: summary.timezone },
      )
      : null;
    return { state: 'unknown', diffMinutes: null, start: null, end: end?.isValid ? end : null };
  }

  const startValue = booking.startTime;
  const start = DateTime.fromISO(
    /^[0-9]{4}-[0-9]{2}-[0-9]{2}T/.test(startValue ?? '') ? startValue! : `${summary.date}T${startValue}`,
    { zone: summary.timezone },
  );

  const endValue = booking.endTime;
  const end = endValue
    ? DateTime.fromISO(
      /^[0-9]{4}-[0-9]{2}-[0-9]{2}T/.test(endValue ?? '') ? endValue! : `${summary.date}T${endValue}`,
      { zone: summary.timezone },
    )
    : null;

  if (!start.isValid) {
    return { state: 'unknown', diffMinutes: null, start: null, end: end?.isValid ? end : null };
  }

  const diffMinutes = start.diff(now, 'minutes').minutes ?? 0;

  if (diffMinutes < 0) {
    return { state: 'past', diffMinutes, start, end: end?.isValid ? end : null };
  }

  if (diffMinutes <= 15) {
    return { state: 'imminent', diffMinutes, start, end: end?.isValid ? end : null };
  }

  return { state: 'upcoming', diffMinutes, start, end: end?.isValid ? end : null };
}

function formatTableAssignmentDisplay(
  assignments: OpsTodayBooking['tableAssignments'],
  allowTableAssignments: boolean,
  temporalInfo: BookingTemporalInfo,
): TableAssignmentDisplay {
  if (assignments && assignments.length > 0) {
    const labels: string[] = [];

    for (const group of assignments) {
      const members = group.members ?? [];
      const memberLabels = members.map((member) => member.tableNumber || '—');
      const baseLabel =
        memberLabels.length <= 1 ? `Table ${memberLabels[0] ?? '—'}` : `Tables ${memberLabels.join(' + ')}`;

      const seatsLabel = group.capacitySum
        ? `${group.capacitySum} seat${group.capacitySum === 1 ? '' : 's'}`
        : null;

      labels.push(seatsLabel ? `${baseLabel} · ${seatsLabel}` : baseLabel);
    }

    return {
      text: labels.join('; '),
      state: 'assigned',
    };
  }

  if (temporalInfo.state === 'past') {
    return {
      text: 'Table assignment locked',
      state: 'locked',
    };
  }

  if (!allowTableAssignments) {
    return {
      text: 'Table assignment unavailable',
      state: 'locked',
    };
  }

  if (temporalInfo.state === 'imminent') {
    const minutesLabel = temporalInfo.diffMinutes !== null ? Math.max(0, Math.ceil(temporalInfo.diffMinutes)) : null;
    return {
      text: minutesLabel !== null ? `Starts in ${minutesLabel} min` : 'Starting soon',
      state: 'imminent',
    };
  }

  return {
    text: 'Table assignment required',
    state: 'unassigned',
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
  allowTableAssignments,
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
  const [now, setNow] = useState(() => DateTime.now().setZone(summary.timezone));

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

  const hasAssignmentHandlers = Boolean(onAssignTable && onUnassignTable);

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
      {filtered.map((booking) => {
        const temporalInfo = getBookingTemporalInfo(booking, summary, now);
        const allowAssignmentsForBooking = allowTableAssignments && hasAssignmentHandlers && temporalInfo.state !== 'past';
        return (
          <BookingCard
            key={booking.id}
            booking={booking}
            summary={summary}
            temporalInfo={temporalInfo}
            allowTableAssignments={allowAssignmentsForBooking}
            hasAssignmentHandlers={hasAssignmentHandlers}
            now={now}
            pendingLifecycleAction={pendingLifecycleAction}
            onCheckIn={onCheckIn}
            onCheckOut={onCheckOut}
            onMarkNoShow={onMarkNoShow}
            onUndoNoShow={onUndoNoShow}
            onAssignTable={onAssignTable}
            onUnassignTable={onUnassignTable}
            tableActionState={tableActionState}
          />
        );
      })}
    </div>
  );
}

type BookingCardProps = {
  booking: OpsTodayBooking;
  summary: OpsTodayBookingsSummary;
  temporalInfo: BookingTemporalInfo;
  allowTableAssignments: boolean;
  hasAssignmentHandlers: boolean;
  now: DateTime;
  pendingLifecycleAction: BookingsListProps['pendingLifecycleAction'];
  onCheckIn: BookingsListProps['onCheckIn'];
  onCheckOut: BookingsListProps['onCheckOut'];
  onMarkNoShow: BookingsListProps['onMarkNoShow'];
  onUndoNoShow: BookingsListProps['onUndoNoShow'];
  onAssignTable: BookingsListProps['onAssignTable'];
  onUnassignTable: BookingsListProps['onUnassignTable'];
  tableActionState: BookingsListProps['tableActionState'];
};

function BookingCard({
  booking,
  summary,
  temporalInfo,
  allowTableAssignments,
  hasAssignmentHandlers,
  now,
  pendingLifecycleAction,
  onCheckIn,
  onCheckOut,
  onMarkNoShow,
  onUndoNoShow,
  onAssignTable,
  onUnassignTable,
  tableActionState,
}: BookingCardProps) {
  const bookingState = useBookingState(booking.id);
  const effectiveStatus = bookingState.effectiveStatus ?? booking.status;
  const showLifecycleBadges = effectiveStatus !== 'checked_in' && effectiveStatus !== 'completed';

  const serviceTime = formatTimeRange(booking.startTime, booking.endTime, summary.timezone);
  const allowAssignmentsForBooking = allowTableAssignments && hasAssignmentHandlers;
  const tableAssignmentDisplay = formatTableAssignmentDisplay(booking.tableAssignments, allowAssignmentsForBooking, temporalInfo);
  const isTableActionPending =
    allowAssignmentsForBooking && tableActionState?.bookingId === booking.id ? tableActionState?.type : null;
  const lifecyclePending = pendingLifecycleAction?.bookingId === booking.id ? pendingLifecycleAction.action : null;
  const lifecycleAvailability = useMemo(
    () => ({ isToday: getTodayInTimezone(summary.timezone) === summary.date }),
    [summary.date, summary.timezone],
  );
  const minutesDelta = temporalInfo.diffMinutes;
  const minutesUntilStart = minutesDelta !== null ? Math.max(0, Math.ceil(minutesDelta)) : null;
  const minutesSinceStart = minutesDelta !== null ? Math.abs(Math.round(minutesDelta)) : null;
  const timeStatusBadge = temporalInfo.state === 'past'
    ? (
      <Badge variant="outline" className="border-slate-300 bg-slate-200 text-slate-700">
        {minutesSinceStart ? `Started ${minutesSinceStart} min ago` : 'Service started'}
      </Badge>
    )
    : temporalInfo.state === 'imminent'
      ? (
        <Badge variant="outline" className="border-amber-300 bg-amber-100 text-amber-800">
          {minutesUntilStart !== null ? `Starts in ${minutesUntilStart} min` : 'Starting soon'}
        </Badge>
      )
      : null;

  const statusForActions = (bookingState.effectiveStatus ?? booking.status) as OpsTodayBooking['status'];
  const requiresCheckIn =
    temporalInfo.start !== null && temporalInfo.start <= now && CHECK_IN_ELIGIBLE_STATUSES.includes(statusForActions);
  const requiresCheckOut = temporalInfo.end !== null && temporalInfo.end <= now && statusForActions === 'checked_in';
  const actionBadge = requiresCheckIn
    ? (
      <Badge variant="outline" className="border-amber-500 bg-amber-100 text-amber-900">
        <LogIn className="mr-1 h-3.5 w-3.5" aria-hidden /> Check-in required
      </Badge>
    )
    : requiresCheckOut
      ? (
        <Badge variant="outline" className="border-rose-300 bg-rose-50 text-rose-700">
          <LogOut className="mr-1 h-3.5 w-3.5" aria-hidden /> Check-out required
        </Badge>
      )
      : null;

  const customerSearch = booking.customerEmail ?? booking.customerPhone ?? booking.customerName ?? '';
  const customerHref = customerSearch ? `/customers?focus=${encodeURIComponent(customerSearch)}` : '/customers';

  return (
    <Card
      data-booking-id={booking.id}
      tabIndex={-1}
      className={cn(
        'border-border/60 transition-colors',
        temporalInfo.state === 'past' && 'border-slate-200 bg-slate-50',
        temporalInfo.state === 'imminent' && 'border-amber-200 bg-amber-50/80',
      )}
    >
      <CardContent
        className={cn(
          'flex flex-col gap-4 py-3 sm:py-4 md:flex-row md:items-center md:justify-between',
          temporalInfo.state === 'past' ? 'text-muted-foreground' : '',
        )}
      >
        <div className="flex flex-1 flex-col gap-2 sm:gap-3">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <h3 className={cn('text-base font-semibold', temporalInfo.state === 'past' ? 'text-muted-foreground' : 'text-foreground')}>
              {booking.customerName}
            </h3>
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
            {timeStatusBadge}
            {actionBadge}
            <Badge
              variant="outline"
              className={cn(
                'text-xs font-semibold',
                tableAssignmentDisplay.state === 'assigned'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : tableAssignmentDisplay.state === 'locked'
                    ? 'border-slate-200 bg-slate-100 text-slate-700'
                    : tableAssignmentDisplay.state === 'imminent'
                      ? 'border-amber-300 bg-amber-100 text-amber-800'
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
          <Button asChild variant="ghost" size="sm" className="touch-manipulation">
            <Link href={customerHref}>View customer</Link>
          </Button>
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
            allowTableAssignments={allowAssignmentsForBooking}
            onCheckIn={() => onCheckIn(booking.id)}
            onCheckOut={() => onCheckOut(booking.id)}
            onMarkNoShow={(options) => onMarkNoShow(booking.id, options)}
            onUndoNoShow={(reason) => onUndoNoShow(booking.id, reason)}
            pendingLifecycleAction={
              lifecyclePending ? (lifecyclePending as 'check-in' | 'check-out' | 'no-show' | 'undo-no-show') : null
            }
            onAssignTable={
              allowAssignmentsForBooking && onAssignTable ? (tableId) => onAssignTable(booking.id, tableId) : undefined
            }
            onUnassignTable={
              allowAssignmentsForBooking && onUnassignTable ? (tableId) => onUnassignTable(booking.id, tableId) : undefined
            }
            tableActionState={
              allowAssignmentsForBooking && tableActionState?.bookingId === booking.id ? tableActionState : null
            }
          />
        </div>
      </CardContent>
    </Card>
  );
}
