import { act, renderHook, waitFor } from '@testing-library/react';
import { createQueryWrapper, createTestQueryClient } from '@tests/utils/reactQuery';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createFakeRealtimeClient, type FakeRealtimeClient } from './__helpers__/realtime';

import { queryKeys } from '@/lib/query/keys';
import { useOpsBookingDialogBundle } from '@src/hooks/ops/useOpsBookingDialogBundle';

const bookingService = vi.hoisted(() => ({
  getDialogBundle: vi.fn(),
}));

const realtime = vi.hoisted(() => ({ client: null as unknown }));

vi.mock('@/contexts/ops-services', () => ({
  useBookingService: () => bookingService,
}));

vi.mock('@/lib/supabase/realtime-client', () => ({
  getRealtimeSupabaseClient: () => realtime.client,
}));

const bundle = {
  booking: { id: 'booking-1', status: 'confirmed' },
  assignmentContext: {
    booking: { id: 'booking-1', restaurant_id: 'rest-1' },
    tables: [],
  },
};

function client(): FakeRealtimeClient {
  return realtime.client as FakeRealtimeClient;
}

function setup(bookingId: string | null, options?: { enabled?: boolean }) {
  const queryClient = createTestQueryClient();
  const wrapper = createQueryWrapper(queryClient);
  return {
    queryClient,
    ...renderHook(() => useOpsBookingDialogBundle(bookingId, options), { wrapper }),
  };
}

describe('useOpsBookingDialogBundle', () => {
  beforeEach(() => {
    realtime.client = createFakeRealtimeClient();
    bookingService.getDialogBundle.mockResolvedValue(bundle);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('@contract fetches the bundle and primes the detail and assignment caches', async () => {
    const { result, queryClient } = setup('booking-1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(bundle);
    expect(queryClient.getQueryData(queryKeys.opsBookings.detail('booking-1'))).toEqual(
      bundle.booking,
    );
    expect(
      queryClient.getQueryData(queryKeys.opsBookings.assignmentContext('booking-1')),
    ).toEqual(bundle.assignmentContext);
  });

  it('@contract stays disabled without a booking id', () => {
    setup(null);

    expect(bookingService.getDialogBundle).not.toHaveBeenCalled();
    expect(client().channel).not.toHaveBeenCalled();
  });

  it('@contract stays disabled when explicitly disabled', () => {
    setup('booking-1', { enabled: false });

    expect(bookingService.getDialogBundle).not.toHaveBeenCalled();
  });

  it('@contract @external-mock opens one consolidated channel covering all dialog tables', async () => {
    const { result } = setup('booking-1');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    await waitFor(() => expect(client().channels).toHaveLength(1));
    const channel = client().channels[0];
    expect(channel.name).toBe('ops-booking-dialog:rest-1:booking-1');
    expect(channel.handlers.map((handler) => handler.filter.table)).toEqual([
      'bookings',
      'booking_table_assignments',
      'booking_history',
      'allocations',
      'table_holds',
    ]);
  });

  it('@contract @external-mock debounces realtime changes into a single bundle invalidation', async () => {
    const { result, queryClient } = setup('booking-1');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await waitFor(() => expect(client().channels).toHaveLength(1));

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    vi.useFakeTimers();

    const channel = client().channels[0];
    channel.emitPostgresChange('bookings');
    channel.emitPostgresChange('allocations');

    expect(invalidateSpy).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(invalidateSpy).toHaveBeenCalledTimes(1);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['ops', 'bookings', 'dialog', 'booking-1'],
      exact: true,
      refetchType: 'active',
    });
  });

  it('@contract surfaces service errors', async () => {
    bookingService.getDialogBundle.mockRejectedValue(new Error('boom'));

    const { result } = setup('booking-1');

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
