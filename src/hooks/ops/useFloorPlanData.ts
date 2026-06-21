'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useTableInventoryService } from '@/contexts/ops-services';
import { queryKeys } from '@/lib/query/keys';

import { useOpsTableTimeline } from './useOpsTableTimeline';

import type { FloorPlanTable } from '@/components/features/floor-plan/domain/types';
import type { ListTablesResult } from '@/services/ops/tables';
import type { TableTimelineResponse } from '@/types/ops';

export type UseFloorPlanDataOptions = {
  restaurantId?: string | null;
  date?: string | null;
};

export type FloorPlanData = {
  tables: FloorPlanTable[];
  summary: ListTablesResult['summary'];
  timeline: TableTimelineResponse | null;
  window: TableTimelineResponse['window'] | null;
  timezone: string | null;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => void;
};

/**
 * Compose the two reads a floor plan needs:
 *  - table inventory (positions, category/seatingType/mobility, zone) via opsTables.list
 *  - the live availability timeline (per-table segments + booking/hold refs)
 * and join them by table id into FloorPlanTable[] (inventory row + its segments).
 */
export function useFloorPlanData({ restaurantId, date }: UseFloorPlanDataOptions): FloorPlanData {
  const tableService = useTableInventoryService();

  const tablesQuery = useQuery<ListTablesResult>({
    queryKey: restaurantId
      ? queryKeys.opsTables.list(restaurantId, { includeSummary: true })
      : (['ops', 'tables', 'list', 'disabled'] as const),
    queryFn: () => {
      if (!restaurantId) {
        throw new Error('Restaurant ID is required to load tables');
      }
      return tableService.list(restaurantId, { includeSummary: true });
    },
    enabled: Boolean(restaurantId),
    staleTime: 30_000,
  });

  const timelineQuery = useOpsTableTimeline({
    restaurantId,
    date,
    service: 'all',
    includeSummary: true,
  });

  const tables = useMemo<FloorPlanTable[]>(() => {
    const inventory = tablesQuery.data?.tables ?? [];
    const rows = timelineQuery.data?.tables ?? [];
    const segmentsById = new Map(rows.map((row) => [row.table.id, row.segments]));
    return inventory.map((table) => ({ ...table, segments: segmentsById.get(table.id) ?? [] }));
  }, [tablesQuery.data, timelineQuery.data]);

  return {
    tables,
    summary: tablesQuery.data?.summary ?? null,
    timeline: timelineQuery.data ?? null,
    window: timelineQuery.data?.window ?? null,
    timezone: timelineQuery.data?.timezone ?? null,
    isLoading: tablesQuery.isLoading || timelineQuery.isLoading,
    isFetching: tablesQuery.isFetching || timelineQuery.isFetching,
    isError: tablesQuery.isError || timelineQuery.isError,
    error: tablesQuery.error ?? timelineQuery.error ?? null,
    refetch: () => {
      void tablesQuery.refetch();
      void timelineQuery.refetch();
    },
  };
}
