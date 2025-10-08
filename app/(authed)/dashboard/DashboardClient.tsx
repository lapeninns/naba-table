'use client';

import React, { useCallback, useEffect, useState } from 'react';

import { BookingsTable } from '@/components/dashboard/BookingsTable';
import { DASHBOARD_DEFAULT_PAGE_SIZE } from '@/components/dashboard/constants';
import { CancelBookingDialog } from '@/components/dashboard/CancelBookingDialog';
import { EditBookingDialog } from '@/components/dashboard/EditBookingDialog';
import { useBookings, type BookingDTO } from '@/hooks/useBookings';
import { useBookingsTableState } from '@/hooks/useBookingsTableState';
import { track } from '@/lib/analytics';

export function DashboardClient() {
  const tableState = useBookingsTableState({ pageSize: DASHBOARD_DEFAULT_PAGE_SIZE });
  const { statusFilter, page, pageSize, queryFilters, handleStatusFilterChange } = tableState;
  const [editBooking, setEditBooking] = useState<BookingDTO | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [cancelBooking, setCancelBooking] = useState<BookingDTO | null>(null);
  const [isCancelOpen, setIsCancelOpen] = useState(false);

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
        onStatusFilterChange={handleStatusFilterChange}
        onPageChange={handlePageChange}
        onRetry={refetch}
        onEdit={handleEdit}
        onCancel={handleCancel}
      />

      <EditBookingDialog booking={editBooking} open={isEditOpen} onOpenChange={handleEditOpenChange} />
      <CancelBookingDialog booking={cancelBooking} open={isCancelOpen} onOpenChange={handleCancelOpenChange} />
    </section>
  );
}
