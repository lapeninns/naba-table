'use client';

import {
  keepPreviousData,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';

import { useBookingService } from '@/contexts/ops-services';
import { useSupabaseSession } from '@/hooks/useSupabaseSession';
import { isRealtimeFloorplanEnabled } from '@/lib/feature-flags/realtime';
import {
  SUMMARY_INVALIDATION_DEBOUNCE_MS,
  SUMMARY_POLL_INTERVAL_MS,
  SUMMARY_SAFETY_POLL_INTERVAL_MS,
} from '@/lib/ops/realtime';
import { queryKeys } from '@/lib/query/keys';
import { getRealtimeSupabaseClient } from '@/lib/supabase/realtime-client';
import {
  createScopedRealtimeInvalidator,
  matchesDashboardSummaryRealtimePayload,
} from '@/utils/ops/realtimeInvalidation';

import type { OpsDashboardData } from '@/types/ops';

const DASHBOARD_FOCUS_REFETCH_MIN_AGE_MS = 60_000;

export type UseOpsDashboardDataOptions = {
  restaurantId?: string | null;
  targetDate?: string | null;
  enabled?: boolean;
};

export type UseOpsDashboardDataResult = UseQueryResult<OpsDashboardData> & {
  realtimeHealthy: boolean;
  realtimeEnabled: boolean;
  isPolling: boolean;
};

function normalizeDashboardData(data: OpsDashboardData): OpsDashboardData {
  const bookings = data.bookings ?? [];
  const meta = data.meta ?? {
    date: data.date,
    timezone: data.timezone,
    restaurantId: data.restaurantId,
  };

  if (bookings === data.bookings && meta === data.meta) {
    return data;
  }

  return {
    ...data,
    meta,
    bookings,
    totals: data.totals,
  };
}

export function useOpsDashboardData(
  options: UseOpsDashboardDataOptions,
): UseOpsDashboardDataResult {
  const bookingService = useBookingService();
  const { status } = useSupabaseSession();
  const queryClient = useQueryClient();
  const restaurantId = options.restaurantId ?? null;
  const targetDate = options.targetDate ?? null;
  const [realtimeHealthy, setRealtimeHealthy] = useState(true);
  const [isVisible, setIsVisible] = useState(true);
  const subscribedRef = useRef(false);
  const lastSummaryUpdatedAtRef = useRef<number | null>(null);
  const realtimeFlag = isRealtimeFloorplanEnabled();
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

  const realtimeEnabled = isEnabled && realtimeFlag;
  const shouldPoll = isEnabled && isVisible && (!realtimeEnabled || !realtimeHealthy);

  const query = useQuery<OpsDashboardData>({
    queryKey,
    queryFn: () => {
      if (!restaurantId) {
        throw new Error('Restaurant must be selected before fetching summary');
      }
      return bookingService.getTodaySummary({ restaurantId, date: targetDate ?? undefined });
    },
    enabled: isEnabled,
    staleTime: 60_000,
    refetchInterval: shouldPoll ? SUMMARY_POLL_INTERVAL_MS : false,
    refetchIntervalInBackground: false,
    refetchOnReconnect: isEnabled,
    refetchOnWindowFocus: (queryInstance) => {
      if (!isEnabled || !isVisible) return false;
      const updatedAt = queryInstance.state.dataUpdatedAt;
      if (!updatedAt) return true;
      return Date.now() - updatedAt >= DASHBOARD_FOCUS_REFETCH_MIN_AGE_MS;
    },
    placeholderData: keepPreviousData,
    select: normalizeDashboardData,
  });
  const { data, dataUpdatedAt, isFetching, refetch } = query;

  const activeSummary = useMemo(() => {
    if (!data) return null;
    if (data.restaurantId !== restaurantId) return null;
    if (targetDate && data.date !== targetDate) return null;
    return data;
  }, [data, restaurantId, targetDate]);

  const effectiveDate = activeSummary?.date ?? targetDate ?? null;
  const bookingIds = useMemo(
    () => Array.from(new Set(activeSummary?.bookings.map((booking) => booking.id) ?? [])),
    [activeSummary],
  );
  const customerIds = useMemo(
    () =>
      Array.from(
        new Set(
          activeSummary?.bookings
            .map((booking) => booking.customerId ?? null)
            .filter((customerId): customerId is string => Boolean(customerId)) ?? [],
        ),
      ),
    [activeSummary],
  );
  const bookingIdsKey = bookingIds.join(',');
  const customerIdsKey = customerIds.join(',');

  useEffect(() => {
    if (!data) return;
    if (dataUpdatedAt) {
      lastSummaryUpdatedAtRef.current = dataUpdatedAt;
    }
  }, [data, dataUpdatedAt]);

  useEffect(() => {
    if (!isEnabled || !realtimeFlag || !realtimeHealthy || !isVisible) return;

    const interval = setInterval(() => {
      const lastUpdatedAt = lastSummaryUpdatedAtRef.current;
      if (!lastUpdatedAt || isFetching) return;
      const age = Date.now() - lastUpdatedAt;
      if (age >= SUMMARY_SAFETY_POLL_INTERVAL_MS) {
        void refetch();
      }
    }, SUMMARY_SAFETY_POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [isEnabled, isFetching, isVisible, realtimeFlag, realtimeHealthy, refetch]);

  useEffect(() => {
    if (!isEnabled || !restaurantId || !realtimeFlag) {
      subscribedRef.current = false;
      setRealtimeHealthy(true);
      return;
    }

    const client = getRealtimeSupabaseClient();
    const channel = client.channel(`ops-dashboard:${restaurantId}:${targetDate ?? 'today'}`);
    const scopedBookingIds = bookingIdsKey;
    const scopedCustomerIds = customerIdsKey;
    const debouncedInvalidate = createScopedRealtimeInvalidator({
      queryClient,
      queryKey,
      waitMs: SUMMARY_INVALIDATION_DEBOUNCE_MS,
    });
    const invalidateTables = () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.opsTables.list(restaurantId),
        exact: false,
      });
    };

    const handleBookingsChange = (payload: unknown) => {
      if (
        !matchesDashboardSummaryRealtimePayload({
          payload,
          restaurantId,
          effectiveDate,
        })
      ) {
        return;
      }
      debouncedInvalidate.run();
    };

    const handleScopedChange = () => {
      debouncedInvalidate.run();
      invalidateTables();
    };

    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'bookings',
        filter: `restaurant_id=eq.${restaurantId}`,
      },
      handleBookingsChange,
    );

    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'allocations',
        filter: `restaurant_id=eq.${restaurantId}`,
      },
      invalidateTables,
    );

    if (scopedBookingIds.length > 0) {
      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'booking_table_assignments',
          filter: `booking_id=in.(${scopedBookingIds})`,
        },
        handleScopedChange,
      );
    }

    if (scopedCustomerIds.length > 0) {
      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'customer_profiles',
          filter: `customer_id=in.(${scopedCustomerIds})`,
        },
        handleScopedChange,
      );
    }

    channel.subscribe((subscriptionStatus) => {
      if (subscriptionStatus === 'SUBSCRIBED') {
        subscribedRef.current = true;
        setRealtimeHealthy(true);
        return;
      }
      if (
        subscriptionStatus === 'TIMED_OUT' ||
        subscriptionStatus === 'CHANNEL_ERROR' ||
        subscriptionStatus === 'CLOSED'
      ) {
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
      debouncedInvalidate.deactivate();
      clearTimeout(connectGuard);
      channel.unsubscribe();
      client.removeChannel(channel);
    };
  }, [
    bookingIdsKey,
    customerIdsKey,
    effectiveDate,
    isEnabled,
    queryClient,
    queryKey,
    realtimeFlag,
    restaurantId,
    targetDate,
  ]);

  return {
    ...query,
    realtimeHealthy,
    realtimeEnabled,
    isPolling: !realtimeEnabled || !realtimeHealthy,
  };
}
