'use client';

import { Calendar as CalendarIcon, Clock, LogIn, Users } from 'lucide-react';

import { BookingActionButton } from '@/components/features/booking-state-machine';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDateReadable, formatTimeRange } from '@/lib/utils/datetime';

import { DetailCard } from './DetailCard';

import type { BookingOverviewTabProps } from '../types';

/**
 * Overview tab content with quick actions and booking details
 * Single Responsibility: Display booking overview and action controls
 */
export function BookingOverviewTab({
  booking,
  summary,
  effectiveStatus: _effectiveStatus,
  isCancelled,
  supportsTableAssignment,
  lifecycleAvailability,
  lifecyclePending,
  relativeStartTime,
  checkedInRelativeTime,
  onCheckIn,
  onCheckOut,
  onMarkNoShow,
  onUndoNoShow,
}: BookingOverviewTabProps) {
  const serviceDateReadable = formatDateReadable(summary.date, summary.timezone);
  const serviceTime = formatTimeRange(booking.startTime, booking.endTime, summary.timezone);

  const formatLifecycleTimestamp = (iso: string | null) => {
    if (!iso) return 'Not yet';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return 'Not yet';
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: summary.timezone,
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
    return formatter.format(date);
  };

  return (
    <div className="grid gap-6">
      {/* Quick Actions Card */}
      <Card className="border-none bg-secondary/30 shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">Quick Actions</CardTitle>
          <CardDescription>Manage arrival status and booking lifecycle.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <BookingActionButton
            booking={booking}
            pendingAction={lifecyclePending}
            onCheckIn={onCheckIn}
            onCheckOut={onCheckOut}
            onMarkNoShow={onMarkNoShow}
            onUndoNoShow={onUndoNoShow}
            showConfirmation
            lifecycleAvailability={lifecycleAvailability}
          />
          {isCancelled ? (
            <Alert variant="destructive" className="border-destructive/20 bg-destructive/5">
              <AlertTitle>Booking cancelled</AlertTitle>
              <AlertDescription>
                Status changes are disabled for cancelled reservations.
              </AlertDescription>
            </Alert>
          ) : null}
          {!supportsTableAssignment ? (
            <Alert className="border-muted bg-muted/50">
              <AlertTitle>Past service date</AlertTitle>
              <AlertDescription>Table assignment changes are locked.</AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      {/* Booking Details Grid */}
      <div className="grid gap-4 sm:grid-cols-2">
        <DetailCard
          icon={Users}
          label="Guests"
          value={`${booking.partySize} ${booking.partySize === 1 ? 'guest' : 'guests'}`}
        />
        <DetailCard icon={CalendarIcon} label="Date" value={serviceDateReadable} />
        <DetailCard
          icon={Clock}
          label="Time"
          value={serviceTime}
          relativeTime={relativeStartTime || undefined}
        />
        <DetailCard
          icon={LogIn}
          label="Checked In"
          value={formatLifecycleTimestamp(booking.checkedInAt)}
          relativeTime={checkedInRelativeTime || undefined}
        />
      </div>
    </div>
  );
}
