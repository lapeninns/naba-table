'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';

import {
  useOpsBookingsTableState,
  type OpsStatusFilter,
} from '@/hooks/ops/useOpsBookingsTableState';
import { getTodayInTimezone } from '@/lib/utils/datetime';
import { DEFAULT_OPS_BOOKINGS_WINDOW_MINUTES, sanitizeTimeParam } from '@/utils/ops/bookings';
import { sanitizeDateParam } from '@/utils/ops/dashboard';

import type { OpsBookingsClientStateParams, OpsBookingsWindowMode } from './opsBookingsTypes';
import type { StatusFilter } from '@/hooks/useBookingsTableState';
import type { OpsBookingStatus } from '@/types/ops';

const DEFAULT_FILTER: OpsStatusFilter = 'upcoming';
const MIN_WINDOW_MINUTES = 15;
const MAX_WINDOW_MINUTES = 240;

function isValidStatusFilter(
  value: string | null,
  listableStatuses: OpsBookingStatus[],
): value is OpsStatusFilter {
  if (!value) return false;
  return ['all', 'upcoming', 'past', 'cancelled', 'recent', ...listableStatuses].includes(value);
}

function parseStatusesParam(
  value: string | null,
  listableStatuses: OpsBookingStatus[],
  fallback: OpsBookingStatus[],
): OpsBookingStatus[] {
  if (!value) return fallback;

  return value
    .split(',')
    .map((status) => status.trim())
    .filter((status): status is OpsBookingStatus =>
      listableStatuses.includes(status as OpsBookingStatus),
    );
}

