'use client';

import { useMemo } from 'react';

import { useOpsActiveMembership } from '@/contexts/ops-session';
import { useOpsBookingHeatmap } from '@/hooks/ops/useOpsBookingHeatmap';
import { useOpsDashboardData } from '@/hooks/ops/useOpsDashboardData';
import { useOpsRestaurantDetails } from '@/hooks/ops/useOpsRestaurantDetails';
import { getTodayInTimezone } from '@/lib/utils/datetime';
import { computeCalendarRange, resolveDashboardDateState } from '@/utils/ops/dashboard';

import { getDashboardSummaryMetrics } from './dashboardSummarySelectors';

export function useOpsDashboardDataState(params: {
  selectedDate: string | null;
  isCalendarOpen: boolean;
}) {
  const { selectedDate, isCalendarOpen } = params;
  const membership = useOpsActiveMembership();
  const restaurantId = membership?.restaurantId ?? null;
  const restaurantDetails = useOpsRestaurantDetails(restaurantId ?? null);
  const summaryQuery = useOpsDashboardData({ restaurantId, targetDate: selectedDate });
  const summary = summaryQuery.data ?? null;

  const dateState = resolveDashboardDateState({
    summary,
    restaurantId,
    explicitDate: selectedDate,
  });
  const requestedDate = dateState.activeDate;
  const isSummaryMismatch = dateState.isSummaryMismatch;

  const restaurantSlug = restaurantDetails.data?.slug ?? membership?.restaurantSlug ?? null;
  const restaurantTimezone =
    restaurantDetails.data?.timezone ?? (!isSummaryMismatch ? summary?.timezone ?? null : null);
  const restaurantName = membership?.restaurantName ?? 'Restaurant';

  const heatmapRange = useMemo(() => {
    if (!requestedDate) return null;
    return computeCalendarRange(requestedDate);
  }, [requestedDate]);

  const heatmapQuery = useOpsBookingHeatmap({
    restaurantId,
    startDate: heatmapRange?.start ?? null,
    endDate: heatmapRange?.end ?? null,
    enabled: Boolean(restaurantId && heatmapRange && isCalendarOpen),
  });

  const allowTableAssignments = useMemo(() => {
    const targetDate = requestedDate;
    if (!targetDate) return true;

    const timezone = restaurantTimezone ?? summary?.timezone ?? 'UTC';
    const today = getTodayInTimezone(timezone);
    return targetDate >= today;
  }, [requestedDate, restaurantTimezone, summary?.timezone]);

  const summaryMetrics = useMemo(
    () =>
      getDashboardSummaryMetrics({
        summary,
        allowTableAssignments,
        hasAssignmentHandlers: true,
      }),
    [allowTableAssignments, summary],
  );

  const isInitialLoading =
    (summaryQuery.isLoading && !summary) || (isSummaryMismatch && !summaryQuery.isError);
  const isRefetching = summaryQuery.isFetching && !!summary && !isSummaryMismatch;
  const hasError = summaryQuery.isError && (!summary || isSummaryMismatch);
  const summaryHasError = summaryQuery.isError;

  return {
    membership,
    restaurantId,
    restaurantSlug,
    restaurantTimezone,
    restaurantName,
    summary,
    summaryQuery,
    requestedDate,
    isSummaryMismatch,
    allowTableAssignments,
    heatmapQuery,
    guestStats: summaryMetrics.guestStats,
    tabCounts: summaryMetrics.tabCounts,
    isInitialLoading,
    isRefetching,
    hasError,
    summaryHasError,
    handleRetry: summaryQuery.refetch,
  };
}
