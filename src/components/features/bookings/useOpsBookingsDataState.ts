'use client';

import { useMemo } from 'react';

import { useOpsBookingsList } from '@/hooks/ops/useOpsBookingsList';
import { useOpsBookingStatusSummary } from '@/hooks/ops/useOpsBookingStatusSummary';
import {
  DEFAULT_OPS_BOOKINGS_WINDOW_MINUTES,
  buildOpsDateRange,
  buildOpsTimeWindowRange,
} from '@/utils/ops/bookings';
import { buildOpsBookingsFilters, type OpsBookingsView } from '@/utils/ops/buildOpsBookingsFilters';

import { deriveOpsBookingsData } from './opsBookingsSelectors';

import type { OpsBookingsWindowMode } from './opsBookingsTypes';
import type { OpsBookingStatus } from '@/types/ops';

const MIN_WINDOW_MINUTES = 15;
const MAX_WINDOW_MINUTES = 240;

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

  const safeWindowMinutes = Math.min(
    MAX_WINDOW_MINUTES,
    Math.max(MIN_WINDOW_MINUTES, resolvedWindowMinutes || DEFAULT_OPS_BOOKINGS_WINDOW_MINUTES),
  );

  const appliedDateRange = useMemo(() => {
    if (resolvedWindowMode === 'window' && resolvedTime) {
      const windowRange = buildOpsTimeWindowRange(
        selectedDate,
        resolvedTime,
        safeWindowMinutes,
        restaurantTimezone,
      );
      if (windowRange) return windowRange;
    }

    return buildOpsDateRange(selectedDate, restaurantTimezone);
  }, [resolvedTime, resolvedWindowMode, restaurantTimezone, safeWindowMinutes, selectedDate]);

  const filters = useMemo(() => {
    if (!restaurantId) return null;

    return buildOpsBookingsFilters({
      restaurantId,
      view,
      scope: appliedDateRange ? { from: appliedDateRange.from, to: appliedDateRange.to } : null,
      now: new Date(),
      query: deferredSearch,
      selectedStatuses: visibleSelectedStatuses,
      tableId: resolvedTableId,
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

  const statusFilterOptions = useMemo(() => {
    const totals = statusSummaryQuery.data?.totals;
    return listableStatuses.map((status) => ({
      status,
      count: totals ? (totals[status] ?? 0) : 0,
    }));
  }, [listableStatuses, statusSummaryQuery.data?.totals]);

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
