'use client';

import { useEffect, useMemo, useState } from 'react';

import {
  DEFAULT_OPS_BOOKINGS_FILTER,
  filterVisibleOpsBookingsStatuses,
  resolveOpsBookingsDate,
  resolveOpsBookingsInitialStatuses,
  resolveOpsBookingsStatusFilter,
  resolveOpsBookingsTime,
  resolveOpsBookingsView,
  resolveOpsBookingsWindowMinutes,
  resolveOpsBookingsWindowMode,
  shouldShowOpsBookingsReset,
} from '@/components/features/bookings/opsBookingsQueryDomain';
import { useOpsBookingsQueryActions } from '@/components/features/bookings/useOpsBookingsQueryActions';
import { useOpsBookingsQuerySync } from '@/components/features/bookings/useOpsBookingsQuerySync';
import {
  useOpsBookingsTableState,
  type OpsStatusFilter,
} from '@/hooks/ops/useOpsBookingsTableState';

import type { OpsBookingsClientStateParams, OpsBookingsWindowMode } from './opsBookingsTypes';
import type { OpsBookingStatus } from '@/types/ops';

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
  const { opsBasePath, urlParams, updateSearchParams } = useOpsBookingsQuerySync({
    activeRestaurantId,
    isOnline,
  });

  const focusBookingId = urlParams.get('focus') ?? null;
  const resolvedTableId = urlParams.get('tableId') ?? initialTableId ?? null;
  const resolvedTableLabel = urlParams.get('tableLabel') ?? initialTableLabel ?? null;
  const urlDate = resolveOpsBookingsDate(urlParams, initialDate);
  const resolvedTime = resolveOpsBookingsTime(urlParams, initialTime);

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
    return resolveOpsBookingsWindowMode({
      initialWindowMode,
      params: urlParams,
      resolvedTableId,
      resolvedTime,
    });
  }, [initialWindowMode, resolvedTableId, resolvedTime, urlParams]);

  const resolvedWindowMinutes = useMemo(() => {
    return resolveOpsBookingsWindowMinutes({ initialWindowMinutes, params: urlParams });
  }, [initialWindowMinutes, urlParams]);

  const effectiveFilter = resolveOpsBookingsStatusFilter({
    initialDate,
    initialFilter,
    listableStatuses,
    params: urlParams,
  });
  const sanitizedInitialStatuses = useMemo(
    () =>
      resolveOpsBookingsInitialStatuses({
        initialStatuses,
        listableStatuses,
        params: urlParams,
      }),
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
    return resolveOpsBookingsView({ defaultView, statusFilter });
  }, [defaultView, statusFilter]);

  const visibleSelectedStatuses = useMemo(
    () => filterVisibleOpsBookingsStatuses(selectedStatuses, listableStatuses),
    [listableStatuses, selectedStatuses],
  );

  const defaultStatusFilter: OpsStatusFilter = selectedDate ? 'all' : DEFAULT_OPS_BOOKINGS_FILTER;

  const shouldShowReset = shouldShowOpsBookingsReset({
    focusBookingId: hydratedFocusBookingId,
    resolvedTableId,
    resolvedTime,
    search,
    selectedDate,
    statusFilter,
    defaultStatusFilter,
    visibleSelectedStatuses,
  });

  const queryActions = useOpsBookingsQueryActions({
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
  });

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
    ...queryActions,
  } as const;
}
