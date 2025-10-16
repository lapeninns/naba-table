'use client';

import { AlertTriangle, CalendarDays, ClipboardList, FileText, Settings, Users } from 'lucide-react';
import { useMemo } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { formatTimeRange } from '@/lib/utils/datetime';

import { BookingDetailsDialog } from './BookingDetailsDialog';

import type { BookingFilter } from './BookingsFilterBar';
import type { OpsTodayBooking, OpsTodayBookingsSummary } from '@/types/ops';

type BookingsListProps = {
  bookings: OpsTodayBooking[];
  filter: BookingFilter;
  summary: OpsTodayBookingsSummary;
  onMarkStatus: (bookingId: string, status: 'completed' | 'no_show') => Promise<void>;
  pendingBookingId?: string | null;
  onAssignTable?: (bookingId: string, tableId: string) => Promise<OpsTodayBooking['tableAssignments']>;
  onUnassignTable?: (bookingId: string, tableId: string) => Promise<OpsTodayBooking['tableAssignments']>;
  tableActionState?: {
    type: 'assign' | 'unassign';
    bookingId: string | null;
    tableId?: string | null;
  } | null;
};

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  confirmed: 'default',
  completed: 'default',
  pending: 'secondary',
  pending_allocation: 'secondary',
  cancelled: 'outline',
  no_show: 'destructive',
};

const TIER_COLORS: Record<string, string> = {
  platinum: 'bg-purple-500 text-white border-purple-500',
  gold: 'bg-yellow-500 text-black border-yellow-500',
  silver: 'bg-gray-400 text-white border-gray-400',
  bronze: 'bg-amber-700 text-white border-amber-700',
};

function formatTableAssignmentDisplay(assignments: OpsTodayBooking['tableAssignments']) {
  if (!assignments || assignments.length === 0) {
    return {
      text: 'Table assignment required',
      isAssigned: false,
    } as const;
  }

  const tableNumbers = assignments.map((assignment) => assignment.tableNumber || '—');
  const totalCapacity = assignments.reduce((sum, assignment) => sum + (assignment.capacity ?? 0), 0);
  const seatsLabel = totalCapacity > 0 ? `${totalCapacity} seat${totalCapacity === 1 ? '' : 's'}` : null;

  if (assignments.length === 1) {
    const [assignment] = assignments;
    const baseLabel = `Table ${assignment.tableNumber}`;
    return {
      text: seatsLabel ? `${baseLabel} · ${seatsLabel}` : baseLabel,
      isAssigned: true,
    } as const;
  }

  const joinedTables = tableNumbers.join(' + ');
  const baseLabel = `Tables ${joinedTables}`;
  return {
    text: seatsLabel ? `${baseLabel} · ${seatsLabel}` : baseLabel,
    isAssigned: true,
  } as const;
}

function filterBookings(bookings: OpsTodayBooking[], filter: BookingFilter) {
  if (filter === 'all') return bookings;
  return bookings.filter((booking) => booking.status === filter);
}

export function BookingsList({
  bookings,
  filter,
  summary,
  onMarkStatus,
  pendingBookingId,
  onAssignTable,
  onUnassignTable,
  tableActionState,
}: BookingsListProps) {
  const filtered = useMemo(() => filterBookings(bookings, filter), [bookings, filter]);
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
      {filtered.map((booking) => {
        const statusVariant = STATUS_VARIANT[booking.status] ?? 'secondary';
        const serviceTime = formatTimeRange(booking.startTime, booking.endTime, summary.timezone);
        const tableAssignmentDisplay = formatTableAssignmentDisplay(booking.tableAssignments);
        const isTableActionPending =
          supportsTableAssignment && tableActionState?.bookingId === booking.id ? tableActionState?.type : null;

        return (
          <Card key={booking.id} className="border-border/60">
            <CardContent className="flex flex-col gap-4 py-3 sm:py-4 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-1 flex-col gap-2 sm:gap-3">
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  <h3 className="text-base font-semibold text-foreground">{booking.customerName}</h3>
                  {booking.loyaltyTier ? (
                    <Badge variant="outline" className={cn('text-xs font-semibold', TIER_COLORS[booking.loyaltyTier])}>
                      {booking.loyaltyTier}
                    </Badge>
                  ) : null}
                  <Badge variant={statusVariant} className="capitalize">
                    {booking.status.replace(/_/g, ' ')}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-xs font-semibold',
                      tableAssignmentDisplay.isAssigned
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border-amber-200 bg-amber-100 text-amber-800'
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
                    <span className="inline-flex items-center gap-1.5 text-xs text-orange-600" title={`Allergies: ${booking.allergies.join(', ')}`}>
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
                    <span className="inline-flex items-center gap-1.5 text-xs text-primary" title="Notes available">
                      <FileText className="h-4 w-4 shrink-0" aria-hidden />
                      Notes
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-11 min-w-[120px] touch-manipulation"
                  onClick={() => {
                    if (booking.status === 'completed') {
                  if (pendingBookingId === booking.id) return;
                  void onMarkStatus(booking.id, 'no_show');
                } else {
                  if (pendingBookingId === booking.id) return;
                  void onMarkStatus(booking.id, 'completed');
                }
              }}
                  disabled={pendingBookingId === booking.id}
                >
                  {pendingBookingId === booking.id
                    ? 'Updating…'
                    : booking.status === 'completed'
                      ? 'Mark no show'
                      : 'Mark show'}
                </Button>
                <BookingDetailsDialog
                  booking={booking}
                  summary={summary}
                  onStatusChange={(status) => onMarkStatus(booking.id, status)}
                  onAssignTable={supportsTableAssignment && onAssignTable ? (tableId) => onAssignTable(booking.id, tableId) : undefined}
                  onUnassignTable={supportsTableAssignment && onUnassignTable ? (tableId) => onUnassignTable(booking.id, tableId) : undefined}
                  tableActionState={
                    supportsTableAssignment && tableActionState?.bookingId === booking.id
                      ? tableActionState
                      : null
                  }
                />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
