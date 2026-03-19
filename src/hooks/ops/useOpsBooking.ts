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
  const isEnabled = Boolean(bookingId);

  const query = useQuery<OpsBookingListItem, HttpError>({
    queryKey,
    queryFn: () => {
      if (!bookingId) throw new Error('Booking ID is required');
      return bookingService.getBooking(bookingId);
    },
    enabled: isEnabled,
    staleTime: 60_000,
  });

  // Realtime subscription for individual booking
  useEffect(() => {
    if (!isEnabled || !bookingId || !isRealtimeFloorplanEnabled()) {
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

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log(`[realtime] Booking detail subscribed for ${bookingId}`);
      }
    });

    return () => {
      channel.unsubscribe();
      client.removeChannel(channel);
    };
  }, [isEnabled, bookingId, queryClient, queryKey]);

  return query;
}
