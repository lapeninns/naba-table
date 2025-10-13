'use client';

import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { OpsTodayBooking, OpsTodayBookingsSummary } from '@/types/ops';
import { formatTimeRange } from '@/lib/utils/datetime';
import { CalendarDays, ClipboardList, Users } from 'lucide-react';

import { BookingDetailsDialog } from './BookingDetailsDialog';
import type { BookingFilter } from './BookingsFilterBar';

type BookingsListProps = {
  bookings: OpsTodayBooking[];
  filter: BookingFilter;
  summary: OpsTodayBookingsSummary;
  onMarkStatus: (bookingId: string, status: 'completed' | 'no_show') => Promise<void>;
  pendingBookingId?: string | null;
};

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  confirmed: 'default',
  completed: 'default',
  pending: 'secondary',
  pending_allocation: 'secondary',
  cancelled: 'outline',
  no_show: 'destructive',
};

function filterBookings(bookings: OpsTodayBooking[], filter: BookingFilter) {
  if (filter === 'all') return bookings;
  return bookings.filter((booking) => booking.status === filter);
}

export function BookingsList({ bookings, filter, summary, onMarkStatus, pendingBookingId }: BookingsListProps) {
  const filtered = useMemo(() => filterBookings(bookings, filter), [bookings, filter]);

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

        return (
          <Card key={booking.id} className="border-border/60">
            <CardContent className="flex flex-col gap-4 py-4 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-1 flex-col gap-2">
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="text-base font-semibold text-foreground">{booking.customerName}</h3>
                  <Badge variant={statusVariant} className="capitalize">
                    {booking.status.replace(/_/g, ' ')}
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <CalendarDays className="h-4 w-4" aria-hidden /> {serviceTime}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-4 w-4" aria-hidden />
                    {booking.partySize} guests
                  </span>
                  {booking.notes ? <span className="text-xs text-primary">Notes available</span> : null}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
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
                />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
