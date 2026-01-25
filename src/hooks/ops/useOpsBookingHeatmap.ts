'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';

import { useBookingService } from '@/contexts/ops-services';
import { isRealtimeFloorplanEnabled } from '@/lib/feature-flags/realtime';
import { queryKeys } from '@/lib/query/keys';
import { getRealtimeSupabaseClient } from '@/lib/supabase/realtime-client';

import type { OpsBookingHeatmap } from '@/types/ops';

export type UseOpsBookingHeatmapOptions = {
  restaurantId?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  enabled?: boolean;
};

export function useOpsBookingHeatmap(options: UseOpsBookingHeatmapOptions) {
  const bookingService = useBookingService();
  const queryClient = useQueryClient();
  const restaurantId = options.restaurantId ?? null;
  const startDate = options.startDate ?? null;
  const endDate = options.endDate ?? null;

  const isUuid = (val: string | null) =>
    !!val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
  const queryKey = useMemo(
    () =>
      restaurantId && startDate && endDate && isUuid(restaurantId)
        ? queryKeys.opsDashboard.heatmap(restaurantId, startDate, endDate)
        : (['ops', 'dashboard', 'heatmap', 'disabled'] as const),
    [restaurantId, startDate, endDate],
  );

  const isEnabled =
    Boolean(restaurantId && startDate && endDate && isUuid(restaurantId)) &&
    (options.enabled ?? true);

  const query = useQuery<OpsBookingHeatmap>({
    queryKey,
    queryFn: () => {
      if (!restaurantId || !startDate || !endDate || !isUuid(restaurantId)) {
        throw new Error('Valid Restaurant ID, startDate, and endDate are required for heatmap');
      }
      return bookingService.getBookingHeatmap({ restaurantId, startDate, endDate });
    },
    enabled: isEnabled,
    staleTime: 5 * 60_000,
  });

  // Realtime subscription for heatmap
  useEffect(() => {
    if (!isEnabled || !restaurantId || !isRealtimeFloorplanEnabled()) {
      return;
    }

    const client = getRealtimeSupabaseClient();
    const channel = client.channel(`ops-heatmap:${restaurantId}:${startDate}:${endDate}`);

    const handleChange = () => {
      queryClient.invalidateQueries({ queryKey });
    };

    // Listen to bookings table changes for the heatmap date range
    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'bookings',
        filter: `restaurant_id=eq.${restaurantId}`,
      },
      handleChange,
    );

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log(`[realtime] Heatmap subscribed for restaurant ${restaurantId}`);
      }
    });

    return () => {
      channel.unsubscribe();
      client.removeChannel(channel);
    };
  }, [isEnabled, restaurantId, startDate, endDate, queryClient, queryKey]);

  return query;
}
