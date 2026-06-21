'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';

import { useBookingService } from '@/contexts/ops-services';
import { queryKeys } from '@/lib/query/keys';
import { getRealtimeSupabaseClient } from '@/lib/supabase/realtime-client';

import type { ManualAssignmentContextWithSession } from '@/services/ops/bookings';

type UseManualAssignmentContextOptions = {
  bookingId: string | null;
  restaurantId: string | null;
  targetDate: string | null;
  enabled?: boolean;
};

export function useManualAssignmentContext({
  bookingId,
  restaurantId,
  targetDate,
  enabled = true,
}: UseManualAssignmentContextOptions) {
  const bookingService = useBookingService();
  const shouldEnable = enabled && Boolean(bookingId);

  const query = useQuery<ManualAssignmentContextWithSession>({
    queryKey: bookingId
      ? queryKeys.manualAssign.context(bookingId)
      : ['manualAssign', 'context', 'none'],
    queryFn: async () => {
      if (!bookingId) {
        throw new Error('manual assignment context requires bookingId');
      }
      return bookingService.getManualAssignmentContext(bookingId, { preferSession: true });
    },
    enabled: shouldEnable,
    staleTime: 5_000,
    refetchOnWindowFocus: false,
    refetchInterval: false,
  });

  useEffect(() => {
    if (!shouldEnable || !bookingId || !restaurantId) {
      return;
    }

    const client = getRealtimeSupabaseClient();
    const channelName = `ops-manual-assign:${restaurantId}:${targetDate ?? 'all'}`;
    const channel = client.channel(channelName, {
      config: {
        broadcast: { self: false },
      },
    });

    const handleChange = () => {
      void query.refetch();
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

    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'booking_table_assignments',
        filter: `booking_id=eq.${bookingId}`,
      },
      handleChange,
    );

    channel.subscribe();

    return () => {
      client.removeChannel(channel);
    };
  }, [bookingId, restaurantId, shouldEnable, targetDate, query]);

  return query;
}
