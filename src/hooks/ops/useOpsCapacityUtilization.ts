import { useQuery } from '@tanstack/react-query';

import { fetchJson } from '@/lib/http/fetchJson';
import type { PeriodUtilization } from '@/components/features/dashboard/CapacityVisualization';

export type CapacityUtilizationResponse = {
  date: string;
  periods: PeriodUtilization[];
  hasOverbooking: boolean;
};

type UseOpsCapacityUtilizationParams = {
  restaurantId: string | null;
  targetDate: string | null;
  enabled?: boolean;
};

export function useOpsCapacityUtilization({
  restaurantId,
  targetDate,
  enabled = true,
}: UseOpsCapacityUtilizationParams) {
  return useQuery<CapacityUtilizationResponse>({
    queryKey: ['ops', 'capacity', restaurantId, targetDate],
    queryFn: async () => {
      if (!restaurantId || !targetDate) {
        throw new Error('Restaurant ID and target date are required');
      }

      const params = new URLSearchParams({ restaurantId, date: targetDate });
      return fetchJson<CapacityUtilizationResponse>(`/api/ops/dashboard/capacity?${params.toString()}`);
    },
    enabled: enabled && Boolean(restaurantId) && Boolean(targetDate),
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 60,
  });
}
