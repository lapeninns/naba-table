'use client';

import { useMemo } from 'react';

import { useOpsBookingsList } from '@/hooks/ops/useOpsBookingsList';
import { useOpsBookingStatusSummary } from '@/hooks/ops/useOpsBookingStatusSummary';

import {
  buildOpsBookingsListFilters,
  buildOpsBookingsStatusFilterOptions,
  resolveOpsBookingsAppliedDateRange,
} from './opsBookingsQueryDomain';
import { deriveOpsBookingsData } from './opsBookingsSelectors';

import type { OpsBookingsWindowMode } from './opsBookingsTypes';
import type { OpsBookingStatus } from '@/types/ops';
import type { OpsBookingsView } from '@/utils/ops/buildOpsBookingsFilters';

export function useOpsBookingsDataState(params: {
  restaurantId: string | null;
  restaurantSlug: string | null;
  restaurantTimezone: string | null;
  selectedDate: string | null;
  resolvedTime: string | null;
  resolvedWindowMode: OpsBookingsWindowMode;
  resolvedWindowMinutes: number;
  view: OpsBookingsView;
  deferredSearch: string;
  visibleSelectedStatuses: OpsBookingStatus[];
  resolvedTableId: string | null;
  listableStatuses: OpsBookingStatus[];
}) {
  const {
    restaurantId,
    restaurantSlug,
    restaurantTimezone,
    selectedDate,
    resolvedTime,
    resolvedWindowMode,
    resolvedWindowMinutes,
    view,
    deferredSearch,
    visibleSelectedStatuses,
    resolvedTableId,
    listableStatuses,
  } = params;

  const appliedDateRange = useMemo(
    () =>
      resolveOpsBookingsAppliedDateRange({
        selectedDate,
        resolvedTime,
        resolvedWindowMode,
        resolvedWindowMinutes,
        restaurantTimezone,
      }),
    [resolvedTime, resolvedWindowMinutes, resolvedWindowMode, restaurantTimezone, selectedDate],
  );

  const filters = useMemo(() => {
    return buildOpsBookingsListFilters({
      restaurantId,
      appliedDateRange,
      view,
      now: new Date(),
      deferredSearch,
      visibleSelectedStatuses,
      resolvedTableId,
    });
  }, [
    appliedDateRange,
    deferredSearch,
    resolvedTableId,
    restaurantId,
    view,
    visibleSelectedStatuses,
  ]);

  const bookingsQuery = useOpsBookingsList(filters);
  const bookingsPages = useMemo(() => bookingsQuery.data?.pages ?? [], [bookingsQuery.data?.pages]);
  const bookingsItems = useMemo(() => bookingsPages.flatMap((page) => page.items), [bookingsPages]);
  const bookingsTotal = bookingsPages[0]?.pageInfo.total ?? 0;

  const derivedData = useMemo(
    () => deriveOpsBookingsData(bookingsItems, restaurantSlug),
    [bookingsItems, restaurantSlug],
  );

  const statusSummaryQuery = useOpsBookingStatusSummary({
    restaurantId,
    from: appliedDateRange?.from ?? null,
    to: appliedDateRange?.to ?? null,
    enabled: Boolean(restaurantId),
  });

  const statusFilterOptions = useMemo(
    () =>
      buildOpsBookingsStatusFilterOptions({
        listableStatuses,
        totals: statusSummaryQuery.data?.totals,
      }),
    [listableStatuses, statusSummaryQuery.data?.totals],
  );

  return {
    appliedDateRange,
    filters,
    bookingsQuery,
    bookingsTotal,
    derivedData,
    statusSummaryQuery,
    statusFilterOptions,
  };
}
