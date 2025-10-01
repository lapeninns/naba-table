'use client';

import { useCallback, useMemo, useState } from 'react';

import type { BookingStatus } from './useBookings';

type Options = {
  initialStatus?: StatusFilter;
  initialPage?: number;
  pageSize?: number;
};

export type StatusFilter = BookingStatus | 'all' | 'active';

export function useBookingsTableState({
  initialStatus = 'all',
  initialPage = 1,
  pageSize = 10,
}: Options = {}) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(initialStatus);
  const [page, setPage] = useState(initialPage);

  const handleStatusFilterChange = useCallback((nextStatus: StatusFilter) => {
    setStatusFilter(nextStatus);
    setPage(1);
  }, []);

  const handlePageChange = useCallback(
    (nextPage: number, totalItems: number) => {
      if (Number.isNaN(nextPage)) return;
      const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
      const clamped = Math.min(Math.max(nextPage, 1), totalPages);
      setPage(clamped);
    },
    [pageSize],
  );

  const queryFilters = useMemo(
    () => ({
      page,
      pageSize,
      status: statusFilter,
    }),
    [page, pageSize, statusFilter],
  );

  return {
    statusFilter,
    page,
    pageSize,
    queryFilters,
    setPage,
    setStatusFilter,
    handleStatusFilterChange,
    handlePageChange,
  } as const;
}
