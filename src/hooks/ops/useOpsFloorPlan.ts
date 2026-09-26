'use client';

import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import { buildFloorPlanSnapshot } from '@/components/features/floor-plan/model/floorPlanSnapshot';
import { useTableInventoryService } from '@/contexts/ops-services';
import { useOpsDashboardData } from '@/hooks/ops/useOpsDashboardData';
import { useOpsTableTimeline } from '@/hooks/ops/useOpsTableTimeline';
import { queryKeys } from '@/lib/query/keys';

import type { FloorPlanSnapshot } from '@/components/features/floor-plan/model/floorPlanTypes';

export type FloorPlanStatus = 'loading' | 'error' | 'ready';

export type UseOpsFloorPlanResult = {
  status: FloorPlanStatus;
  snapshot: FloorPlanSnapshot | null;
  /** Which source failed, for a precise retry message. */
  failedSources: Array<'tables' | 'bookings' | 'timeline'>;
  /** Newest successful fetch across all sources (ms), or null before the first load. */
  updatedAt: number | null;
  isRefreshing: boolean;
  /** Live updates are arriving over realtime (otherwise the hooks poll). */
  isRealtime: boolean;
  refresh: () => Promise<void>;
};

/**
 * One consistent view of the floor for a date. It composes three existing
 * sources so every screen shares their caches and realtime channels:
 * - table inventory (positions, zones), same cache as Tables settings
 * - the dashboard booking summary (status, assignments, check-in times)
 * - the table timeline (service windows, allocator block windows, holds)
 */
export function useOpsFloorPlan({
  restaurantId,
  date,
}: {
  restaurantId: string | null;
  /** ISO date, or null for "today" in the restaurant's timezone. */
  date: string | null;
}): UseOpsFloorPlanResult {
  const tableService = useTableInventoryService();

  const tablesQuery = useQuery({
    queryKey: restaurantId
      ? queryKeys.opsTables.list(restaurantId)
      : ['ops', 'tables', 'no-restaurant'],
    queryFn: () => {
      if (!restaurantId) throw new Error('Restaurant id is required to load tables');
      return tableService.list(restaurantId);
    },
    enabled: Boolean(restaurantId),
    staleTime: 30_000,
  });

  const summaryQuery = useOpsDashboardData({ restaurantId, targetDate: date });

  const timelineQuery = useOpsTableTimeline({
    restaurantId,
    date,
    service: 'all',
    includeSummary: false,
  });

  const tables = tablesQuery.data;
  const summary = summaryQuery.data;
  const timeline = timelineQuery.data;

  const snapshot = useMemo(() => {
    if (!restaurantId || !tables || !summary || !timeline) return null;
    // keepPreviousData can briefly return another date's payload; never mix dates.
    const resolvedDate = date ?? summary.date;
    if (summary.date !== resolvedDate || timeline.date !== resolvedDate || summary.restaurantId !== restaurantId) {
      return null;
    }
    return buildFloorPlanSnapshot({ restaurantId, date: resolvedDate, tables, summary, timeline });
  }, [date, restaurantId, summary, tables, timeline]);

  const failedSources = useMemo(() => {
    const failed: UseOpsFloorPlanResult['failedSources'] = [];
    if (tablesQuery.isError && !tables) failed.push('tables');
    if (summaryQuery.isError && !summary) failed.push('bookings');
    if (timelineQuery.isError && !timeline) failed.push('timeline');
    return failed;
  }, [summary, summaryQuery.isError, tables, tablesQuery.isError, timeline, timelineQuery.isError]);

  const status: FloorPlanStatus = snapshot ? 'ready' : failedSources.length ? 'error' : 'loading';

  const updatedAt = snapshot
    ? Math.max(tablesQuery.dataUpdatedAt, summaryQuery.dataUpdatedAt, timelineQuery.dataUpdatedAt)
    : null;

  const { refetch: refetchTables } = tablesQuery;
  const { refetch: refetchSummary } = summaryQuery;
  const { refetch: refetchTimeline } = timelineQuery;
  const refresh = useCallback(async () => {
    await Promise.all([refetchTables(), refetchSummary(), refetchTimeline()]);
  }, [refetchSummary, refetchTables, refetchTimeline]);

  return {
    status,
    snapshot,
    failedSources,
    updatedAt,
    isRefreshing:
      status === 'ready' &&
      (tablesQuery.isFetching || summaryQuery.isFetching || timelineQuery.isFetching),
    isRealtime: summaryQuery.realtimeHealthy && !summaryQuery.isPolling,
    refresh,
  };
}
