'use client';

import { useCallback, useMemo, useState } from 'react';

import type { BookingStatus } from './useBookings';

type Options = {
  initialStatus?: StatusFilter;
  initialPage?: number;
  pageSize?: number;
};

export type StatusFilter = 'all' | 'upcoming' | 'past' | 'cancelled' | BookingStatus;

export function useBookingsTableState({
  initialStatus = 'upcoming',
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

  const queryFilters = useMemo(() => {
    const now = new Date();
    const filters: {
      page: number;
      pageSize: number;
      status?: BookingStatus;
      sort?: 'asc' | 'desc';
      from?: Date;
      to?: Date;
    } = {
      page,
      pageSize,
    };

    switch (statusFilter) {
      case 'upcoming':
        filters.from = now;
        filters.sort = 'asc';
        break;
      case 'past':
        filters.to = now;
        filters.sort = 'desc';
        break;
      case 'cancelled':
        filters.status = 'cancelled';
        filters.sort = 'desc';
        break;
      case 'all':
        filters.sort = 'asc';
        break;
      default:
        filters.status = statusFilter as BookingStatus;
        filters.sort = 'asc';
        break;
    }

    return filters;
  }, [page, pageSize, statusFilter]);

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
