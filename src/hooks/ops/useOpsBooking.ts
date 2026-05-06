'use client';

import { useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';

import { useBookingService } from '@/contexts/ops-services';
import { isRealtimeFloorplanEnabled } from '@/lib/feature-flags/realtime';
import { queryKeys } from '@/lib/query/keys';
import { getRealtimeSupabaseClient } from '@/lib/supabase/realtime-client';

import type { HttpError } from '@/lib/http/errors';
import type { OpsBookingListItem } from '@/types/ops';

export function useOpsBooking(
  bookingId: string | null,
  options?: { enabled?: boolean; realtime?: boolean },
): UseQueryResult<OpsBookingListItem, HttpError> {
  const bookingService = useBookingService();
  const queryClient = useQueryClient();

  const queryKey = useMemo(
    () =>
      bookingId
        ? queryKeys.opsBookings.detail(bookingId)
        : (['ops', 'bookings', 'detail', 'disabled'] as const),
    [bookingId],
  );
  const isEnabled = Boolean(bookingId) && (options?.enabled ?? true);
  const realtimeEnabled = options?.realtime ?? true;

  const query = useQuery<OpsBookingListItem, HttpError>({
    queryKey,
    queryFn: () => {
      if (!bookingId) throw new Error('Booking ID is required');
      return bookingService.getBooking(bookingId);
    },
    enabled: isEnabled,
    staleTime: 60_000,
  });

  // Realtime subscription for individual booking. Callers using
  // `useOpsBookingDialogBundle` (which subscribes on a single consolidated
  // channel) should pass `realtime: false` to avoid duplicate subscriptions.
  useEffect(() => {
    if (!isEnabled || !realtimeEnabled || !bookingId || !isRealtimeFloorplanEnabled()) {
      return;
    }

    const client = getRealtimeSupabaseClient();
    const channel = client.channel(`ops-booking-detail:${bookingId}`);

    const handleChange = () => {
      // Invalidate this specific booking's cache
      queryClient.invalidateQueries({ queryKey });
    };

    // Listen to this specific booking
    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'bookings',
        filter: `id=eq.${bookingId}`,
      },
      handleChange,
    );

    // Listen to table assignments for this booking
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

    // Listen to booking history for this booking
    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'booking_history',
        filter: `booking_id=eq.${bookingId}`,
      },
      handleChange,
    );

    channel.subscribe();

    return () => {
      channel.unsubscribe();
      client.removeChannel(channel);
    };
  }, [bookingId, isEnabled, realtimeEnabled, queryClient, queryKey]);

  return query;
}
