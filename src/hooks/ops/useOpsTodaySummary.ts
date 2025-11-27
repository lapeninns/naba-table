'use client';

import { useQuery } from '@tanstack/react-query';

import { useBookingService } from '@/contexts/ops-services';
import { queryKeys } from '@/lib/query/keys';

import type { OpsTodayBookingsSummary } from '@/types/ops';

export type UseOpsTodaySummaryOptions = {
  restaurantId?: string | null;
  targetDate?: string | null;
  enabled?: boolean;
};

export function useOpsTodaySummary(options: UseOpsTodaySummaryOptions) {
  const bookingService = useBookingService();
  const restaurantId = options.restaurantId ?? null;
  const targetDate = options.targetDate ?? null;
  const queryKey = restaurantId
    ? queryKeys.opsDashboard.summary(restaurantId, targetDate)
    : (['ops', 'dashboard', 'summary', 'disabled'] as const);

  return useQuery<OpsTodayBookingsSummary>({
    queryKey,
    queryFn: () => {
      if (!restaurantId) {
        throw new Error('Restaurant must be selected before fetching summary');
      }
      return bookingService.getTodaySummary({ restaurantId, date: targetDate ?? undefined });
    },
    enabled: Boolean(restaurantId) && (options.enabled ?? true),
    staleTime: 60_000,
  });
}
