'use client';

import { useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';

import { useBookingService } from '@/contexts/ops-services';
import { queryKeys } from '@/lib/query/keys';
import { getRealtimeSupabaseClient } from '@/lib/supabase/realtime-client';

import { isOwnBookingWriteEcho } from './bookingWriteEcho';

import type { HttpError } from '@/lib/http/errors';
import type { OpsBookingDialogBundle } from '@/services/ops/bookings';

const BUNDLE_STALE_MS = 30_000;
const REALTIME_REFETCH_DEBOUNCE_MS = 250;
const REALTIME_REFETCH_DEDUPE_MS = 750;

/**
 * Single round-trip data hook for the ops booking dialog. Fetches the
 * `/api/ops/bookings/:id/dialog` endpoint, then primes the React Query caches
 * for both `opsBookings.detail` and `opsBookings.assignmentContext` so the
 * legacy hooks (`useOpsBooking`, `useTableAssignment`) read from cache without
 * issuing their own network requests.
 *
 * Also consolidates realtime invalidation onto a single Supabase channel that
 * watches every table the dialog cares about (Phase 4.1 of the dialog perf
 * plan). When this hook is mounted with `enabled: true`, callers should pass
 * `realtime: false` to the legacy hooks to avoid duplicate subscriptions.
 */
export function useOpsBookingDialogBundle(
  bookingId: string | null,
  options?: { enabled?: boolean },
): UseQueryResult<OpsBookingDialogBundle, HttpError> {
  const bookingService = useBookingService();
  const queryClient = useQueryClient();
  const isEnabled = Boolean(bookingId) && (options?.enabled ?? true);

  const queryKey = useMemo(
    () =>
      bookingId
        ? queryKeys.opsBookings.dialog(bookingId)
        : queryKeys.opsBookings.dialog('disabled'),
    [bookingId],
  );

  const query = useQuery<OpsBookingDialogBundle, HttpError>({
    queryKey,
    queryFn: async () => {
      if (!bookingId) throw new Error('Booking ID is required');
      const bundle = await bookingService.getDialogBundle(bookingId);
      // Prime the per-purpose caches so the legacy hooks read from memory.
      queryClient.setQueryData(queryKeys.opsBookings.detail(bookingId), bundle.booking);
      queryClient.setQueryData(
        queryKeys.opsBookings.assignmentContext(bookingId),
        bundle.assignmentContext,
      );
      return bundle;
    },
    enabled: isEnabled,
    staleTime: BUNDLE_STALE_MS,
  });

  // Single consolidated realtime channel covering everything the dialog needs.
  // Replaces the two channels previously opened by `useOpsBooking` and
  // `useTableAssignment` (which are now disabled when the bundle is active).
  const restaurantId = query.data?.assignmentContext.booking.restaurant_id ?? null;
  useEffect(() => {
    if (!isEnabled || !bookingId || !restaurantId) {
      return;
    }

    const client = getRealtimeSupabaseClient();
    const channel = client.channel(`ops-booking-dialog:${restaurantId}:${bookingId}`, {
      config: { broadcast: { self: false } },
    });

    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    let lastRefreshAt = 0;

    const invalidateBundle = () => {
      const now = Date.now();
      if (now - lastRefreshAt < REALTIME_REFETCH_DEDUPE_MS || refreshTimer) {
        return;
      }

      refreshTimer = setTimeout(() => {
        refreshTimer = null;
        lastRefreshAt = Date.now();
        void queryClient.invalidateQueries({
          queryKey,
          exact: true,
          refetchType: 'active',
        });
      }, REALTIME_REFETCH_DEBOUNCE_MS);
    };

    // Writes from this dialog already patched the bundle from the server response; skip their
    // realtime echoes, and events for this booking while one of its writes is in flight.
    const onChange = (table: string) => (payload: unknown) => {
      if (isOwnBookingWriteEcho(queryClient, table, payload)) return;
      invalidateBundle();
    };

    channel
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bookings', filter: `id=eq.${bookingId}` },
        onChange('bookings'),
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'booking_table_assignments',
          filter: `booking_id=eq.${bookingId}`,
        },
        onChange('booking_table_assignments'),
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'booking_history',
          filter: `booking_id=eq.${bookingId}`,
        },
        onChange('booking_history'),
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'allocations',
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        onChange('allocations'),
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'table_holds',
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        onChange('table_holds'),
      );

    channel.subscribe();

    return () => {
      if (refreshTimer) {
        clearTimeout(refreshTimer);
      }
      client.removeChannel(channel);
    };
  }, [bookingId, isEnabled, queryClient, queryKey, restaurantId]);

  return query;
}
