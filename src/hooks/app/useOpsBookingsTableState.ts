'use client';

import { useCallback, useDeferredValue, useMemo, useState } from 'react';

import type { OpsBookingStatus } from '@/types/ops';

export type OpsStatusFilter = 'all' | 'upcoming' | 'past' | 'cancelled' | 'recent' | OpsBookingStatus;

export type UseOpsBookingsTableStateOptions = {
  initialStatus?: OpsStatusFilter;
  initialPage?: number;
  pageSize?: number;
  initialQuery?: string;
  initialSelectedStatuses?: OpsBookingStatus[];
};

export function useOpsBookingsTableState({
  initialStatus = 'upcoming',
  initialPage = 1,
  pageSize = 10,
  initialQuery = '',
  initialSelectedStatuses = [],
}: UseOpsBookingsTableStateOptions = {}) {
  const [statusFilter, setStatusFilter] = useState<OpsStatusFilter>(initialStatus);
  const [page, setPage] = useState(initialPage);
  const [search, setSearch] = useState(initialQuery);
  const [selectedStatuses, setSelectedStatuses] = useState<OpsBookingStatus[]>(initialSelectedStatuses);

  const handleStatusFilterChange = useCallback((nextStatus: OpsStatusFilter) => {
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

  const handleSearchChange = useCallback((nextSearch: string) => {
    setSearch(nextSearch);
    setPage(1);
  }, []);

  const toggleSelectedStatus = useCallback((status: OpsBookingStatus) => {
    setSelectedStatuses((current) => {
      const exists = current.includes(status);
      const next = exists ? current.filter((value) => value !== status) : [...current, status];
      return next;
    });
    setPage(1);
  }, []);

  const replaceSelectedStatuses = useCallback((statuses: OpsBookingStatus[]) => {
    setSelectedStatuses(statuses);
    setPage(1);
  }, []);

  const clearSelectedStatuses = useCallback(() => {
    setSelectedStatuses([]);
    setPage(1);
  }, []);

  const deferredSearch = useDeferredValue(search.trim());

  const queryFilters = useMemo(() => {
    const now = new Date();
    const filters: {
      page: number;
      pageSize: number;
      status?: OpsBookingStatus;
      sort?: 'asc' | 'desc';
      from?: Date;
      to?: Date;
      query?: string;
      statuses?: OpsBookingStatus[];
      sortBy?: 'start_at' | 'created_at';
    } = {
      page,
      pageSize,
    };

    switch (statusFilter) {
      case 'upcoming':
        filters.from = now;
        filters.sort = 'asc';
        filters.sortBy = 'start_at';
        break;
      case 'past':
        filters.to = now;
        filters.sort = 'desc';
        filters.sortBy = 'start_at';
        break;
      case 'cancelled':
        filters.status = 'cancelled';
        filters.sort = 'desc';
        filters.sortBy = 'start_at';
        break;
      case 'recent':
        filters.sort = 'desc';
        filters.sortBy = 'created_at';
        break;
      case 'all':
        filters.sort = 'asc';
        filters.sortBy = 'start_at';
        break;
      default:
        filters.status = statusFilter as OpsBookingStatus;
        filters.sort = 'asc';
        filters.sortBy = 'start_at';
        break;
    }

    if (deferredSearch) {
      filters.query = deferredSearch;
    }

    if (selectedStatuses.length > 0) {
      filters.statuses = selectedStatuses;
    }

    return filters;
  }, [deferredSearch, page, pageSize, selectedStatuses, statusFilter]);

  return {
    statusFilter,
    page,
    pageSize,
    queryFilters,
    handleStatusFilterChange,
    handlePageChange,
    handleSearchChange,
    setStatusFilter,
    setPage,
    search,
    setSearch,
    selectedStatuses,
    toggleSelectedStatus,
    setSelectedStatuses: replaceSelectedStatuses,
    clearSelectedStatuses,
  } as const;
}
