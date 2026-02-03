'use client';

import { useInfiniteQuery, useQueryClient, type InfiniteData, type UseInfiniteQueryResult } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import { useBookingService } from '@/contexts/ops-services';
import { isRealtimeFloorplanEnabled } from '@/lib/feature-flags/realtime';
import { queryKeys } from '@/lib/query/keys';
import { getRealtimeSupabaseClient } from '@/lib/supabase/realtime-client';
import { debounce } from '@/utils/debounceThrottle';

import type { HttpError } from '@/lib/http/errors';
import type { OpsBookingsFilters, OpsBookingsPage } from '@/types/ops';

function toIsoString(value: Date | string | null | undefined): string | undefined {
  if (!value) return undefined;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value.toISOString();
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function normalizeFilters(filters: OpsBookingsFilters) {
  const normalized: Record<string, string | number> = {
    restaurantId: filters.restaurantId,
  };

  if (filters.tableId) normalized.tableId = filters.tableId;
  if (filters.pageSize) normalized.pageSize = filters.pageSize;
  if (filters.status && filters.status !== 'all') normalized.status = filters.status;
  if (filters.statuses && filters.statuses.length > 0) normalized.statuses = filters.statuses.join(',');
  if (filters.sort) normalized.sort = filters.sort;
  if (filters.sortBy) normalized.sortBy = filters.sortBy;

  const fromIso = toIsoString(filters.from ?? undefined);
  if (fromIso) normalized.from = fromIso;

  const toIso = toIsoString(filters.to ?? undefined);
  if (toIso) normalized.to = toIso;

  const query = filters.query?.toString().trim();
  if (query) normalized.query = query;

  return normalized;
}

export function useOpsBookingsList(
  filters: OpsBookingsFilters | null,
): UseInfiniteQueryResult<InfiniteData<OpsBookingsPage>, HttpError> {
  const bookingService = useBookingService();
  const queryClient = useQueryClient();
  const [realtimeHealthy, setRealtimeHealthy] = useState(true);
  const [isVisible, setIsVisible] = useState(true);
  const realtimeEnabled = isRealtimeFloorplanEnabled();
  const pollIntervalMs = 15_000;

  const normalizedFilters = useMemo(() => {
    if (!filters) return null;
    return normalizeFilters(filters);
  }, [filters]);

  const queryKey = normalizedFilters ? queryKeys.opsBookings.list(normalizedFilters) : queryKeys.opsBookings.list();

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const handleVisibility = () => setIsVisible(document.visibilityState === 'visible');
    handleVisibility();
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  useEffect(() => {
    if (!realtimeEnabled || !filters?.restaurantId) {
      setRealtimeHealthy(true);
      return;
    }

    const client = getRealtimeSupabaseClient();
    const channel = client.channel(`ops-bookings-list:${filters.restaurantId}`, {
      config: { broadcast: { self: false } },
    });

    const invalidate = debounce(() => {
      queryClient.invalidateQueries({ queryKey, exact: false, refetchType: 'active' });
    }, 150);

    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'bookings',
        filter: `restaurant_id=eq.${filters.restaurantId}`,
      },
      invalidate,
    );

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        setRealtimeHealthy(true);
        return;
      }
      if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR' || status === 'CLOSED') {
        setRealtimeHealthy(false);
      }
    });

    return () => {
      channel.unsubscribe();
      client.removeChannel(channel);
    };
  }, [filters?.restaurantId, queryClient, queryKey, realtimeEnabled]);

  const shouldPoll =
    Boolean(filters?.restaurantId) && isVisible && (!realtimeEnabled || !realtimeHealthy);

  return useInfiniteQuery<OpsBookingsPage, HttpError>({
    queryKey,
    queryFn: ({ pageParam }) => {
      if (!filters) {
        throw new Error('Restaurant is required to fetch bookings');
      }
      const page = typeof pageParam === 'number' ? pageParam : 1;
      return bookingService.listBookings({
        ...filters,
        page,
        pageSize: filters.pageSize ?? 50,
      });
    },
    enabled: Boolean(filters?.restaurantId),
    initialPageParam: 1,
    placeholderData: (previous) => previous,
    staleTime: 30_000,
    refetchInterval: shouldPoll ? pollIntervalMs : false,
    refetchIntervalInBackground: false,
    refetchOnReconnect: Boolean(filters?.restaurantId),
    refetchOnWindowFocus: Boolean(filters?.restaurantId),
    getNextPageParam: (lastPage) =>
      lastPage.pageInfo.hasNext ? lastPage.pageInfo.page + 1 : undefined,
  });
}
