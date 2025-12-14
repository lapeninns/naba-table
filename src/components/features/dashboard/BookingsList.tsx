'use client';

import {
  AlertTriangle,
  Armchair,
  Check,
  Clock,
  FileText,
  LogIn,
  LogOut,
  Search,
  Sparkles,
  Users,
  Utensils,
  X,
} from 'lucide-react';
import { DateTime } from 'luxon';
import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';

import { OpsBookingCardSkeleton } from '@/components/dashboard/OpsBookingCardSkeleton';
import { Pagination } from '@/components/dashboard/Pagination';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
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
import { cn } from '@/lib/utils';
import { getOpsBookingActionRequirements, getOpsBookingTemporalInfo } from '@/utils/ops/todayBookingsAttention';

const BookingDetailsDialog = dynamic(() => import('./BookingDetailsDialog').then((m) => m.BookingDetailsDialog), {
  loading: () => (
    <Button variant="outline" size="sm" className="h-11 min-w-[120px]" disabled aria-busy>
      Loading…
    </Button>
  ),
});

import type { BookingFilter } from './BookingsFilterBar';
import type { OpsTodayBooking, OpsTodayBookingsSummary } from '@/types/ops';
import type { OpsBookingTemporalInfo } from '@/utils/ops/todayBookingsAttention';

// --- HELPER TYPES & COMPONENTS ---

