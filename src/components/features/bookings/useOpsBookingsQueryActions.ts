'use client';

import { useCallback, useEffect } from 'react';

import {
  buildOpsBookingsToggledStatuses,
  DEFAULT_OPS_BOOKINGS_FILTER,
} from '@/components/features/bookings/opsBookingsQueryDomain';
import { getTodayInTimezone } from '@/lib/utils/datetime';

import type { UpdateOpsBookingsSearchParams } from './useOpsBookingsQuerySync';
import type { OpsStatusFilter } from '@/hooks/ops/useOpsBookingsTableState';
import type { StatusFilter } from '@/hooks/useBookingsTableState';
import type { OpsBookingStatus } from '@/types/ops';

export type UseOpsBookingsQueryActionsParams = {
  clearSelectedStatuses: () => void;
  defaultStatusFilter: OpsStatusFilter;
  deferredSearch: string;
  handleSearchChange: (value: string) => void;
  handleStatusFilterChange: (nextStatus: OpsStatusFilter) => void;
  resolvedWindowMinutes: number;
  restaurantTimezone: string | null;
  setSearch: (next: string) => void;
  setSelectedDate: (next: string | null) => void;
  setStatusFilter: (next: OpsStatusFilter) => void;
  toggleSelectedStatus: (status: OpsBookingStatus) => void;
  updateSearchParams: UpdateOpsBookingsSearchParams;
  visibleSelectedStatuses: OpsBookingStatus[];
};

export function useOpsBookingsQueryActions({
  clearSelectedStatuses,
  defaultStatusFilter,
  deferredSearch,
  handleSearchChange,
  handleStatusFilterChange,
  resolvedWindowMinutes,
  restaurantTimezone,
  setSearch,
  setSelectedDate,
  setStatusFilter,
  toggleSelectedStatus,
  updateSearchParams,
  visibleSelectedStatuses,
}: UseOpsBookingsQueryActionsParams) {
  const handleViewChange = useCallback(
    (nextView: OpsStatusFilter) => {
      handleStatusFilterChange(nextView);
      updateSearchParams({
        filter: nextView === defaultStatusFilter ? null : nextView,
      });
    },
    [defaultStatusFilter, handleStatusFilterChange, updateSearchParams],
  );

  const handleWindowModeChange = useCallback(
    (value: string) => {
      if (!value || (value !== 'day' && value !== 'window')) return;
      updateSearchParams({
        windowMode: value,
        windowMinutes: value === 'window' ? String(resolvedWindowMinutes) : null,
      });
    },
    [resolvedWindowMinutes, updateSearchParams],
  );

  const handleClearTableFilter = useCallback(() => {
    updateSearchParams({
      tableId: null,
      tableLabel: null,
      time: null,
      windowMode: null,
      windowMinutes: null,
    });
  }, [updateSearchParams]);

  const handleSelectServiceDate = useCallback(
    (nextDate: string) => {
      setSelectedDate(nextDate);
      setStatusFilter('all');
      updateSearchParams({
        date: nextDate,
        filter: null,
      });
    },
    [setSelectedDate, setStatusFilter, updateSearchParams],
  );

  const handleTodayServiceDate = useCallback(() => {
    const tz = restaurantTimezone ?? 'UTC';
    handleSelectServiceDate(getTodayInTimezone(tz));
  }, [handleSelectServiceDate, restaurantTimezone]);

  const handleClearServiceDate = useCallback(() => {
    setSelectedDate(null);
    setStatusFilter(DEFAULT_OPS_BOOKINGS_FILTER);
    updateSearchParams({
      date: null,
      filter: null,
      time: null,
      windowMode: null,
      windowMinutes: null,
    });
  }, [setSelectedDate, setStatusFilter, updateSearchParams]);

  const handleToggleStatus = useCallback(
    (status: OpsBookingStatus) => {
      toggleSelectedStatus(status);
      const normalized = buildOpsBookingsToggledStatuses({
        status,
        visibleSelectedStatuses,
      });
      updateSearchParams({
        statuses: normalized.length > 0 ? normalized.join(',') : null,
      });
    },
    [toggleSelectedStatus, updateSearchParams, visibleSelectedStatuses],
  );

  const handleClearStatuses = useCallback(() => {
    clearSelectedStatuses();
    updateSearchParams({ statuses: null });
  }, [clearSelectedStatuses, updateSearchParams]);

  const handleReset = useCallback(() => {
    setSearch('');
    setStatusFilter(DEFAULT_OPS_BOOKINGS_FILTER);
    clearSelectedStatuses();
    setSelectedDate(null);

    updateSearchParams({
      filter: null,
      statuses: null,
      query: null,
      date: null,
      tableId: null,
      tableLabel: null,
      time: null,
      windowMode: null,
      windowMinutes: null,
      focus: null,
    });
  }, [clearSelectedStatuses, setSearch, setSelectedDate, setStatusFilter, updateSearchParams]);

  const handleStatusFilterSelect = useCallback(
    (next: StatusFilter) => handleViewChange(next as OpsStatusFilter),
    [handleViewChange],
  );

  const handleSearchInput = useCallback(
    (value: string) => {
      handleSearchChange(value);
    },
    [handleSearchChange],
  );

  useEffect(() => {
    const trimmed = deferredSearch.trim();
    updateSearchParams({ query: trimmed.length > 0 ? trimmed : null });
  }, [deferredSearch, updateSearchParams]);

  const clearFocusParam = useCallback(
    () => updateSearchParams({ focus: null }),
    [updateSearchParams],
  );

  return {
    clearFocusParam,
    handleClearServiceDate,
    handleClearStatuses,
    handleClearTableFilter,
    handleReset,
    handleSearchInput,
    handleSelectServiceDate,
    handleStatusFilterSelect,
    handleTodayServiceDate,
    handleToggleStatus,
    handleViewChange,
    handleWindowModeChange,
  } as const;
}
