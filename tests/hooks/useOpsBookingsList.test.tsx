import { act, renderHook, waitFor } from '@testing-library/react';
import { createQueryWrapper, createTestQueryClient } from '@tests/utils/reactQuery';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createFakeRealtimeClient, type FakeRealtimeClient } from './__helpers__/realtime';

import { useOpsBookingsList } from '@src/hooks/ops/useOpsBookingsList';

import type { OpsBookingsFilters, OpsBookingsPage } from '@/types/ops';

const bookingService = vi.hoisted(() => ({
  listBookings: vi.fn(),
}));

const realtime = vi.hoisted(() => ({ client: null as unknown }));

vi.mock('@/contexts/ops-services', () => ({
  useBookingService: () => bookingService,
}));

vi.mock('@/lib/supabase/realtime-client', () => ({
  getRealtimeSupabaseClient: () => realtime.client,
}));

function page(pageNumber: number, hasNext: boolean): OpsBookingsPage {
  return {
    items: [{ id: `booking-${pageNumber}`, status: 'confirmed' }],
    pageInfo: { page: pageNumber, pageSize: 50, total: 2, hasNext },
  } as unknown as OpsBookingsPage;
}

function client(): FakeRealtimeClient {
  return realtime.client as FakeRealtimeClient;
}

function setup(filters: OpsBookingsFilters | null) {
  const queryClient = createTestQueryClient();
  const wrapper = createQueryWrapper(queryClient);
  return { queryClient, ...renderHook(() => useOpsBookingsList(filters), { wrapper }) };
}

describe('useOpsBookingsList', () => {
  beforeEach(() => {
    realtime.client = createFakeRealtimeClient();
    bookingService.listBookings.mockImplementation(({ page: requested = 1 }) =>
      Promise.resolve(page(requested, requested < 2)),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('@contract stays disabled without filters and opens no channel', () => {
    setup(null);

    expect(bookingService.listBookings).not.toHaveBeenCalled();
    expect(client().channel).not.toHaveBeenCalled();
  });

  it('@contract fetches page one with the windowed count strategy and default page size', async () => {
    const { result } = setup({ restaurantId: 'rest-1' } as OpsBookingsFilters);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(bookingService.listBookings).toHaveBeenCalledWith(
      expect.objectContaining({
        restaurantId: 'rest-1',
        countStrategy: 'window',
        page: 1,
        pageSize: 50,
      }),
    );
    expect(result.current.data?.pages).toHaveLength(1);
  });

  it('@contract advances the cursor until the server reports no next page', async () => {
    const { result } = setup({ restaurantId: 'rest-1' } as OpsBookingsFilters);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.hasNextPage).toBe(true);

    await act(async () => {
      await result.current.fetchNextPage();
    });

    await waitFor(() => expect(result.current.data?.pages).toHaveLength(2));
    expect(bookingService.listBookings).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 2 }),
    );
    expect(result.current.hasNextPage).toBe(false);
  });

  it('@contract normalises filters into the query key (all-status dropped, dates ISO, query trimmed)', async () => {
    const { result, queryClient } = setup({
      restaurantId: 'rest-1',
      status: 'all',
      statuses: ['confirmed', 'pending'],
      from: new Date('2026-07-01T00:00:00.000Z'),
      to: 'not-a-real-date',
      query: '  fox  ',
      sortBy: 'start_at',
    } as unknown as OpsBookingsFilters);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const queryKey = queryClient.getQueryCache().getAll()[0]?.queryKey as unknown[];
    expect(queryKey.slice(0, 3)).toEqual(['ops', 'bookings', 'list']);
    expect(queryKey[3]).toEqual({
      restaurantId: 'rest-1',
      statuses: 'confirmed,pending',
      from: '2026-07-01T00:00:00.000Z',
      query: 'fox',
      sortBy: 'start_at',
    });
  });

  it('@contract @external-mock debounces realtime booking changes into a list invalidation', async () => {
    const { result, queryClient } = setup({ restaurantId: 'rest-1' } as OpsBookingsFilters);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const channel = client().channels[0];
    expect(channel.name).toBe('ops-bookings-list:rest-1');
    expect(channel.handlers[0]?.filter.table).toBe('bookings');

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    vi.useFakeTimers();

    channel.emitPostgresChange('bookings');
    channel.emitPostgresChange('bookings');
    expect(invalidateSpy).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(150);
    });

    expect(invalidateSpy).toHaveBeenCalledTimes(1);
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ exact: false, refetchType: 'active' }),
    );
  });

  it('@contract @external-mock tears the channel down on unmount', async () => {
    const { result, unmount } = setup({ restaurantId: 'rest-1' } as OpsBookingsFilters);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    unmount();

    expect(client().channels[0].unsubscribe).toHaveBeenCalled();
    expect(client().removeChannel).toHaveBeenCalled();
  });

  it('@contract surfaces service errors', async () => {
    bookingService.listBookings.mockRejectedValue(new Error('boom'));

    const { result } = setup({ restaurantId: 'rest-1' } as OpsBookingsFilters);

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
