'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';


import { useTransitionToast } from '@/components/features/booking-state-machine';
import { useOptionalBookingStateMachine } from '@/contexts/booking-state-machine';
import { useBookingService } from '@/contexts/ops-services';
import { queryKeys } from '@/lib/query/keys';
import { getRealtimeSupabaseClient } from '@/lib/supabase/realtime-client';
import { debounce } from '@/utils/debounceThrottle';

import type { OpsBookingStatus } from '@/types/ops';

type UseBookingRealtimeOptions = {
  restaurantId: string | null;
  targetDate: string | null;
  bookingIds: string[];
  visibleBookingIds?: string[];
  enabled?: boolean;
  intervalMs?: number;
};

type BookingSnapshot = {
  id: string;
  status: OpsBookingStatus;
  updatedAt: string | null;
  displayName?: string | null;
};

const DEFAULT_INTERVAL_MS = 5_000;

function getRealtimeRetryDelayMs(tries: number): number {
  const delays = [1000, 2000, 5000, 10000];
  return delays[tries - 1] ?? 10000;
}

export function useBookingRealtime({
  restaurantId,
  targetDate,
  bookingIds,
  visibleBookingIds,
  enabled = true,
  intervalMs = DEFAULT_INTERVAL_MS,
}: UseBookingRealtimeOptions) {
  const bookingService = useBookingService();
  const bookingStateMachine = useOptionalBookingStateMachine();
  const { showExternalUpdate } = useTransitionToast();
  const queryClient = useQueryClient();

  const normalizedIds = useMemo(() => Array.from(new Set(bookingIds)).sort(), [bookingIds]);
  const idsKey = useMemo(() => normalizedIds.join(','), [normalizedIds]);
  const shouldEnable = enabled && Boolean(restaurantId) && normalizedIds.length > 0;
  const idSet = useMemo(() => new Set(normalizedIds), [normalizedIds]);
  const visibleIds = useMemo(() => {
    if (visibleBookingIds === undefined || visibleBookingIds === null) {
      return idSet;
    }
    return new Set(visibleBookingIds);
  }, [idSet, visibleBookingIds]);

  const lastStatusesRef = useRef<Record<string, OpsBookingStatus>>({});
  const lastToastFingerprintRef = useRef<Record<string, number>>({});
  const bootstrappedRef = useRef(false);

  const [realtimeHealthy, setRealtimeHealthy] = useState(true);
  const subscribedRef = useRef(false);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTriesRef = useRef(0);

  useEffect(() => {
    if (!shouldEnable) {
      lastStatusesRef.current = {};
      bootstrappedRef.current = false;
    }
  }, [shouldEnable]);

  useEffect(() => {
    const allowed = new Set(normalizedIds);
    const current = lastStatusesRef.current;
    Object.keys(current).forEach((id) => {
      if (!allowed.has(id)) {
        delete current[id];
      }
    });
  }, [normalizedIds]);

  useEffect(() => {
    if (!bookingStateMachine) return;
    const entries = bookingStateMachine.state.entries;
    for (const entry of Object.values(entries)) {
      if (entry) {
        lastStatusesRef.current[entry.id] = entry.status;
      }
    }
  }, [bookingStateMachine, bookingStateMachine?.state]);

  const realtimeEnabled =
    typeof window !== 'undefined' && process.env.NEXT_PUBLIC_FEATURE_REALTIME_FLOORPLAN === 'true';
  const shouldPoll = shouldEnable && (!realtimeEnabled || !realtimeHealthy);

  const query = useQuery({
    queryKey: ['ops', 'bookings', 'realtime', restaurantId, targetDate, idsKey],
    queryFn: async () => {
      if (!restaurantId) {
        return null;
      }
      return bookingService.getTodaySummary({ restaurantId, date: targetDate ?? undefined });
    },
    enabled: shouldEnable,
    refetchInterval: shouldPoll ? intervalMs : false,
    refetchIntervalInBackground: shouldPoll,
    refetchOnReconnect: shouldEnable,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!shouldEnable || !restaurantId || !realtimeEnabled) {
      subscribedRef.current = false;
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
      retryTriesRef.current = 0;
      setRealtimeHealthy(true);
      return;
    }

    const client = getRealtimeSupabaseClient();
    const channelBaseName = `ops-allocations:${restaurantId}:${targetDate ?? 'all'}`;

    let channel = client.channel(`${channelBaseName}:${Date.now()}`, {
      config: {
        broadcast: { self: false },
      },
    });

    const queryKey = ['ops', 'bookings', 'realtime', restaurantId, targetDate, idsKey] as const;

    const invalidate = debounce(() => {
      queryClient.invalidateQueries({ queryKey, refetchType: 'active' });
      queryClient.invalidateQueries({
        queryKey: queryKeys.opsTables.list(restaurantId),
        exact: false,
      });
    }, 150);

    const attachHandlers = () => {
      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'allocations',
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        invalidate,
      );

      if (normalizedIds.length > 0) {
        const bookingFilter = normalizedIds.map((id) => `"${id}"`).join(',');
        channel.on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'booking_table_assignments',
            filter: `booking_id=in.(${bookingFilter})`,
          },
          invalidate,
        );
      }

      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          subscribedRef.current = true;
          retryTriesRef.current = 0;
          setRealtimeHealthy(true);
          return;
        }

        if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR' || status === 'CLOSED') {
          subscribedRef.current = false;
          setRealtimeHealthy(false);

          const tries = retryTriesRef.current + 1;
          retryTriesRef.current = tries;
          const delay = getRealtimeRetryDelayMs(tries);

          if (retryTimeoutRef.current) {
            clearTimeout(retryTimeoutRef.current);
          }

          retryTimeoutRef.current = setTimeout(() => {
            client.removeChannel(channel);
            channel = client.channel(`${channelBaseName}:${Date.now()}`, {
              config: {
                broadcast: { self: false },
              },
            });
            attachHandlers();
          }, delay);
        }
      });
    };

    attachHandlers();

    const connectGuard = setTimeout(() => {
      if (!subscribedRef.current) {
        setRealtimeHealthy(false);
      }
    }, 4000);

    return () => {
      clearTimeout(connectGuard);
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
      client.removeChannel(channel);
    };
  }, [idsKey, normalizedIds, queryClient, realtimeEnabled, restaurantId, shouldEnable, targetDate]);

  useEffect(() => {
    if (!shouldEnable) return;
    if (!query.data || query.data.bookings.length === 0) return;

    const snapshots: BookingSnapshot[] = [];
    const changes: Array<BookingSnapshot & { previousStatus: OpsBookingStatus | undefined }> = [];

    for (const booking of query.data.bookings) {
      if (!idSet.has(booking.id)) {
        continue;
      }
      snapshots.push({
        id: booking.id,
        status: booking.status,
        updatedAt: booking.checkedOutAt ?? booking.checkedInAt ?? null,
        displayName: booking.customerName,
      });

      const previous = lastStatusesRef.current[booking.id];
      if (
        bootstrappedRef.current &&
        previous &&
        previous !== booking.status &&
        visibleIds.has(booking.id)
      ) {
        const entry = bookingStateMachine?.getEntry(booking.id);
        const optimisticTarget = entry?.optimistic?.targetStatus ?? null;
        if (!optimisticTarget || optimisticTarget !== booking.status) {
          const fingerprint = `${booking.id}:${previous}:${booking.status}`;
          const now = Date.now();
          const lastShown = lastToastFingerprintRef.current[fingerprint] ?? 0;
          if (now - lastShown > 10_000) {
            lastToastFingerprintRef.current[fingerprint] = now;
            changes.push({
              id: booking.id,
              status: booking.status,
              updatedAt: booking.checkedOutAt ?? booking.checkedInAt ?? null,
              displayName: booking.customerName,
              previousStatus: previous,
            });
          }
        }
      }
      lastStatusesRef.current[booking.id] = booking.status;
    }

    if (snapshots.length > 0) {
      bookingStateMachine?.registerBookings(
        snapshots.map(({ id, status, updatedAt }) => ({
          id,
          status,
          updatedAt,
        })),
      );
    }

    if (changes.length > 0) {
      for (const change of changes) {
        showExternalUpdate({
          bookingLabel: change.displayName ?? change.id,
          fromStatus: change.previousStatus ?? null,
          toStatus: change.status,
        });
      }
    }

    bootstrappedRef.current = true;
  }, [bookingStateMachine, idSet, query.data, shouldEnable, showExternalUpdate, visibleIds]);

  return {
    isPolling: query.isFetching,
    lastUpdatedAt: query.data?.date ?? null,
  };
}
