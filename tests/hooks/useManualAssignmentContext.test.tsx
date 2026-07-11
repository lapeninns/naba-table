import { renderHook, waitFor } from '@testing-library/react';
import { createQueryWrapper, createTestQueryClient } from '@tests/utils/reactQuery';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createFakeRealtimeClient, type FakeRealtimeClient } from './__helpers__/realtime';

import { useManualAssignmentContext } from '@src/hooks/ops/useManualAssignmentContext';

const bookingService = vi.hoisted(() => ({
  getManualAssignmentContext: vi.fn(),
}));

const realtime = vi.hoisted(() => ({ client: null as unknown }));

vi.mock('@/contexts/ops-services', () => ({
  useBookingService: () => bookingService,
}));

vi.mock('@/lib/supabase/realtime-client', () => ({
  getRealtimeSupabaseClient: () => realtime.client,
}));

const context = { booking: { id: 'booking-1' }, tables: [], session: null };

function client(): FakeRealtimeClient {
  return realtime.client as FakeRealtimeClient;
}

function setup(options: Parameters<typeof useManualAssignmentContext>[0]) {
  const queryClient = createTestQueryClient();
  const wrapper = createQueryWrapper(queryClient);
  return renderHook(() => useManualAssignmentContext(options), { wrapper });
}

describe('useManualAssignmentContext', () => {
  beforeEach(() => {
    realtime.client = createFakeRealtimeClient();
    bookingService.getManualAssignmentContext.mockResolvedValue(context);
  });

  it('@contract fetches the manual assignment context preferring the session', async () => {
    const { result } = setup({
      bookingId: 'booking-1',
      restaurantId: 'rest-1',
      targetDate: '2026-07-11',
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(context);
    expect(bookingService.getManualAssignmentContext).toHaveBeenCalledWith('booking-1', {
      preferSession: true,
    });
  });

  it('@contract stays disabled without a booking id and opens no channel', () => {
    setup({ bookingId: null, restaurantId: 'rest-1', targetDate: null });

    expect(bookingService.getManualAssignmentContext).not.toHaveBeenCalled();
    expect(client().channel).not.toHaveBeenCalled();
  });

  it('@contract stays disabled when explicitly disabled', () => {
    setup({
      bookingId: 'booking-1',
      restaurantId: 'rest-1',
      targetDate: null,
      enabled: false,
    });

    expect(bookingService.getManualAssignmentContext).not.toHaveBeenCalled();
  });

  it('@contract @external-mock watches allocations, holds, and assignments scoped to the restaurant', async () => {
    const { result } = setup({
      bookingId: 'booking-1',
      restaurantId: 'rest-1',
      targetDate: '2026-07-11',
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const channel = client().channels[0];
    expect(channel.name).toBe('ops-manual-assign:rest-1:2026-07-11');
    expect(channel.handlers.map((handler) => handler.filter.table)).toEqual([
      'allocations',
      'table_holds',
      'booking_table_assignments',
    ]);
  });

  it('@contract @external-mock refetches when a watched table changes', async () => {
    const { result } = setup({
      bookingId: 'booking-1',
      restaurantId: 'rest-1',
      targetDate: null,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(bookingService.getManualAssignmentContext).toHaveBeenCalledTimes(1);

    client().channels[0].emitPostgresChange('allocations');

    await waitFor(() =>
      expect(bookingService.getManualAssignmentContext).toHaveBeenCalledTimes(2),
    );
  });

  it('@contract surfaces service errors', async () => {
    bookingService.getManualAssignmentContext.mockRejectedValue(new Error('boom'));

    const { result } = setup({
      bookingId: 'booking-1',
      restaurantId: 'rest-1',
      targetDate: null,
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
