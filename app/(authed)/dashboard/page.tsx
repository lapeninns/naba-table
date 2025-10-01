"use client";

import { useCallback, useState } from "react";

import { BookingsTable } from "@/components/dashboard/BookingsTable";
import { CancelBookingDialog } from "@/components/dashboard/CancelBookingDialog";
import { EditBookingDialog } from "@/components/dashboard/EditBookingDialog";
import { useBookings, type BookingDTO } from "@/hooks/useBookings";
import { useBookingsTableState } from "@/hooks/useBookingsTableState";

const DEFAULT_PAGE_SIZE = 10;

export default function DashboardPage() {
  const tableState = useBookingsTableState({ pageSize: DEFAULT_PAGE_SIZE });
  const { statusFilter, page, pageSize, queryFilters, handleStatusFilterChange } = tableState;
  const [editBooking, setEditBooking] = useState<BookingDTO | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [cancelBooking, setCancelBooking] = useState<BookingDTO | null>(null);
  const [isCancelOpen, setIsCancelOpen] = useState(false);

  const { data, error, isLoading, isFetching, refetch } = useBookings(queryFilters);

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
