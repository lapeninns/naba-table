'use client';

import Link from 'next/link';

import { StatusChip } from '@/components/dashboard/StatusChip';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useBookings, type BookingDTO } from '@/hooks/useBookings';
import { useBookingsTableState } from '@/hooks/useBookingsTableState';
import { formatDateReadable } from '@/lib/utils/datetime';

type DashboardOverviewClientProps = {
  supportEmail?: string;
  profileEmail?: string | null;
};

export function DashboardOverviewClient({ supportEmail, profileEmail }: DashboardOverviewClientProps) {
  const { queryFilters } = useBookingsTableState({ pageSize: 5 });
  const { data, isLoading, isFetching, error, refetch } = useBookings(queryFilters);

  const bookings = data?.items ?? [];
  const sortedUpcoming = bookings
    .filter((booking) => booking.status !== 'cancelled')
    .sort((a, b) => new Date(a.startIso).getTime() - new Date(b.startIso).getTime());
  const highlight = sortedUpcoming[0] ?? null;

  const awaitingCount = bookings.filter((booking) => booking.status === 'pending' || booking.status === 'pending_allocation').length;
  const cancelledCount = bookings.filter((booking) => booking.status === 'cancelled').length;

  const stats = {
    total: data?.pageInfo?.total ?? 0,
    awaiting: awaitingCount,
    cancelled: cancelledCount,
  };

  const hasBookings = bookings.length > 0;

  return (
    <div className="space-y-6">
      <Card className="border-slate-200 bg-white shadow-sm">
        <CardHeader className="space-y-2 md:flex md:items-center md:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-primary">At a glance</p>
            <CardTitle className="text-2xl font-semibold text-slate-900">Your bookings snapshot</CardTitle>
            <p className="text-sm text-slate-600">See how your reservations are tracking before diving into details.</p>
          </div>
          {isFetching ? <span className="text-xs text-slate-500">Refreshing...</span> : null}
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <StatTile label="Upcoming" value={isLoading ? '--' : stats.total} helper="Across all restaurants." loading={isLoading} />
          <StatTile
            label="Awaiting confirmation"
            value={isLoading ? '--' : stats.awaiting}
            helper="We will email you once slots are confirmed."
            loading={isLoading}
          />
          <StatTile
            label="Cancelled"
            value={isLoading ? '--' : stats.cancelled}
            helper="Keep track of cancellations for reference."
            loading={isLoading}
          />
        </CardContent>
      </Card>

      <BookingHighlight
        highlight={highlight}
        supportEmail={supportEmail}
        profileEmail={profileEmail}
        isLoading={isLoading}
        hasBookings={hasBookings}
      />

      <BookingsPreview
        bookings={bookings}
        isLoading={isLoading}
        errorMessage={error?.message}
        supportEmail={supportEmail}
        onRetry={refetch}
      />
    </div>
  );
}

type StatTileProps = {
  label: string;
  value: string | number;
  helper: string;
  loading?: boolean;
};

function StatTile({ label, value, helper, loading }: StatTileProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      {loading ? <Skeleton className="h-7 w-16" /> : <p className="text-2xl font-semibold text-slate-900">{value}</p>}
      <p className="text-xs text-slate-600">{helper}</p>
    </div>
  );
}

type BookingHighlightProps = {
  highlight: BookingDTO | null;
  supportEmail?: string;
  profileEmail?: string | null;
  isLoading: boolean;
  hasBookings: boolean;
};

