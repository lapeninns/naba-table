'use client';

import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import {
  buildFloorLayoutSnapshot,
  buildFloorPlanSnapshot,
} from '@/components/features/floor-plan/model/floorPlanSnapshot';
import { todayInTimezone } from '@/components/features/floor-plan/model/floorPlanTime';
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
  scope = 'service',
}: {
  restaurantId: string | null;
  /** ISO date, or null for "today" in the restaurant's timezone. */
  date: string | null;
  /** `layout` loads tables only: arranging the room needs no bookings or service times. */
  scope?: 'service' | 'layout';
}): UseOpsFloorPlanResult {
  const withService = scope === 'service';
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

  const summaryQuery = useOpsDashboardData({
    restaurantId,
    targetDate: date,
    enabled: withService,
  });

  const timelineQuery = useOpsTableTimeline({
    restaurantId,
    date,
    service: 'all',
    includeSummary: false,
    enabled: withService,
  });

  const tables = tablesQuery.data;
  const summary = summaryQuery.data;
  const timeline = timelineQuery.data;

  const snapshot = useMemo(() => {
    if (!withService) {
      if (!restaurantId || !tables) return null;
      return buildFloorLayoutSnapshot({
        restaurantId,
        date: date ?? todayInTimezone(Date.now(), 'Europe/London'),
        tables,
      });
    }
    if (!restaurantId || !tables || !summary || !timeline) return null;
    // keepPreviousData can briefly return another date's payload; never mix dates.
    const resolvedDate = date ?? summary.date;
    if (
      summary.date !== resolvedDate ||
      timeline.date !== resolvedDate ||
      summary.restaurantId !== restaurantId
    ) {
      return null;
    }
    return buildFloorPlanSnapshot({ restaurantId, date: resolvedDate, tables, summary, timeline });
  }, [date, restaurantId, summary, tables, timeline, withService]);

  const failedSources = useMemo(() => {
    const failed: UseOpsFloorPlanResult['failedSources'] = [];
    if (tablesQuery.isError && !tables) failed.push('tables');
    if (withService && summaryQuery.isError && !summary) failed.push('bookings');
    if (withService && timelineQuery.isError && !timeline) failed.push('timeline');
    return failed;
  }, [
    summary,
    summaryQuery.isError,
    tables,
    tablesQuery.isError,
    timeline,
    timelineQuery.isError,
    withService,
  ]);

  const status: FloorPlanStatus = snapshot ? 'ready' : failedSources.length ? 'error' : 'loading';

  const updatedAt = snapshot
    ? withService
      ? Math.max(tablesQuery.dataUpdatedAt, summaryQuery.dataUpdatedAt, timelineQuery.dataUpdatedAt)
      : tablesQuery.dataUpdatedAt
    : null;

  const { refetch: refetchTables } = tablesQuery;
  const { refetch: refetchSummary } = summaryQuery;
  const { refetch: refetchTimeline } = timelineQuery;
  const refresh = useCallback(async () => {
    await Promise.all(
      withService ? [refetchTables(), refetchSummary(), refetchTimeline()] : [refetchTables()],
    );
  }, [refetchSummary, refetchTables, refetchTimeline, withService]);

  return {
    status,
    snapshot,
    failedSources,
    updatedAt,
    isRefreshing:
      status === 'ready' &&
      (tablesQuery.isFetching ||
        (withService && (summaryQuery.isFetching || timelineQuery.isFetching))),
    isRealtime: withService && summaryQuery.realtimeHealthy && !summaryQuery.isPolling,
    refresh,
  };
}
