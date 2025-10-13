'use client';

import { useQuery } from '@tanstack/react-query';

import { useBookingService } from '@/contexts/ops-services';
import type { OpsBookingHeatmap } from '@/types/ops';
import { queryKeys } from '@/lib/query/keys';

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

  const queryKey =
    restaurantId && startDate && endDate
      ? queryKeys.opsDashboard.heatmap(restaurantId, startDate, endDate)
      : (['ops', 'dashboard', 'heatmap', 'disabled'] as const);

  return useQuery<OpsBookingHeatmap>({
    queryKey,
    queryFn: () => {
      if (!restaurantId || !startDate || !endDate) {
        throw new Error('Restaurant, startDate, and endDate are required for heatmap');
      }
      return bookingService.getBookingHeatmap({ restaurantId, startDate, endDate });
    },
    enabled: Boolean(restaurantId && startDate && endDate) && (options.enabled ?? true),
    staleTime: 5 * 60_000,
  });
}
