'use client';

import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { create } from 'zustand';

import type { OpsBookingStatus } from '@/types/ops';

export type OpsStatusFilter = 'all' | 'upcoming' | 'past' | 'cancelled' | 'recent' | OpsBookingStatus;

const UPCOMING_STATUSES: OpsBookingStatus[] = [
  'pending',
  'pending_allocation',
  'confirmed',
  'checked_in',
  'PRIORITY_WAITLIST',
];

export type UseOpsBookingsTableStateOptions = {
  initialStatus?: OpsStatusFilter;
  initialQuery?: string;
  initialSelectedStatuses?: OpsBookingStatus[];
};

type OpsBookingsTableStoreState = {
  statusFilter: OpsStatusFilter;
  search: string;
  selectedStatuses: OpsBookingStatus[];
  setStatusFilter: (next: OpsStatusFilter) => void;
  setSearch: (next: string) => void;
  toggleSelectedStatus: (status: OpsBookingStatus) => void;
  setSelectedStatuses: (next: OpsBookingStatus[]) => void;
  clearSelectedStatuses: () => void;
};

function createOpsBookingsTableStore(initial: {
  statusFilter: OpsStatusFilter;
  search: string;
  selectedStatuses: OpsBookingStatus[];
}) {
  return create<OpsBookingsTableStoreState>()((set, get) => ({
    ...initial,
    setStatusFilter: (next) => set({ statusFilter: next }),
    setSearch: (next) => set({ search: next }),
    toggleSelectedStatus: (status) => {
      const current = get().selectedStatuses;
      const exists = current.includes(status);
      const next = exists ? current.filter((value) => value !== status) : [...current, status];
      set({ selectedStatuses: next });
    },
    setSelectedStatuses: (next) => set({ selectedStatuses: next }),
    clearSelectedStatuses: () => set({ selectedStatuses: [] }),
  }));
}

export function useOpsBookingsTableState({
  initialStatus = 'upcoming',
  initialQuery = '',
  initialSelectedStatuses = [],
}: UseOpsBookingsTableStateOptions = {}) {
  const [store] = useState(() =>
    createOpsBookingsTableStore({
      statusFilter: initialStatus,
      search: initialQuery,
      selectedStatuses: initialSelectedStatuses,
    }),
  );

  useEffect(() => {
    store.setState({
      statusFilter: initialStatus,
      search: initialQuery,
      selectedStatuses: initialSelectedStatuses,
    });
  }, [initialQuery, initialSelectedStatuses, initialStatus, store]);

  const {
    statusFilter,
    search,
    selectedStatuses,
    setStatusFilter,
    setSearch,
    toggleSelectedStatus,
    setSelectedStatuses,
    clearSelectedStatuses,
  } = store();

  const handleStatusFilterChange = (nextStatus: OpsStatusFilter) => {
    setStatusFilter(nextStatus);
  };

  const handleSearchChange = (nextSearch: string) => {
    setSearch(nextSearch);
  };

  const deferredSearch = useDeferredValue(search.trim());

  const queryFilters = useMemo(() => {
    const now = new Date();
    const filters: {
      status?: OpsBookingStatus;
      sort?: 'asc' | 'desc';
      from?: Date;
      to?: Date;
      query?: string;
      statuses?: OpsBookingStatus[];
      sortBy?: 'start_at' | 'created_at';
    } = {
    };

    switch (statusFilter) {
      case 'upcoming':
        filters.from = now;
        filters.sort = 'asc';
        filters.sortBy = 'start_at';
        filters.statuses = UPCOMING_STATUSES;
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
  }, [deferredSearch, selectedStatuses, statusFilter]);

  return {
    statusFilter,
    queryFilters,
    handleStatusFilterChange,
    handleSearchChange,
    setStatusFilter,
    search,
    setSearch,
    selectedStatuses,
    toggleSelectedStatus,
    setSelectedStatuses,
    clearSelectedStatuses,
    deferredSearch,
  } as const;
}
