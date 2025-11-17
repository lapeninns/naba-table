'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { BookingsTable } from '@/components/dashboard/BookingsTable';
import { CancelBookingDialog } from '@/components/dashboard/CancelBookingDialog';
import { DASHBOARD_DEFAULT_PAGE_SIZE } from '@/components/dashboard/constants';
import { EditBookingDialog } from '@/components/dashboard/EditBookingDialog';
import { StatusChip } from '@/components/dashboard/StatusChip';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useBookings, type BookingDTO } from '@/hooks/useBookings';
import { useBookingsTableState } from '@/hooks/useBookingsTableState';
import { track } from '@/lib/analytics';

type BookingSpotlightProps = {
  booking: BookingDTO;
  onEdit: (booking: BookingDTO) => void;
  onCancel: (booking: BookingDTO) => void;
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
export function MyBookingsClient() {
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

  const highlightBooking = useMemo(() => {
    if (!data?.items?.length) return null;
    const upcoming = data.items
      .filter((booking) => booking.status !== 'cancelled')
      .sort((a, b) => new Date(a.startIso).getTime() - new Date(b.startIso).getTime());
    return upcoming[0] ?? null;
  }, [data?.items]);

  return (
    <section className="space-y-8">
      {highlightBooking ? (
        <BookingSpotlight booking={highlightBooking} onEdit={handleEdit} onCancel={handleCancel} />
      ) : null}
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