function BookingHighlight({ highlight, supportEmail, profileEmail, isLoading, hasBookings }: BookingHighlightProps) {
  return (
    <Card className="border-primary/15 bg-white/90 shadow-sm ring-1 ring-primary/5">
      <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-primary">Next booking</p>
          <CardTitle className="text-xl font-semibold text-slate-900">
            {highlight?.restaurantName ?? (hasBookings ? 'Awaiting your next visit' : 'No upcoming bookings yet')}
          </CardTitle>
          <p className="text-sm text-slate-600">
            {highlight ? formatDateTime(highlight.startIso, highlight.restaurantTimezone) : 'Book a table to see it here.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild>
            <Link href="/reserve">New booking</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/my-bookings">View all bookings</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-slate-700">
        {isLoading ? (
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
        ) : null}

        {!isLoading && highlight ? (
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <p className="text-slate-700">Party of {highlight.partySize}</p>
              {highlight.notes ? <p className="text-slate-600">Notes: {highlight.notes}</p> : null}
              <p className="text-xs text-slate-500">Updates send to {profileEmail ?? 'your saved email'}.</p>
            </div>
            <StatusChip status={highlight.status} />
          </div>
        ) : null}

        {!isLoading && !highlight ? (
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <p className="text-slate-700">Start a new reservation to see it here.</p>
            {supportEmail ? (
              <a
                className="text-sm font-medium text-primary underline decoration-primary/60 underline-offset-4"
                href={`mailto:${supportEmail}`}
              >
                Email support
              </a>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

type BookingsPreviewProps = {
  bookings: BookingDTO[];
  isLoading: boolean;
  errorMessage?: string;
  supportEmail?: string;
  onRetry: () => void;
};

function BookingsPreview({ bookings, isLoading, errorMessage, supportEmail, onRetry }: BookingsPreviewProps) {
  const hasBookings = bookings.length > 0;

  return (
    <Card className="border-slate-200 bg-white shadow-sm">
      <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-primary">Latest activity</p>
          <CardTitle className="text-xl font-semibold text-slate-900">Upcoming bookings preview</CardTitle>
          <p className="text-sm text-slate-600">A quick look at the next few reservations.</p>
        </div>
        <Button variant="ghost" asChild>
          <Link href="/my-bookings">Open bookings</Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {errorMessage ? (
          <div className="rounded-lg border border-destructive/40 bg-red-50 px-4 py-3 text-sm text-red-800">
            <p className="font-medium">Unable to load bookings</p>
            <p className="text-red-700">{errorMessage}</p>
          </div>
        ) : null}

        {isLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, index) => (
              <div key={index} className="flex items-center gap-3 rounded-lg border border-slate-100 p-3">
                <Skeleton className="h-10 w-10 rounded-md" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-52" />
                  <Skeleton className="h-4 w-32" />
                </div>
                <Skeleton className="h-6 w-20 rounded" />
              </div>
            ))}
          </div>
        ) : null}

        {!isLoading && hasBookings ? (
          <div className="space-y-3">
            {bookings.slice(0, 5).map((booking) => (
              <BookingPreviewItem key={booking.id} booking={booking} />
            ))}
          </div>
        ) : null}

        {!isLoading && !hasBookings && !errorMessage ? (
          <div className="flex flex-col gap-2 rounded-lg border border-dashed border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-700 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-semibold text-slate-900">No bookings to show yet</p>
              <p className="text-slate-600">Make your next reservation to see it appear here automatically.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link href="/reserve">Book now</Link>
              </Button>
              {supportEmail ? (
                <Button variant="outline" asChild>
                  <a href={`mailto:${supportEmail}`}>Contact support</a>
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
      </CardContent>

      {errorMessage ? (
        <CardFooter className="flex flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-700">You can retry or head to the full bookings page.</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => onRetry()}>Retry</Button>
            <Button asChild>
              <Link href="/my-bookings">Go to bookings</Link>
            </Button>
          </div>
        </CardFooter>
      ) : null}
    </Card>
  );
}

type BookingPreviewItemProps = {
  booking: BookingDTO;
};

function BookingPreviewItem({ booking }: BookingPreviewItemProps) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-slate-100 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-slate-900">{booking.restaurantName}</p>
        <p className="text-sm text-slate-600">
          {formatDateTime(booking.startIso, booking.restaurantTimezone)} - Party of {booking.partySize}
        </p>
        {booking.notes ? <p className="text-xs text-slate-500">Notes: {booking.notes}</p> : null}
      </div>
      <div className="flex items-center gap-3">
        <StatusChip status={booking.status} />
      </div>
    </div>
  );
}

function formatDateTime(startIso: string, timeZone?: string | null) {
  try {
    const tz = timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    const dateLabel = formatDateReadable(startIso, tz);
    const timeLabel = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit' }).format(
      new Date(startIso),
    );
    return `${dateLabel} - ${timeLabel}`;
  } catch (error) {
    console.error('[dashboard-overview] failed to format date', error);
    return 'Date pending';
  }
}