type BookingsListProps = {
  bookings: OpsTodayBooking[];
  filter: BookingFilter;
  searchQuery?: string;
  summary: OpsTodayBookingsSummary;
  allowTableAssignments: boolean;
  isRefetching?: boolean; // Show list skeletons while data is being refetched
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

const StatusIndicator = ({ status }: { status: string }) => {
  const styles: Record<string, string> = {
    pending: 'bg-amber-500',
    pending_allocation: 'bg-amber-500',
    confirmed: 'bg-blue-500',
    PRIORITY_WAITLIST: 'bg-blue-500',
    checked_in: 'bg-emerald-500',
    completed: 'bg-muted-foreground/60',
    no_show: 'bg-rose-500',
    cancelled: 'bg-muted-foreground/40',
  };

  const labels: Record<string, string> = {
    confirmed: 'Expected',
    PRIORITY_WAITLIST: 'Expected',
    pending: 'Pending',
    pending_allocation: 'Pending',
    checked_in: 'Seated',
    completed: 'Left',
    no_show: 'No Show',
    cancelled: 'Cancelled',
  };

  const colorClass = styles[status] || styles['confirmed'];
  const label = labels[status] || status.replace('_', ' ');

  return (
    <div className="flex items-center gap-2">
      <span className={cn("h-2 w-2 rounded-full", colorClass)} />
      <span className={cn("text-xs font-medium", status === 'completed' || status === 'cancelled' ? 'text-muted-foreground' : 'text-foreground')}>
        {label}
      </span>
    </div>
  );
};

const TableAssignment = ({ assignments, status, allowTableAssignments, temporalInfo }: {
  assignments: OpsTodayBooking['tableAssignments'],
  status: string,
  allowTableAssignments: boolean,
  temporalInfo: OpsBookingTemporalInfo
}) => {
  if (!assignments || assignments.length === 0) {
    if (status === 'confirmed' || status === 'PRIORITY_WAITLIST') {
      if (!allowTableAssignments || temporalInfo.state === 'past') {
        return <span className="text-xs text-muted-foreground italic">No table</span>;
      }
      return (
        <div className="flex items-center gap-1.5 text-amber-600">
          <AlertTriangle className="h-3.5 w-3.5" />
          <span className="text-xs font-medium">No Table</span>
        </div>
      );
    }
    return <span className="text-xs text-muted-foreground italic">No table</span>;
  }

  // Generate table label
  const labels: string[] = [];
  for (const group of assignments) {
    const members = group.members ?? [];
    const memberLabels = members.map((member) => member.tableNumber || '—');
    labels.push(memberLabels.join(' + '));
  }
  const displayTables = labels.join(', ');

  return (
    <div className="flex items-center gap-1.5 text-foreground">
      <Armchair className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="text-xs font-semibold">Table {displayTables}</span>
    </div>
  );
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
      <div className="flex flex-col gap-3">
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
            return (
              <div
                key={booking.id}
                className="animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-backwards"
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <BookingCard
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

type BookingCardProps = {
  booking: OpsTodayBooking;
  summary: OpsTodayBookingsSummary;
  temporalInfo: OpsBookingTemporalInfo;
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
  const allowAssignmentsForBooking = allowTableAssignments && hasAssignmentHandlers;
  const lifecyclePending = pendingLifecycleAction?.bookingId === booking.id ? pendingLifecycleAction.action : null;
  const isLoading = Boolean(lifecyclePending);

  // Use actual status for done/seated checks so card stays in place during loading
  const isDone = booking.status === 'completed' || booking.status === 'cancelled' || booking.status === 'no_show';
  const isSeated = booking.status === 'checked_in';
  const isUpcoming = booking.status === 'confirmed' || booking.status === 'PRIORITY_WAITLIST';

  // Format Times with fallback
  const parseTime = (t: string | null) => {
    if (!t) return null;
    // Try HH:mm:ss first, then HH:mm
    let dt = DateTime.fromFormat(t, 'HH:mm:ss');
    if (!dt.isValid) dt = DateTime.fromFormat(t, 'HH:mm');
    return dt.isValid ? dt : null;
  };

  const startTimeObj = parseTime(booking.startTime);
  const endTimeObj = parseTime(booking.endTime);

  const startTimeStr = startTimeObj ? startTimeObj.toFormat('h:mm a') : '--:--';
  const endTimeStr = endTimeObj ? endTimeObj.toFormat('h:mm a') : null;

  // Time urgency calculation
  const timeUrgency = useMemo(() => {
    if (!isUpcoming || !startTimeObj) return null;

    const bookingDateTime = now.set({
      hour: startTimeObj.hour,
      minute: startTimeObj.minute,
      second: 0,
    });

    const diffMinutes = bookingDateTime.diff(now, 'minutes').minutes;

    if (diffMinutes <= -15) {
      return { type: 'late' as const, minutes: Math.abs(Math.round(diffMinutes)), label: `${Math.abs(Math.round(diffMinutes))} min late` };
    } else if (diffMinutes <= 0 && diffMinutes > -15) {
      return { type: 'overdue' as const, minutes: Math.abs(Math.round(diffMinutes)), label: 'Past time' };
    } else if (diffMinutes <= 10) {
      return { type: 'soon' as const, minutes: Math.round(diffMinutes), label: `${Math.round(diffMinutes)} min` };
    } else if (diffMinutes <= 30) {
      return { type: 'approaching' as const, minutes: Math.round(diffMinutes), label: `${Math.round(diffMinutes)} min` };
    }
    return null;
  }, [isUpcoming, startTimeObj, now]);

  // Guest Initials
  const guestInitials = booking.customerName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  const handleAction = async (action: 'check-in' | 'check-out') => {
    if (action === 'check-in') await onCheckIn(booking.id);
    if (action === 'check-out') await onCheckOut(booking.id);
  };

  // Determine card urgency variant
  const cardUrgencyClass = useMemo(() => {
    if (isDone) return "border-muted bg-muted/50";
    if (timeUrgency?.type === 'late') return "border-destructive/50 bg-destructive/5";
    if (timeUrgency?.type === 'overdue') return "border-warning/50 bg-warning/5";
    if (timeUrgency?.type === 'soon') return "border-warning/30 bg-warning/5";
    return "";
  }, [isDone, timeUrgency]);

  return (
    <Card className={cn(
      "group relative flex flex-col gap-3 p-3 transition-all sm:gap-4 sm:p-4 sm:flex-row sm:items-center",
      cardUrgencyClass,
      isLoading && "opacity-60 pointer-events-none animate-pulse",
      !isLoading && "hover:shadow-md active:shadow-sm"
    )}>
      {/* Loading overlay indicator */}
      {isLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-muted/50">
          <Badge variant="secondary" className="gap-2 px-4 py-2 shadow-lg bg-background">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground" />
            <span className="text-sm font-medium">
              {lifecyclePending === 'check-in' && 'Seating guest...'}
              {lifecyclePending === 'check-out' && 'Finishing visit...'}
              {lifecyclePending === 'no-show' && 'Marking no-show...'}
              {lifecyclePending === 'undo-no-show' && 'Restoring booking...'}
            </span>
          </Badge>
        </div>
      )}

      {/* ZONE 1: LOGISTICS (Time & Party) */}
      <div className="flex min-w-[100px] shrink-0 flex-row items-center gap-4 sm:flex-col sm:items-start sm:gap-1">
        <div className="flex flex-col">
          <span className={cn("font-mono text-lg font-bold leading-none tracking-tight", isDone ? "text-muted-foreground" : "text-foreground")}>
            {startTimeStr}
          </span>
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
            {endTimeStr ? `Until ${endTimeStr}` : 'Open End'}
          </span>
        </div>

        <div className="hidden h-px w-8 bg-border sm:block" />

        <div className="flex items-center gap-1.5">
          <Users className={cn("h-3.5 w-3.5", isDone ? "text-muted-foreground/50" : "text-muted-foreground")} />
          <span className={cn("text-sm font-medium", isDone ? "text-muted-foreground" : "text-foreground")}>
            {booking.partySize} guests
          </span>
        </div>

        {/* Time Urgency Badge */}
        {timeUrgency && (
          <Badge
            variant={timeUrgency.type === 'late' ? 'destructive' : 'secondary'}
            className={cn(
              "gap-1 rounded-full text-[10px] animate-pulse",
              timeUrgency.type === 'overdue' && "bg-amber-100 text-amber-700 border-amber-200",
              timeUrgency.type === 'soon' && "bg-amber-50 text-amber-600 border-amber-100",
              timeUrgency.type === 'approaching' && "bg-blue-50 text-blue-600 border-blue-100"
            )}
          >
            <Clock className="h-3 w-3" />
            {timeUrgency.label}
          </Badge>
        )}
      </div>

      {/* ZONE 2: IDENTITY (Guest Info, Status, Tags) */}
      <div className="flex flex-1 flex-col gap-2">
        {/* Name & Tier */}
        <div className="flex items-center gap-3">
          <Avatar className={cn('h-8 w-8 sm:h-10 sm:w-10 shrink-0', isDone ? 'bg-muted' : 'bg-primary/10 text-primary')}>
            <AvatarFallback className="text-xs font-medium">
              {guestInitials}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-2">
              <span className={cn("text-base font-semibold", isDone ? "text-muted-foreground line-through decoration-muted-foreground/30" : "text-foreground")}>
                {booking.customerName}
              </span>
              {booking.loyaltyTier && (
                <Sparkles
                  className={cn(
                    "h-3.5 w-3.5",
                    booking.loyaltyTier === 'platinum' ? "text-indigo-500" :
                      booking.loyaltyTier === 'gold' ? "text-amber-500" : "text-muted-foreground"
                  )}
                  fill="currentColor"
                />
              )}
            </div>
          </div>
        </div>

        {/* Status & Table Line */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <StatusIndicator status={booking.status} />
          <div className="h-3 w-px bg-border" />
          <TableAssignment
            assignments={booking.tableAssignments}
            status={booking.status}
            allowTableAssignments={allowAssignmentsForBooking}
            temporalInfo={temporalInfo}
          />
        </div>

        {/* Tags (Allergies, Notes, Prefs) */}
        {(booking.allergies?.length || booking.notes || booking.seatingPreference || booking.dietaryRestrictions) ? (
          <div className="mt-1 flex flex-wrap gap-2">
            {booking.allergies?.map((allergy, i) => (
              <Badge key={`alg-${i}`} variant="destructive" className="gap-1">
                <AlertTriangle className="h-3 w-3" />
                {allergy}
              </Badge>
            ))}
            {booking.notes && (
              <Badge variant="default" className="gap-1 max-w-[200px] truncate" title={booking.notes}>
                <FileText className="h-3 w-3 shrink-0" />
                <span className="truncate">{booking.notes}</span>
              </Badge>
            )}
            {booking.seatingPreference && (
              <Badge variant="secondary" className="gap-1 max-w-[150px] truncate" title={booking.seatingPreference}>
                <Armchair className="h-3 w-3 shrink-0" />
                <span className="truncate">{booking.seatingPreference}</span>
              </Badge>
            )}
            {booking.dietaryRestrictions && booking.dietaryRestrictions.length > 0 && (
              <Badge variant="outline" className="gap-1 max-w-[150px] truncate bg-amber-50 text-amber-700 border-amber-200" title={booking.dietaryRestrictions.join(', ')}>
                <Utensils className="h-3 w-3 shrink-0" />
                <span className="truncate">{booking.dietaryRestrictions.join(', ')}</span>
              </Badge>
            )}
          </div>
        ) : null}
      </div>

      {/* ZONE 3: ACTIONS */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-t border-border pt-3 sm:mt-0 sm:flex-col sm:items-end sm:border-0 sm:pt-0 sm:gap-3">

        {!isDone ? (
          <>
            {(!isSeated) ? (
              <Button
                size="sm"
                className="flex-1 h-11 bg-primary shadow-primary/20 hover:bg-primary/90 active:bg-primary/80 sm:flex-none sm:h-auto sm:w-auto group/btn touch-manipulation"
                onClick={() => handleAction('check-in')}
                disabled={lifecyclePending === 'check-in'}
                title="Seat guest (keyboard: S)"
              >
                <LogIn className="mr-2 h-4 w-4 sm:h-3.5 sm:w-3.5" />
                {lifecyclePending === 'check-in' ? 'Seating...' : 'Seat Guest'}
                <span className="ml-2 hidden rounded bg-primary-foreground/20 px-1 py-0.5 text-[9px] font-mono opacity-60 group-hover/btn:inline">S</span>
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="flex-1 h-11 border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 active:bg-emerald-100 sm:flex-none sm:h-auto sm:w-auto group/btn touch-manipulation"
                onClick={() => handleAction('check-out')}
                disabled={lifecyclePending === 'check-out'}
                title="Finish visit (keyboard: F)"
              >
                <LogOut className="mr-2 h-4 w-4 sm:h-3.5 sm:w-3.5" />
                {lifecyclePending === 'check-out' ? 'Finishing...' : 'Finish'}
                <span className="ml-2 hidden rounded bg-emerald-100 px-1 py-0.5 text-[9px] font-mono opacity-60 group-hover/btn:inline">F</span>
              </Button>
            )}

            {/* Secondary Actions Row */}
            <div className="flex gap-1">
              {/* Quick No-Show Button */}
              {!isSeated && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-11 w-11 text-muted-foreground hover:text-rose-600 hover:bg-rose-50 active:bg-rose-100 sm:h-8 sm:w-8 touch-manipulation"
                  onClick={() => onMarkNoShow(booking.id)}
                  disabled={lifecyclePending === 'no-show'}
                  title="Mark as no-show (keyboard: N)"
                >
                  <X className="h-5 w-5 sm:h-4 sm:w-4" />
                </Button>
              )}
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
          </>
        ) : (
          <Button size="sm" variant="ghost" className="w-full cursor-default text-muted-foreground hover:bg-transparent hover:text-muted-foreground sm:w-auto" disabled>
            <Check className="mr-2 h-3.5 w-3.5" />
            {booking.status === 'completed' ? 'Completed' : 'Cancelled'}
          </Button>
        )}
      </div>
    </Card>
  );
}
