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
            <CardContent className="flex flex-col gap-3 py-3 md:gap-4 md:py-4 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-1 flex-col gap-2">
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="text-base font-semibold text-foreground">{booking.customerName}</h3>
                  {booking.loyaltyTier ? (
                    <Badge variant="outline" className={cn('text-xs font-semibold', TIER_COLORS[booking.loyaltyTier])}>
                      {booking.loyaltyTier}
                    </Badge>
                  ) : null}
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
                  {booking.allergies && booking.allergies.length > 0 ? (
                    <span className="inline-flex items-center gap-1 text-xs text-orange-600" title={`Allergies: ${booking.allergies.join(', ')}`}>
                      <AlertTriangle className="h-4 w-4" aria-hidden />
                      Allergies
                    </span>
                  ) : null}
                  {booking.seatingPreference || booking.dietaryRestrictions ? (
                    <span className="inline-flex items-center gap-1 text-xs text-primary" title="Guest preferences available">
                      <Settings className="h-4 w-4" aria-hidden />
                      Preferences
                    </span>
                  ) : null}
                  {booking.notes ? (
                    <span className="inline-flex items-center gap-1 text-xs text-primary" title="Notes available">
                      <FileText className="h-4 w-4" aria-hidden />
                      Notes
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-11 md:h-9"
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
