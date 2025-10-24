'use client';

import React, { useCallback, useEffect, useState } from 'react';

import { BookingsTable } from '@/components/dashboard/BookingsTable';
import { DASHBOARD_DEFAULT_PAGE_SIZE } from '@/components/dashboard/constants';
import { CancelBookingDialog } from '@/components/dashboard/CancelBookingDialog';
import { useBookings, type BookingDTO } from '@/hooks/useBookings';
import { useBookingsTableState } from '@/hooks/useBookingsTableState';
import { track } from '@/lib/analytics';
import { DEFAULT_VENUE } from '@shared/config/venue';

type MyBookingsClientProps = {
  scheduleParityEnabled: boolean;
};

export function MyBookingsClient({ scheduleParityEnabled }: MyBookingsClientProps) {
  const tableState = useBookingsTableState({ pageSize: DASHBOARD_DEFAULT_PAGE_SIZE });
  const { statusFilter, page, pageSize, queryFilters, handleStatusFilterChange } = tableState;
  const [editBooking, setEditBooking] = useState<BookingDTO | null>(null);
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
    // No-op: edit disabled for customer My Bookings while refactoring.
    setEditBooking(null);
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

  return (
    <section className="space-y-6">
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
        allowEdit={false}
      />

      <CancelBookingDialog booking={cancelBooking} open={isCancelOpen} onOpenChange={handleCancelOpenChange} />
    </section>
  );
}
