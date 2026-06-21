'use client';

import { useEffect } from 'react';

import { getRealtimeSupabaseClient } from '@/lib/supabase/realtime-client';

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
      if (refreshTimer) {
        clearTimeout(refreshTimer);
      }
      client.removeChannel(channel);
    };
  }, [bookingId, restaurantId, refetch, enabled, realtime]);
}

export type TableAssignmentRealtimeRefetchOptions = Parameters<
  typeof useTableAssignmentRealtimeRefetch
>[0];
