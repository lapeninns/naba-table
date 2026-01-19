import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';

import { fetchJson } from '@/lib/http/fetchJson';
import { getRealtimeSupabaseClient } from '@/lib/supabase/realtime-client';

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

function realtimeEnabled(): boolean {
  return (
    typeof window !== 'undefined' && process.env.NEXT_PUBLIC_FEATURE_REALTIME_FLOORPLAN === 'true'
  );
}

export function useOpsBookingChanges({
  restaurantId,
  targetDate,
  limit = 50,
  enabled = true,
}: UseOpsBookingChangesParams) {
  const queryClient = useQueryClient();
  const isUuid = (val: string | null) =>
    !!val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
  const isEnabled = enabled && isUuid(restaurantId) && Boolean(targetDate);

  const queryKey = useMemo(
    () => ['ops', 'changes', restaurantId, targetDate, limit] as const,
    [restaurantId, targetDate, limit],
  );

  const query = useQuery<BookingChangeFeedResponse>({
    queryKey,
    queryFn: async () => {
      if (!restaurantId || !targetDate || !isUuid(restaurantId)) {
        throw new Error('Valid Restaurant ID and target date are required');
      }

      const params = new URLSearchParams({
        restaurantId,
        date: targetDate,
        limit: limit.toString(),
      });
      return fetchJson<BookingChangeFeedResponse>(
        `/api/ops/dashboard/changes?${params.toString()}`,
      );
    },
    enabled: isEnabled,
    staleTime: 1000 * 30,
    refetchInterval: realtimeEnabled() ? false : 1000 * 60,
  });

  // Realtime subscription for booking changes
  useEffect(() => {
    if (!isEnabled || !restaurantId || !realtimeEnabled()) {
      return;
    }

    const client = getRealtimeSupabaseClient();
    const channel = client.channel(`ops-booking-changes:${restaurantId}:${targetDate ?? 'today'}`);

    const handleChange = () => {
      queryClient.invalidateQueries({ queryKey });
    };

    // Listen to booking_history table (changes feed comes from here)
    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'booking_history',
        filter: `restaurant_id=eq.${restaurantId}`,
      },
      handleChange,
    );

    // Also listen to bookings table for new bookings or status changes
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
        console.log(`[realtime] Booking changes feed subscribed for restaurant ${restaurantId}`);
      }
    });

    return () => {
      channel.unsubscribe();
      client.removeChannel(channel);
    };
  }, [isEnabled, restaurantId, targetDate, queryClient, queryKey]);

  return query;
}
