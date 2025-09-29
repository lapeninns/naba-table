"use client";

import { useCallback, useMemo, useState } from "react";

import { BookingsTable, type StatusFilter } from "@/components/dashboard/BookingsTable";
import { CancelBookingDialog } from "@/components/dashboard/CancelBookingDialog";
import { EditBookingDialog } from "@/components/dashboard/EditBookingDialog";
import { useBookings, type BookingDTO } from "@/hooks/useBookings";

const DEFAULT_PAGE_SIZE = 10;

export default function DashboardPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const [editBooking, setEditBooking] = useState<BookingDTO | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [cancelBooking, setCancelBooking] = useState<BookingDTO | null>(null);
  const [isCancelOpen, setIsCancelOpen] = useState(false);

  const queryFilters = useMemo(
    () => ({ page, pageSize: DEFAULT_PAGE_SIZE, status: statusFilter }),
    [page, statusFilter],
  );

  const { data, error, isLoading, isFetching, refetch } = useBookings(queryFilters);

  const pageInfo = data?.pageInfo ?? {
    page,
    pageSize: DEFAULT_PAGE_SIZE,
    total: 0,
    hasNext: false,
  };

  const handleStatusChange = useCallback((nextStatus: StatusFilter) => {
    setStatusFilter(nextStatus);
    setPage(1);
  }, []);

  const handlePageChange = useCallback(
    (nextPage: number) => {
      if (nextPage < 1) {
        setPage(1);
        return;
      }

      const totalPages = Math.max(1, Math.ceil(pageInfo.total / pageInfo.pageSize));
      setPage(Math.min(nextPage, totalPages));
    },
    [pageInfo.pageSize, pageInfo.total],
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
        onStatusFilterChange={handleStatusChange}
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
