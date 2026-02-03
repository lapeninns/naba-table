'use client';

import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';

import { useBookingService } from '@/contexts/ops-services';
import { useSupabaseSession } from '@/hooks/useSupabaseSession';
import { isRealtimeFloorplanEnabled } from '@/lib/feature-flags/realtime';
import { queryKeys } from '@/lib/query/keys';
import { getRealtimeSupabaseClient } from '@/lib/supabase/realtime-client';

import type { OpsTodayBookingsSummary } from '@/types/ops';

export type UseOpsTodaySummaryOptions = {
  restaurantId?: string | null;
  targetDate?: string | null;
  enabled?: boolean;
};

export function useOpsTodaySummary(options: UseOpsTodaySummaryOptions) {
  const bookingService = useBookingService();
  const { status } = useSupabaseSession();
  const queryClient = useQueryClient();
  const restaurantId = options.restaurantId ?? null;
  const targetDate = options.targetDate ?? null;
  const [realtimeHealthy, setRealtimeHealthy] = useState(true);
  const [isVisible, setIsVisible] = useState(true);
  const subscribedRef = useRef(false);
  const realtimeFlag = isRealtimeFloorplanEnabled();
  const pollIntervalMs = 15_000;
  const queryKey = useMemo(
    () =>
      restaurantId
        ? queryKeys.opsDashboard.summary(restaurantId, targetDate)
        : (['ops', 'dashboard', 'summary', 'disabled'] as const),
    [restaurantId, targetDate],
  );
  const isUuid = (val: string | null) =>
    !!val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
  const isEnabled =
    Boolean(restaurantId) &&
    isUuid(restaurantId) &&
    (options.enabled ?? true) &&
    status !== 'loading';

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const handleVisibility = () => setIsVisible(document.visibilityState === 'visible');
    handleVisibility();
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  const shouldPoll = isEnabled && isVisible && (!realtimeFlag || !realtimeHealthy);

  const query = useQuery<OpsTodayBookingsSummary>({
    queryKey,
    queryFn: () => {
      if (!restaurantId) {
        throw new Error('Restaurant must be selected before fetching summary');
      }
      return bookingService.getTodaySummary({ restaurantId, date: targetDate ?? undefined });
    },
    enabled: isEnabled,
    staleTime: 60_000,
    refetchInterval: shouldPoll ? pollIntervalMs : false,
    refetchIntervalInBackground: false,
    refetchOnReconnect: isEnabled,
    refetchOnWindowFocus: isEnabled,
    // Keep previous data visible while fetching new date - enables smooth stale-while-revalidate UX
    placeholderData: keepPreviousData,
    select: (data) => ({
      ...data,
      bookings: data.bookings ?? [],
      totals: data.totals,
    }),
  });

  // Realtime subscription for dashboard summary
  useEffect(() => {
    if (!isEnabled || !restaurantId || !realtimeFlag) {
      subscribedRef.current = false;
      setRealtimeHealthy(true);
      return;
    }

    const client = getRealtimeSupabaseClient();
    const channel = client.channel(
      `ops-dashboard-summary:${restaurantId}:${targetDate ?? 'today'}`,
    );

    const handleChange = (payload: unknown) => {
      console.log('[realtime] Dashboard summary change detected:', {
        restaurantId,
        targetDate: targetDate ?? 'today',
        payload,
      });
      queryClient.invalidateQueries({ queryKey, refetchType: 'active' });
    };

    // Listen to bookings table changes
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

    // Listen to booking_table_assignments changes
    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'booking_table_assignments',
      },
      handleChange,
    );

    // Listen to loyalty_points changes
    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'loyalty_points',
        filter: `restaurant_id=eq.${restaurantId}`,
      },
      handleChange,
    );

    // Listen to customer_profiles changes
    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'customer_profiles',
      },
      handleChange,
    );

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        subscribedRef.current = true;
        setRealtimeHealthy(true);
        console.log(`[realtime] Dashboard summary subscribed for restaurant ${restaurantId}`);
        return;
      }
      if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR' || status === 'CLOSED') {
        subscribedRef.current = false;
        setRealtimeHealthy(false);
      }
    });

    const connectGuard = setTimeout(() => {
      if (!subscribedRef.current) {
        setRealtimeHealthy(false);
      }
    }, 4000);

    return () => {
      clearTimeout(connectGuard);
      channel.unsubscribe();
      client.removeChannel(channel);
    };
  }, [isEnabled, queryClient, queryKey, realtimeFlag, restaurantId, targetDate]);

  return query;
}
