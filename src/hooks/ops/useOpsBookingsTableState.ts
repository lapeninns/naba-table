'use client';

import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { create } from 'zustand';

import type { OpsBookingStatus } from '@/types/ops';

export type OpsStatusFilter = 'all' | 'upcoming' | 'past' | 'cancelled' | 'recent' | OpsBookingStatus;

export type UseOpsBookingsTableStateOptions = {
  initialStatus?: OpsStatusFilter;
  initialPage?: number;
  pageSize?: number;
  initialQuery?: string;
  initialSelectedStatuses?: OpsBookingStatus[];
};

type OpsBookingsTableStoreState = {
  statusFilter: OpsStatusFilter;
  page: number;
  search: string;
  selectedStatuses: OpsBookingStatus[];
  setStatusFilter: (next: OpsStatusFilter) => void;
  setPage: (next: number) => void;
  setSearch: (next: string) => void;
  toggleSelectedStatus: (status: OpsBookingStatus) => void;
  setSelectedStatuses: (next: OpsBookingStatus[]) => void;
  clearSelectedStatuses: () => void;
};

function createOpsBookingsTableStore(initial: {
  statusFilter: OpsStatusFilter;
  page: number;
  search: string;
  selectedStatuses: OpsBookingStatus[];
}) {
  return create<OpsBookingsTableStoreState>()((set, get) => ({
    ...initial,
    setStatusFilter: (next) => set({ statusFilter: next, page: 1 }),
    setPage: (next) => set({ page: next }),
    setSearch: (next) => set({ search: next, page: 1 }),
    toggleSelectedStatus: (status) => {
      const current = get().selectedStatuses;
      const exists = current.includes(status);
      const next = exists ? current.filter((value) => value !== status) : [...current, status];
      set({ selectedStatuses: next, page: 1 });
    },
    setSelectedStatuses: (next) => set({ selectedStatuses: next, page: 1 }),
    clearSelectedStatuses: () => set({ selectedStatuses: [], page: 1 }),
  }));
}

export function useOpsBookingsTableState({
  initialStatus = 'upcoming',
  initialPage = 1,
  pageSize = 10,
  initialQuery = '',
  initialSelectedStatuses = [],
}: UseOpsBookingsTableStateOptions = {}) {
  const [store] = useState(() =>
    createOpsBookingsTableStore({
      statusFilter: initialStatus,
      page: initialPage,
      search: initialQuery,
      selectedStatuses: initialSelectedStatuses,
    }),
  );

  useEffect(() => {
    store.setState({
      statusFilter: initialStatus,
      page: initialPage,
      search: initialQuery,
      selectedStatuses: initialSelectedStatuses,
    });
  }, [initialPage, initialQuery, initialSelectedStatuses, initialStatus, store]);

  const {
    statusFilter,
    page,
    search,
    selectedStatuses,
    setStatusFilter,
    setPage,
    setSearch,
    toggleSelectedStatus,
    setSelectedStatuses,
    clearSelectedStatuses,
  } = store();

  const handleStatusFilterChange = (nextStatus: OpsStatusFilter) => {
    setStatusFilter(nextStatus);
  };

  const handlePageChange = (nextPage: number, totalItems: number) => {
    if (Number.isNaN(nextPage)) return;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const clamped = Math.min(Math.max(nextPage, 1), totalPages);
    setPage(clamped);
  };

  const handleSearchChange = (nextSearch: string) => {
    setSearch(nextSearch);
  };

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
    setSelectedStatuses,
    clearSelectedStatuses,
  } as const;
}
