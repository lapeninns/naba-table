'use client';

import { useQuery } from '@tanstack/react-query';

import { useBookingService } from '@/contexts/ops-services';
import { queryKeys } from '@/lib/query/keys';

import type { OpsRejectionAnalytics } from '@/types/ops';

export type UseOpsRejectionAnalyticsOptions = {
  restaurantId?: string | null;
  from?: string | null;
  to?: string | null;
  bucket?: 'day' | 'hour';
  enabled?: boolean;
};

export function useOpsRejectionAnalytics(options: UseOpsRejectionAnalyticsOptions) {
  const bookingService = useBookingService();
  const restaurantId = options.restaurantId ?? null;
  const bucket = options.bucket ?? 'day';
  const queryKey = restaurantId
    ? queryKeys.opsDashboard.rejections(restaurantId, {
        from: options.from ?? null,
        to: options.to ?? null,
        bucket,
      })
    : (['ops', 'dashboard', 'rejections', 'disabled'] as const);

  return useQuery<OpsRejectionAnalytics>({
    queryKey,
    queryFn: () => {
      if (!restaurantId) {
        throw new Error('Restaurant must be selected before fetching rejection analytics');
      }
      return bookingService.getRejectionAnalytics({
        restaurantId,
        from: options.from ?? undefined,
        to: options.to ?? undefined,
        bucket,
      });
    },
    enabled: Boolean(restaurantId) && (options.enabled ?? true),
    staleTime: 60_000,
  });
}