export function useOpsBookingsQueryState(
  params: OpsBookingsClientStateParams & {
    activeRestaurantId: string | null;
    isOnline: boolean;
    restaurantTimezone: string | null;
    listableStatuses: OpsBookingStatus[];
  },
) {
  const {
    activeRestaurantId,
    initialDate,
    initialFilter,
    initialQuery,
    initialStatuses,
    initialTableId,
    initialTableLabel,
    initialTime,
    initialWindowMinutes,
    initialWindowMode,
    isOnline,
    listableStatuses,
    restaurantTimezone,
  } = params;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const opsBasePath = pathname?.startsWith('/app') ? '/app' : '';
  const searchParamsKey = searchParams?.toString() ?? '';
  const urlParams = useMemo(() => new URLSearchParams(searchParamsKey), [searchParamsKey]);

  const focusBookingId = urlParams.get('focus') ?? null;
  const resolvedTableId = urlParams.get('tableId') ?? initialTableId ?? null;
  const resolvedTableLabel = urlParams.get('tableLabel') ?? initialTableLabel ?? null;
  const urlDate = sanitizeDateParam(urlParams.get('date') ?? initialDate);
  const resolvedTime = sanitizeTimeParam(urlParams.get('time') ?? initialTime) ?? null;

  const [selectedDate, setSelectedDate] = useState<string | null>(() => urlDate);
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    setSelectedDate(urlDate);
  }, [urlDate]);

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  const hydratedFocusBookingId = hasHydrated ? focusBookingId : null;

  const resolvedWindowMode = useMemo<OpsBookingsWindowMode>(() => {
    const raw = urlParams.get('windowMode');
    if (raw === 'day' || raw === 'window') return raw;
    if (initialWindowMode === 'day' || initialWindowMode === 'window') return initialWindowMode;
    return resolvedTableId && resolvedTime ? 'window' : 'day';
  }, [initialWindowMode, resolvedTableId, resolvedTime, urlParams]);

  const resolvedWindowMinutes = useMemo(() => {
    const fallback =
      typeof initialWindowMinutes === 'number'
        ? initialWindowMinutes
        : DEFAULT_OPS_BOOKINGS_WINDOW_MINUTES;
    const raw = urlParams.get('windowMinutes');
    if (!raw) return fallback;
    const parsed = Number.parseInt(raw, 10);
    if (Number.isNaN(parsed)) return fallback;
    if (parsed < MIN_WINDOW_MINUTES || parsed > MAX_WINDOW_MINUTES) return fallback;
    return parsed;
  }, [initialWindowMinutes, urlParams]);

  const effectiveFilter =
    (isValidStatusFilter(urlParams.get('filter'), listableStatuses)
      ? (urlParams.get('filter') as OpsStatusFilter)
      : null) ??
    initialFilter ??
    (initialDate ? 'all' : DEFAULT_FILTER);
  const sanitizedInitialStatuses = useMemo(
    () =>
      parseStatusesParam(
        urlParams.get('statuses'),
        listableStatuses,
        (initialStatuses ?? []).filter((status) => listableStatuses.includes(status)),
      ),
    [initialStatuses, listableStatuses, urlParams],
  );

  const tableState = useOpsBookingsTableState({
    initialStatus: effectiveFilter,
    initialQuery: urlParams.get('query') ?? initialQuery ?? '',
    initialSelectedStatuses: sanitizedInitialStatuses,
  });
  const {
    statusFilter,
    handleStatusFilterChange,
    handleSearchChange,
    setStatusFilter,
    search,
    setSearch,
    deferredSearch,
    selectedStatuses,
    toggleSelectedStatus,
    clearSelectedStatuses,
  } = tableState;

  const defaultView = selectedDate ? 'all' : 'upcoming';
  const view = useMemo(() => {
    switch (statusFilter) {
      case 'recent':
      case 'upcoming':
      case 'all':
      case 'past':
      case 'cancelled':
        return statusFilter;
      default:
        return defaultView;
    }
  }, [defaultView, statusFilter]);

  const visibleSelectedStatuses = useMemo(
    () => selectedStatuses.filter((status) => listableStatuses.includes(status)),
    [listableStatuses, selectedStatuses],
  );

  const updateSearchParams = useCallback(
    (updates: Record<string, string | null>) => {
      if (!isOnline) {
        return;
      }

      const nextParams = new URLSearchParams(searchParamsKey);
      nextParams.delete('page');
      nextParams.delete('pageSize');
      nextParams.delete('status');

      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === '') {
          nextParams.delete(key);
        } else {
          nextParams.set(key, value);
        }
      }

      const nextQuery = nextParams.toString();
      if (nextQuery === searchParamsKey) {
        return;
      }

      startTransition(() => {
        router.replace(`${pathname}${nextQuery ? `?${nextQuery}` : ''}`, { scroll: false });
      });
    },
    [isOnline, pathname, router, searchParamsKey],
  );

  useEffect(() => {
    if (!activeRestaurantId || !isOnline) {
      return;
    }

    const currentParam = urlParams.get('restaurantId');
    if (currentParam === activeRestaurantId) {
      return;
    }

    updateSearchParams({ restaurantId: activeRestaurantId });
  }, [activeRestaurantId, isOnline, updateSearchParams, urlParams]);

  useEffect(() => {
    if (!isOnline) return;
    if (urlParams.get('page') || urlParams.get('pageSize') || urlParams.get('status')) {
      updateSearchParams({});
    }
  }, [isOnline, updateSearchParams, urlParams]);

  const defaultStatusFilter: OpsStatusFilter = selectedDate ? 'all' : DEFAULT_FILTER;

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
    [setStatusFilter, updateSearchParams],
  );

  const handleTodayServiceDate = useCallback(() => {
    const tz = restaurantTimezone ?? 'UTC';
    handleSelectServiceDate(getTodayInTimezone(tz));
  }, [handleSelectServiceDate, restaurantTimezone]);

  const handleClearServiceDate = useCallback(() => {
    setSelectedDate(null);
    setStatusFilter(DEFAULT_FILTER);
    updateSearchParams({
      date: null,
      filter: null,
      time: null,
      windowMode: null,
      windowMinutes: null,
    });
  }, [setStatusFilter, updateSearchParams]);

  const handleToggleStatus = useCallback(
    (status: OpsBookingStatus) => {
      toggleSelectedStatus(status);
      const exists = visibleSelectedStatuses.includes(status);
      const next = exists
        ? visibleSelectedStatuses.filter((value) => value !== status)
        : [...visibleSelectedStatuses, status];
      const normalized = Array.from(new Set(next));
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

  const shouldShowReset =
    search.trim().length > 0 ||
    visibleSelectedStatuses.length > 0 ||
    Boolean(selectedDate) ||
    Boolean(resolvedTableId) ||
    Boolean(resolvedTime) ||
    Boolean(hydratedFocusBookingId) ||
    statusFilter !== defaultStatusFilter;

  const handleReset = useCallback(() => {
    setSearch('');
    setStatusFilter(DEFAULT_FILTER);
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
  }, [clearSelectedStatuses, setSearch, setStatusFilter, updateSearchParams]);

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
    opsBasePath,
    focusBookingId,
    hydratedFocusBookingId,
    resolvedTableId,
    resolvedTableLabel,
    selectedDate,
    resolvedTime,
    resolvedWindowMode,
    resolvedWindowMinutes,
    statusFilter,
    search,
    deferredSearch,
    visibleSelectedStatuses,
    view,
    shouldShowReset,
    handleViewChange,
    handleWindowModeChange,
    handleClearTableFilter,
    handleSelectServiceDate,
    handleTodayServiceDate,
    handleClearServiceDate,
    handleSearchInput,
    handleToggleStatus,
    handleClearStatuses,
    handleReset,
    handleStatusFilterSelect,
    clearFocusParam,
  } as const;
}
