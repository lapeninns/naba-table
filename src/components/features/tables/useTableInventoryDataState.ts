'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useTableInventoryService, useZoneService } from '@/contexts/ops-services';
import { queryKeys } from '@/lib/query/keys';

import {
  buildTableInventoryZoneOptions,
  buildTableInventoryZones,
} from './tableInventoryFormDomain';

export function useTableInventoryDataState(activeRestaurantId: string | null) {
  const tableService = useTableInventoryService();
  const zoneService = useZoneService();

  const tablesQueryKey = activeRestaurantId
    ? queryKeys.opsTables.list(activeRestaurantId)
    : (['ops', 'tables', 'no-restaurant'] as const);

  const zonesQueryKey = activeRestaurantId
    ? queryKeys.opsTables.zones(activeRestaurantId)
    : (['ops', 'tables', 'no-restaurant', 'zones'] as const);

  const {
    data: tableQueryResult,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: tablesQueryKey,
    queryFn: async () => {
      if (!activeRestaurantId) {
        throw new Error('Restaurant id is required to load tables');
      }
      return tableService.list(activeRestaurantId);
    },
    enabled: Boolean(activeRestaurantId),
    staleTime: 30_000,
  });

  const tables = useMemo(() => tableQueryResult?.tables ?? [], [tableQueryResult?.tables]);
  const summary = tableQueryResult?.summary ?? null;

  const fallbackZonesQuery = useQuery({
    queryKey: zonesQueryKey,
    queryFn: async () => {
      if (!activeRestaurantId) {
        throw new Error('Restaurant id is required to load zones');
      }
      return zoneService.list(activeRestaurantId);
    },
    enabled: Boolean(activeRestaurantId) && !isLoading && !summary,
    staleTime: 60_000,
  });

  const zones = useMemo(
    () => buildTableInventoryZones(summary, fallbackZonesQuery.data ?? []),
    [fallbackZonesQuery.data, summary],
  );

  const zoneOptions = useMemo(() => buildTableInventoryZoneOptions(zones), [zones]);

  return {
    error,
    isError,
    isFetching,
    isLoading,
    isLoadingZones: !summary && (isLoading || fallbackZonesQuery.isLoading),
    isZonesError: !summary && fallbackZonesQuery.isError,
    refetch,
    refetchZones: fallbackZonesQuery.refetch,
    summary,
    tables,
    tablesQueryKey,
    zoneOptions,
    zones,
    zonesError: fallbackZonesQuery.error,
    zonesQueryKey,
  };
}
