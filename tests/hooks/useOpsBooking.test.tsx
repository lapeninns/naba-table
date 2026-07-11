import { renderHook, waitFor } from '@testing-library/react';
import { createQueryWrapper, createTestQueryClient } from '@tests/utils/reactQuery';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createFakeRealtimeClient, type FakeRealtimeClient } from './__helpers__/realtime';

import { queryKeys } from '@/lib/query/keys';
import { useOpsBooking } from '@src/hooks/ops/useOpsBooking';

const bookingService = vi.hoisted(() => ({
  getBooking: vi.fn(),
}));

const realtime = vi.hoisted(() => ({ client: null as unknown }));

vi.mock('@/contexts/ops-services', () => ({
  useBookingService: () => bookingService,
}));

vi.mock('@/lib/supabase/realtime-client', () => ({
  getRealtimeSupabaseClient: () => realtime.client,
}));

const booking = { id: 'booking-1', status: 'confirmed' };

function client(): FakeRealtimeClient {
  return realtime.client as FakeRealtimeClient;
}

function setup(bookingId: string | null, options?: Parameters<typeof useOpsBooking>[1]) {
  const queryClient = createTestQueryClient();
  const wrapper = createQueryWrapper(queryClient);
  return { queryClient, ...renderHook(() => useOpsBooking(bookingId, options), { wrapper }) };
}

describe('useOpsBooking', () => {
  beforeEach(() => {
    realtime.client = createFakeRealtimeClient();
    bookingService.getBooking.mockResolvedValue(booking);
  });

  it('@contract fetches the booking detail', async () => {
    const { result } = setup('booking-1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(booking);
    expect(bookingService.getBooking).toHaveBeenCalledWith('booking-1');
  });

  it('@contract stays disabled without a booking id and opens no channel', () => {
    setup(null);

    expect(bookingService.getBooking).not.toHaveBeenCalled();
    expect(client().channel).not.toHaveBeenCalled();
  });

  it('@contract @external-mock subscribes to booking, assignment, and history changes', async () => {
    const { result } = setup('booking-1');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const channel = client().channels[0];
    expect(channel.name).toBe('ops-booking-detail:booking-1');
    const tables = channel.handlers.map((handler) => handler.filter.table);
    expect(tables).toEqual(['bookings', 'booking_table_assignments', 'booking_history']);
    expect(channel.subscribe).toHaveBeenCalled();
  });

  it('@contract @external-mock invalidates the detail cache when a realtime change arrives', async () => {
    const { result, queryClient } = setup('booking-1');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    client().channels[0].emitPostgresChange('bookings');

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.opsBookings.detail('booking-1'),
    });
  });

  it('@contract @external-mock skips the realtime subscription when realtime is off', async () => {
    const { result } = setup('booking-1', { realtime: false });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(client().channel).not.toHaveBeenCalled();
  });

  it('@contract @external-mock tears the channel down on unmount', async () => {
    const { result, unmount } = setup('booking-1');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    unmount();

    expect(client().channels[0].unsubscribe).toHaveBeenCalled();
    expect(client().removeChannel).toHaveBeenCalledWith(client().channels[0]);
  });

  it('@contract surfaces service errors', async () => {
    bookingService.getBooking.mockRejectedValue(new Error('missing'));

    const { result } = setup('booking-1');

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
