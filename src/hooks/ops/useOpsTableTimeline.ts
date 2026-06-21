'use client';

import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import { useTableInventoryService } from '@/contexts/ops-services';
import { queryKeys } from '@/lib/query/keys';
import { getRealtimeSupabaseClient } from '@/lib/supabase/realtime-client';

import type { TableTimelineResponse } from '@/types/ops';

export type UseOpsTableTimelineOptions = {
  restaurantId?: string | null;
  date?: string | null;
  zoneId?: string | null;
  service?: 'lunch' | 'dinner' | 'all';
  includeSummary?: boolean;
  enabled?: boolean;
};

const POLL_INTERVAL_MS = 10_000;

export function useOpsTableTimeline({
  restaurantId,
  date,
  zoneId,
  service = 'all',
  includeSummary = true,
  enabled = true,
}: UseOpsTableTimelineOptions) {
  const tableService = useTableInventoryService();
  const queryClient = useQueryClient();
  const [realtimeHealthy, setRealtimeHealthy] = useState(false);
  const queryKey = useMemo(
    () =>
      restaurantId
        ? queryKeys.opsTables.timeline(restaurantId, {
            date: date ?? null,
            zoneId: zoneId ?? null,
            service,
            includeSummary,
          })
        : (['ops', 'tables', 'timeline', 'disabled'] as const),
    [date, includeSummary, restaurantId, service, zoneId],
  );
  const shouldEnable = Boolean(restaurantId) && enabled;
  const realtimeConfigured = realtimeEnabled();

  const query = useQuery<TableTimelineResponse>({
    queryKey,
    queryFn: () => {
      if (!restaurantId) {
        throw new Error('Restaurant ID is required to fetch table timeline');
      }
      return tableService.timeline(restaurantId, {
        date: date ?? undefined,
        zoneId: zoneId ?? undefined,
        service,
        includeSummary,
      });
    },
    enabled: shouldEnable,
    refetchInterval:
      shouldEnable && (!realtimeConfigured || !realtimeHealthy) ? POLL_INTERVAL_MS : false,
    refetchOnWindowFocus: false,
    staleTime: 5_000,
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    setRealtimeHealthy(false);

    if (!shouldEnable || !restaurantId || !realtimeConfigured) {
      return;
    }

    const client = getRealtimeSupabaseClient();
    const channel = client.channel(`ops-table-timeline:${restaurantId}:${date ?? 'all'}`, {
      config: { broadcast: { self: false } },
    });

    const handleChange = () => {
      queryClient.invalidateQueries({ queryKey, exact: true });
    };

    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'allocations',
        filter: `restaurant_id=eq.${restaurantId}`,
      },
      handleChange,
    );

    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'table_holds',
        filter: `restaurant_id=eq.${restaurantId}`,
      },
      handleChange,
    );

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        setRealtimeHealthy(true);
        return;
      }
      if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR' || status === 'CLOSED') {
        setRealtimeHealthy(false);
      }
    });

    return () => {
      setRealtimeHealthy(false);
      client.removeChannel(channel);
    };
  }, [date, queryClient, queryKey, realtimeConfigured, restaurantId, shouldEnable]);

  return query;
}

function realtimeEnabled() {
  return true;
}
