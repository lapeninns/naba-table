"use client";

import { useCallback, useMemo, useState } from "react";

import { BookingsTable, type StatusFilter } from "@/components/dashboard/BookingsTable";
import { useBookings } from "@/hooks/useBookings";

const DEFAULT_PAGE_SIZE = 10;

export default function DashboardPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);

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
      />
    </section>
  );
}
