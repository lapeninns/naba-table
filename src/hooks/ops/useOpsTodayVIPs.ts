import { useQuery } from '@tanstack/react-query';

import { fetchJson } from '@/lib/http/fetchJson';

export type VIPGuest = {
  bookingId: string;
  customerId: string;
  customerName: string;
  loyaltyTier: 'bronze' | 'silver' | 'gold' | 'platinum';
  totalPoints: number;
  startTime: string;
  partySize: number;
  marketingOptIn: boolean;
};

export type VIPGuestsResponse = {
  date: string;
  vips: VIPGuest[];
  totalVipCovers: number;
};

type UseOpsTodayVIPsParams = {
  restaurantId: string | null;
  targetDate: string | null;
  enabled?: boolean;
};

export function useOpsTodayVIPs({ restaurantId, targetDate, enabled = true }: UseOpsTodayVIPsParams) {
  return useQuery<VIPGuestsResponse>({
    queryKey: ['ops', 'vips', restaurantId, targetDate],
    queryFn: async () => {
      if (!restaurantId || !targetDate) {
        throw new Error('Restaurant ID and target date are required');
      }

      const params = new URLSearchParams({ restaurantId, date: targetDate });
      return fetchJson<VIPGuestsResponse>(`/api/ops/dashboard/vips?${params.toString()}`);
    },
    enabled: enabled && Boolean(restaurantId) && Boolean(targetDate),
    staleTime: 1000 * 60,
    refetchInterval: 1000 * 60 * 2,
  });
}
