'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { getRealtimeSupabaseClient } from '@/lib/supabase/realtime-client';
import { isOwnBookingWriteEcho } from '@src/hooks/ops/bookingWriteEcho';

const ASSIGNMENT_REALTIME_REFETCH_DEBOUNCE_MS = 250;
const ASSIGNMENT_REALTIME_REFETCH_DEDUPE_MS = 750;

export function useTableAssignmentRealtimeRefetch({
  bookingId,
  enabled,
  realtime,
  refetch,
  restaurantId,
}: {
  bookingId: string;
  enabled: boolean;
  realtime: boolean;
  refetch: () => void;
  restaurantId: string;
}) {
  const queryClient = useQueryClient();
  // Skipped when a parent hook already owns a consolidated channel for the same tables.
  useEffect(() => {
    if (!bookingId || !restaurantId || !enabled || !realtime) {
      return;
    }

    const client = getRealtimeSupabaseClient();
    const channelName = `ops-table-assignment:${restaurantId}:${bookingId}`;
    const channel = client.channel(channelName, {
      config: {
        broadcast: { self: false },
      },
    });

    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    let lastRefreshAt = 0;
    const handleChange = () => {
      const now = Date.now();
      if (now - lastRefreshAt < ASSIGNMENT_REALTIME_REFETCH_DEDUPE_MS || refreshTimer) {
        return;
      }
      refreshTimer = setTimeout(() => {
        refreshTimer = null;
        lastRefreshAt = Date.now();
        void refetch();
      }, ASSIGNMENT_REALTIME_REFETCH_DEBOUNCE_MS);
    };

    // Skip echoes of this client's own table writes (the mutation already synced the caches).
    const onChange = (table: string) => (payload: unknown) => {
      if (isOwnBookingWriteEcho(queryClient, table, payload)) return;
      handleChange();
    };

    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'allocations',
        filter: `restaurant_id=eq.${restaurantId}`,
      },
      onChange('allocations'),
    );

    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'table_holds',
        filter: `restaurant_id=eq.${restaurantId}`,
      },
      onChange('table_holds'),
    );

    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'booking_table_assignments',
        filter: `booking_id=eq.${bookingId}`,
      },
      onChange('booking_table_assignments'),
    );

    channel.subscribe();

    return () => {
      if (refreshTimer) {
        clearTimeout(refreshTimer);
      }
      client.removeChannel(channel);
    };
  }, [bookingId, restaurantId, refetch, enabled, realtime, queryClient]);
}

export type TableAssignmentRealtimeRefetchOptions = Parameters<
  typeof useTableAssignmentRealtimeRefetch
>[0];
