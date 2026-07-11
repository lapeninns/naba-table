import { act, renderHook, waitFor } from '@testing-library/react';
import { createQueryWrapper, createTestQueryClient } from '@tests/utils/reactQuery';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createFakeRealtimeClient, type FakeRealtimeClient } from './__helpers__/realtime';

import { useOpsDashboardData } from '@src/hooks/ops/useOpsDashboardData';

const bookingService = vi.hoisted(() => ({
  getTodaySummary: vi.fn(),
}));

const session = vi.hoisted(() => ({
  value: { user: null, session: null, status: 'authenticated' },
}));

const realtime = vi.hoisted(() => ({ client: null as unknown }));

vi.mock('@/contexts/ops-services', () => ({
  useBookingService: () => bookingService,
}));

vi.mock('@/hooks/useSupabaseSession', () => ({
  useSupabaseSession: () => session.value,
}));

vi.mock('@/lib/supabase/realtime-client', () => ({
  getRealtimeSupabaseClient: () => realtime.client,
}));

const restaurantId = '11111111-1111-4111-8111-111111111111';
const targetDate = '2026-07-11';

const summary = {
  restaurantId,
  date: targetDate,
  timezone: 'UTC',
  bookings: [
    {
      id: 'booking-1',
      status: 'confirmed',
      partySize: 2,
      customerName: 'Guest One',
      customerId: 'customer-1',
      checkedInAt: null,
      checkedOutAt: null,
    },
  ],
  totals: { total: 1 },
};

function client(): FakeRealtimeClient {
  return realtime.client as FakeRealtimeClient;
}

function setup(options: Parameters<typeof useOpsDashboardData>[0]) {
  const queryClient = createTestQueryClient();
  const wrapper = createQueryWrapper(queryClient);
  return { queryClient, ...renderHook(() => useOpsDashboardData(options), { wrapper }) };
}

describe('useOpsDashboardData', () => {
  beforeEach(() => {
    realtime.client = createFakeRealtimeClient();
    session.value = { user: null, session: null, status: 'authenticated' };
    bookingService.getTodaySummary.mockResolvedValue(summary);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('@contract rejects non-uuid restaurant ids by staying disabled', () => {
    setup({ restaurantId: 'not-a-uuid', targetDate });

    expect(bookingService.getTodaySummary).not.toHaveBeenCalled();
  });

  it('@contract waits for the session before fetching', () => {
    session.value = { user: null, session: null, status: 'loading' };

    const { result } = setup({ restaurantId, targetDate });

    expect(bookingService.getTodaySummary).not.toHaveBeenCalled();
    expect(result.current.realtimeEnabled).toBe(false);
    expect(result.current.isPolling).toBe(true);
  });

  it('@contract fetches and normalises the summary (meta defaults derived from the payload)', async () => {
    const bare = { ...summary, meta: undefined, bookings: undefined };
    bookingService.getTodaySummary.mockResolvedValue(bare);

    const { result } = setup({ restaurantId, targetDate });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(bookingService.getTodaySummary).toHaveBeenCalledWith({
      restaurantId,
      date: targetDate,
    });
    expect(result.current.data?.bookings).toEqual([]);
    expect(result.current.data?.meta).toEqual({
      date: targetDate,
      timezone: 'UTC',
      restaurantId,
    });
  });

  it('@contract @external-mock reports healthy realtime after a successful subscription', async () => {
    const { result } = setup({ restaurantId, targetDate });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    await waitFor(() => expect(client().channels.length).toBeGreaterThan(0));
    const channel = client().channels.at(-1)!;

    act(() => channel.emitStatus('SUBSCRIBED'));

    expect(result.current.realtimeHealthy).toBe(true);
    expect(result.current.isPolling).toBe(false);
  });

  it('@contract @external-mock falls back to polling when the channel errors', async () => {
    const { result } = setup({ restaurantId, targetDate });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    await waitFor(() => expect(client().channels.length).toBeGreaterThan(0));
    const channel = client().channels.at(-1)!;

    act(() => channel.emitStatus('CHANNEL_ERROR'));

    await waitFor(() => expect(result.current.realtimeHealthy).toBe(false));
    expect(result.current.isPolling).toBe(true);
  });

  it('@contract @external-mock debounces matching booking changes into a summary invalidation', async () => {
    const { result, queryClient } = setup({ restaurantId, targetDate });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await waitFor(() => expect(client().channels.length).toBeGreaterThan(0));

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    vi.useFakeTimers();

    const channel = client().channels.at(-1)!;
    // A payload without restaurant/date fields matches the current scope.
    channel.emitPostgresChange('bookings', { new: {}, old: {} });

    act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(invalidateSpy).toHaveBeenCalled();
  });

  it('@contract @external-mock ignores booking changes for other restaurants', async () => {
    const { result, queryClient } = setup({ restaurantId, targetDate });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await waitFor(() => expect(client().channels.length).toBeGreaterThan(0));

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    vi.useFakeTimers();

    const channel = client().channels.at(-1)!;
    channel.emitPostgresChange('bookings', {
      new: { restaurant_id: 'someone-else' },
      old: {},
    });

    act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  it('@contract surfaces service errors', async () => {
    bookingService.getTodaySummary.mockRejectedValue(new Error('boom'));

    const { result } = setup({ restaurantId, targetDate });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
