import { useQuery } from '@tanstack/react-query';

import { fetchJson } from '@/lib/http/fetchJson';

import type { BookingChange } from '@/components/features/dashboard/BookingChangeFeed';

export type BookingChangeFeedResponse = {
  date: string;
  changes: BookingChange[];
  totalChanges: number;
};

type UseOpsBookingChangesParams = {
  restaurantId: string | null;
  targetDate: string | null;
  limit?: number;
  enabled?: boolean;
};

export function useOpsBookingChanges({ restaurantId, targetDate, limit = 50, enabled = true }: UseOpsBookingChangesParams) {
  const isUuid = (val: string | null) => !!val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
  const isEnabled = enabled && isUuid(restaurantId) && Boolean(targetDate);

  return useQuery<BookingChangeFeedResponse>({
    queryKey: ['ops', 'changes', restaurantId, targetDate, limit],
    queryFn: async () => {
      if (!restaurantId || !targetDate || !isUuid(restaurantId)) {
        throw new Error('Valid Restaurant ID and target date are required');
      }

      const params = new URLSearchParams({ restaurantId, date: targetDate, limit: limit.toString() });
      return fetchJson<BookingChangeFeedResponse>(`/api/ops/dashboard/changes?${params.toString()}`);
    },
    enabled: isEnabled,
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 60,
  });
}
