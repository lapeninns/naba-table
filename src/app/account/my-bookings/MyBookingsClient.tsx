'use client';

import Link from 'next/link';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { BookingsTable } from '@/components/dashboard/BookingsTable';
import { CancelBookingDialog } from '@/components/dashboard/CancelBookingDialog';
import { DASHBOARD_DEFAULT_PAGE_SIZE } from '@/components/dashboard/constants';
import { EditBookingDialog } from '@/components/dashboard/EditBookingDialog';
import { StatusChip } from '@/components/dashboard/StatusChip';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useBookings, type BookingDTO } from '@/hooks/useBookings';
import { useBookingsTableState } from '@/hooks/useBookingsTableState';
import { track } from '@/lib/analytics';
import { cn } from '@/lib/utils';

type BookingSpotlightProps = {
  booking: BookingDTO;
  onEdit: (booking: BookingDTO) => void;
  onCancel: (booking: BookingDTO) => void;
};

type MyBookingsClientProps = {
  profileName?: string;
  profileEmail?: string | null;
  supportEmail?: string;
  showOverview?: boolean;
};

type InsightTileProps = {
  label: string;
  value: string | number;
  helper: string;
};

function BookingSpotlight({ booking, onEdit, onCancel }: BookingSpotlightProps) {
  const dateFormatter = useMemo(() => new Intl.DateTimeFormat(undefined, { dateStyle: 'full' }), []);
  const timeFormatter = useMemo(() => new Intl.DateTimeFormat(undefined, { timeStyle: 'short' }), []);
  const start = useMemo(() => new Date(booking.startIso), [booking.startIso]);
  const isPast = Number.isNaN(start.getTime()) ? false : start.getTime() < Date.now();
  const isCancelled = booking.status === 'cancelled';
  const disableActions = isCancelled || isPast;
  const dateLabel = Number.isNaN(start.getTime()) ? 'Date pending' : dateFormatter.format(start);
  const timeLabel = Number.isNaN(start.getTime()) ? '' : timeFormatter.format(start);

  return (
    <Card className="border-primary/15 bg-white/90 shadow-sm ring-1 ring-primary/5">
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-primary">Next booking</p>
          <CardTitle className="text-2xl font-semibold text-slate-900">{booking.restaurantName}</CardTitle>
          <p className="text-sm text-slate-600">
            {dateLabel}
            {timeLabel ? ` · ${timeLabel}` : ''} · Party of {booking.partySize}
          </p>
        </div>
        <StatusChip status={booking.status} />
      </CardHeader>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1 text-sm text-slate-700">
          {booking.notes ? <p className="text-slate-600">Notes: {booking.notes}</p> : null}
          <p className="text-slate-600">
            Keep your contact details updated so updates reach you fast.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            onClick={() => onEdit(booking)}
            className={cn('w-full sm:w-auto')}
            disabled={disableActions}
            aria-disabled={disableActions}
          >
            Change booking
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full sm:w-auto text-destructive"
            onClick={() => onCancel(booking)}
            disabled={disableActions}
            aria-disabled={disableActions}
          >
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptySpotlight({ supportEmail }: { supportEmail?: string }) {
  return (
    <Card className="border-dashed border-primary/25 bg-white/80">
      <CardHeader className="space-y-2">
        <p className="text-sm font-semibold text-primary">You do not have an upcoming booking</p>
        <CardTitle className="text-xl font-semibold text-slate-900">Plan your next visit</CardTitle>
        <p className="text-sm text-slate-600">
          Book a new table in a few taps or manage past reservations in the list below. We will keep confirmations and
          reminders in one place.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1 text-sm text-slate-700">
          <p>Use the filters below to see past and cancelled visits.</p>
          {supportEmail ? <p>Need a hand? Email us at {supportEmail}.</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href="/reserve">Start a booking</Link>
          </Button>
          <Button variant="outline" asChild>
            <a href="#bookings-table">Go to bookings</a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function InsightTile({ label, value, helper }: InsightTileProps) {
  return (
    <Card className="border-slate-200 bg-white">
      <CardHeader className="space-y-1 py-4 pb-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        <CardTitle className="text-2xl font-semibold text-slate-900">{value}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0 text-sm text-slate-600">{helper}</CardContent>
    </Card>
  );
}

export function MyBookingsClient({ profileName, profileEmail, supportEmail, showOverview = true }: MyBookingsClientProps) {
  const tableState = useBookingsTableState({ pageSize: DASHBOARD_DEFAULT_PAGE_SIZE });
  const { statusFilter, page, pageSize, queryFilters, handleStatusFilterChange } = tableState;
  const [editBooking, setEditBooking] = useState<BookingDTO | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [cancelBooking, setCancelBooking] = useState<BookingDTO | null>(null);
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const { data, error, isLoading, isFetching, refetch } = useBookings(queryFilters);

  useEffect(() => {
    if (!data) return;
    track('dashboard_viewed', {
      totalBookings: data.pageInfo?.total ?? 0,
      filter: statusFilter,
    });
  }, [data, statusFilter]);

  const pageInfo = data?.pageInfo ?? {
    page,
    pageSize,
    total: 0,
    hasNext: false,
  };

  const awaitingConfirmation = data?.items
    ? data.items.filter((booking) => booking.status === 'pending' || booking.status === 'pending_allocation').length
    : 0;

  const cancelledCount = data?.items ? data.items.filter((booking) => booking.status === 'cancelled').length : 0;

  const handlePageChange = useCallback(
    (nextPage: number) => {
      tableState.handlePageChange(nextPage, pageInfo.total);
    },
    [pageInfo.total, tableState],
  );

  const handleEdit = useCallback((booking: BookingDTO) => {
    setEditBooking(booking);
    setIsEditOpen(true);
  }, []);

  const handleEditOpenChange = useCallback((open: boolean) => {
    setIsEditOpen(open);
    if (!open) {
      setEditBooking(null);
    }
  }, []);

  const handleCancel = useCallback((booking: BookingDTO) => {
    setCancelBooking(booking);
    setIsCancelOpen(true);
    track('dashboard_cancel_opened', {
      bookingId: booking.id,
      status: booking.status,
    });
  }, []);

  const handleCancelOpenChange = useCallback((open: boolean) => {
    setIsCancelOpen(open);
    if (!open) {
      setCancelBooking(null);
    }
  }, []);

  const handleSearchChange = useCallback((value: string) => {
    setSearchTerm(value);
  }, []);

  let highlightBooking: BookingDTO | null = null;
  if (data?.items?.length) {
    const upcoming = data.items
      .filter((booking) => booking.status !== 'cancelled')
      .sort((a, b) => new Date(a.startIso).getTime() - new Date(b.startIso).getTime());
    highlightBooking = upcoming[0] ?? null;
  }

  const insights = useMemo(
    () => [
      {
        label: 'Upcoming bookings',
        value: isLoading ? '—' : pageInfo.total,
        helper: 'See all your upcoming reservations in one list.',
      },
      {
        label: 'Awaiting confirmation',
        value: isLoading ? '—' : awaitingConfirmation,
        helper: 'We will email you as soon as slots are confirmed.',
      },
      {
        label: 'Updates go to',
        value: profileEmail ?? 'Add an email',
        helper: 'Manage your contact to receive reminders and changes.',
      },
    ],
    [awaitingConfirmation, isLoading, pageInfo.total, profileEmail],
  );

  const greetingLine = profileName
    ? `Here is what is coming up for you, ${profileName}.`
    : 'Here is what is coming up for you.';

  return (
    <section className="space-y-8">
      {showOverview ? (
        <Card className="border-slate-200 bg-white shadow-sm">
          <CardHeader className="space-y-2">
            <p className="text-sm font-semibold text-primary">Bookings overview</p>
            <CardTitle className="text-2xl font-semibold text-slate-900">Manage your visits</CardTitle>
            <p className="text-sm text-slate-600">{greetingLine}</p>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2 text-xs text-slate-500">
            {profileEmail ? <span className="rounded-full bg-slate-100 px-3 py-1">Alerts to {profileEmail}</span> : null}
            <span className="rounded-full bg-slate-100 px-3 py-1">Filter by upcoming, past, or cancelled</span>
            <span className="rounded-full bg-slate-100 px-3 py-1">Search by restaurant or details</span>
          </CardContent>
        </Card>
      ) : null}

      {highlightBooking ? (
        <BookingSpotlight booking={highlightBooking} onEdit={handleEdit} onCancel={handleCancel} />
      ) : !isLoading && showOverview ? (
        <EmptySpotlight supportEmail={supportEmail} />
      ) : null}

      {showOverview ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {insights.map((item) => (
            <InsightTile key={item.label} label={item.label} value={item.value} helper={item.helper} />
          ))}
          <InsightTile
            label="Cancellations tracked"
            value={isLoading ? '—' : cancelledCount}
            helper="Cancelled bookings stay listed with context."
          />
        </div>
      ) : null}

      <div id="bookings-table">
        <BookingsTable
          bookings={data?.items ?? []}
          page={pageInfo.page}
          pageSize={pageInfo.pageSize}
          total={pageInfo.total}
          statusFilter={statusFilter}
          isLoading={isLoading}
          isFetching={isFetching}
          error={error ?? null}
          searchTerm={searchTerm}
          onSearchChange={handleSearchChange}
          onStatusFilterChange={handleStatusFilterChange}
          onPageChange={handlePageChange}
          onRetry={refetch}
          onEdit={handleEdit}
          onCancel={handleCancel}
        />
      </div>

      <EditBookingDialog
        booking={editBooking}
        open={isEditOpen}
        onOpenChange={handleEditOpenChange}
        restaurantSlug={editBooking?.restaurantSlug ?? null}
        restaurantTimezone={editBooking?.restaurantTimezone ?? null}
      />
      <CancelBookingDialog booking={cancelBooking} open={isCancelOpen} onOpenChange={handleCancelOpenChange} />
    </section>
  );
}
