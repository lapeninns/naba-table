'use client';

import { useQuery } from '@tanstack/react-query';

import { useBookingService } from '@/contexts/ops-services';
import { queryKeys } from '@/lib/query/keys';

import type { OpsBookingHeatmap } from '@/types/ops';

export type UseOpsBookingHeatmapOptions = {
  restaurantId?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  enabled?: boolean;
};

export function useOpsBookingHeatmap(options: UseOpsBookingHeatmapOptions) {
  const bookingService = useBookingService();
  const restaurantId = options.restaurantId ?? null;
  const startDate = options.startDate ?? null;
  const endDate = options.endDate ?? null;

  const isUuid = (val: string | null) => !!val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
  const queryKey =
    restaurantId && startDate && endDate && isUuid(restaurantId)
      ? queryKeys.opsDashboard.heatmap(restaurantId, startDate, endDate)
      : (['ops', 'dashboard', 'heatmap', 'disabled'] as const);

  return useQuery<OpsBookingHeatmap>({
    queryKey,
    queryFn: () => {
      if (!restaurantId || !startDate || !endDate || !isUuid(restaurantId)) {
        throw new Error('Valid Restaurant ID, startDate, and endDate are required for heatmap');
      }
      return bookingService.getBookingHeatmap({ restaurantId, startDate, endDate });
    },
    enabled: Boolean(restaurantId && startDate && endDate && isUuid(restaurantId)) && (options.enabled ?? true),
    staleTime: 5 * 60_000,
  });
}
