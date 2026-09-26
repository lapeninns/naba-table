import { renderHook, waitFor } from '@testing-library/react';
import { createQueryWrapper, createTestQueryClient } from '@tests/utils/reactQuery';
import { beforeEach, describe, expect, it, vi } from 'vitest';


import { SUMMARY_INVALIDATION_DEBOUNCE_MS } from '@/lib/ops/realtime';
import { queryKeys } from '@/lib/query/keys';
import { recordBookingWrite } from '@src/hooks/ops/bookingWriteEcho';
import { useOpsBookingHeatmap } from '@src/hooks/ops/useOpsBookingHeatmap';

import { createFakeRealtimeClient, type FakeRealtimeClient } from './__helpers__/realtime';

const bookingService = vi.hoisted(() => ({
  getBookingHeatmap: vi.fn(),
}));

const realtime = vi.hoisted(() => ({ client: null as unknown }));

vi.mock('@/contexts/ops-services', () => ({
  useBookingService: () => bookingService,
}));

vi.mock('@/lib/supabase/realtime-client', () => ({
  getRealtimeSupabaseClient: () => realtime.client,
}));

const restaurantId = '11111111-1111-4111-8111-111111111111';
const range = { startDate: '2026-07-01', endDate: '2026-07-31' };
const heatmap = { days: [{ date: '2026-07-11', total: 4 }] };

function client(): FakeRealtimeClient {
  return realtime.client as FakeRealtimeClient;
}

function setup(options: Parameters<typeof useOpsBookingHeatmap>[0]) {
  const queryClient = createTestQueryClient();
  const wrapper = createQueryWrapper(queryClient);
  return { queryClient, ...renderHook(() => useOpsBookingHeatmap(options), { wrapper }) };
}

describe('useOpsBookingHeatmap', () => {
  beforeEach(() => {
    realtime.client = createFakeRealtimeClient();
    bookingService.getBookingHeatmap.mockResolvedValue(heatmap);
  });

  it('@contract fetches the heatmap for a valid restaurant and range', async () => {
    const { result } = setup({ restaurantId, ...range });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(heatmap);
    expect(bookingService.getBookingHeatmap).toHaveBeenCalledWith({
      restaurantId,
      ...range,
    });
  });

  it('@contract rejects non-uuid restaurant ids by staying disabled', () => {
    setup({ restaurantId: 'not-a-uuid', ...range });

    expect(bookingService.getBookingHeatmap).not.toHaveBeenCalled();
    expect(client().channel).not.toHaveBeenCalled();
  });

  it('@contract stays disabled while either date bound is missing', () => {
    setup({ restaurantId, startDate: range.startDate, endDate: null });

    expect(bookingService.getBookingHeatmap).not.toHaveBeenCalled();
  });

  it('@contract stays disabled when explicitly disabled', () => {
    setup({ restaurantId, ...range, enabled: false });

    expect(bookingService.getBookingHeatmap).not.toHaveBeenCalled();
  });

  it('@contract @external-mock invalidates the heatmap when bookings change', async () => {
    const { result, queryClient } = setup({ restaurantId, ...range });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const channel = client().channels[0];
    expect(channel.name).toBe(`ops-heatmap:${restaurantId}:${range.startDate}:${range.endDate}`);

    const heatmapKey = queryKeys.opsDashboard.heatmap(restaurantId, range.startDate, range.endDate);
    const heatmapInvalidations = () =>
      invalidateSpy.mock.calls.filter(
        ([filters]) => JSON.stringify(filters?.queryKey) === JSON.stringify(heatmapKey),
      ).length;

    // A burst from another client is coalesced into one refetch.
    channel.emitPostgresChange('bookings', { new: { id: 'other-1', status: 'confirmed' } });
    channel.emitPostgresChange('bookings', { new: { id: 'other-2', status: 'confirmed' } });
    await waitFor(() => expect(heatmapInvalidations()).toBe(1));
    await new Promise((resolve) => setTimeout(resolve, SUMMARY_INVALIDATION_DEBOUNCE_MS + 50));
    expect(heatmapInvalidations()).toBe(1);
  });

  it('@contract skips the echo of this client’s own booking write', async () => {
    const { result, queryClient } = setup({ restaurantId, ...range });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    recordBookingWrite(queryClient, 'b1', { status: 'checked_in' });
    client().channels[0]!.emitPostgresChange('bookings', {
      new: { id: 'b1', status: 'checked_in' },
    });
    await new Promise((resolve) => setTimeout(resolve, SUMMARY_INVALIDATION_DEBOUNCE_MS + 50));

    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  it('@contract surfaces service errors', async () => {
    bookingService.getBookingHeatmap.mockRejectedValue(new Error('boom'));

    const { result } = setup({ restaurantId, ...range });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
