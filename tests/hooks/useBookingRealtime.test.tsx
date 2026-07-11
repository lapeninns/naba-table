import { act, renderHook, waitFor } from '@testing-library/react';
import { createQueryWrapper, createTestQueryClient } from '@tests/utils/reactQuery';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createFakeRealtimeClient, type FakeRealtimeClient } from './__helpers__/realtime';

import { useBookingRealtime } from '@src/hooks/ops/useBookingRealtime';

import type { OpsTodayBookingsSummary } from '@/types/ops';

const stateMachine = vi.hoisted(() => ({
  value: null as {
    state: { entries: Record<string, unknown> };
    registerBookings: ReturnType<typeof vi.fn>;
    getEntry: ReturnType<typeof vi.fn>;
  } | null,
}));

const realtime = vi.hoisted(() => ({ client: null as unknown }));

vi.mock('@/contexts/booking-state-machine', () => ({
  useOptionalBookingStateMachine: () => stateMachine.value,
}));

vi.mock('@/lib/supabase/realtime-client', () => ({
  getRealtimeSupabaseClient: () => realtime.client,
}));

const restaurantId = 'rest-1';
const targetDate = '2026-07-11';

function makeSummary(status = 'confirmed'): OpsTodayBookingsSummary {
  return {
    restaurantId,
    date: targetDate,
    timezone: 'UTC',
    bookings: [
      {
        id: 'booking-1',
        status,
        partySize: 2,
        customerName: 'Guest One',
        checkedInAt: null,
        checkedOutAt: null,
      },
    ],
    totals: { total: 1 },
  } as unknown as OpsTodayBookingsSummary;
}

function client(): FakeRealtimeClient {
  return realtime.client as FakeRealtimeClient;
}

function setup(options: Partial<Parameters<typeof useBookingRealtime>[0]> = {}) {
  const queryClient = createTestQueryClient();
  const wrapper = createQueryWrapper(queryClient);
  const initialProps: Parameters<typeof useBookingRealtime>[0] = {
    restaurantId,
    targetDate,
    bookingIds: ['booking-1'],
    summary: makeSummary(),
    isSummaryFetching: false,
    enabled: true,
    ...options,
  };
  return {
    queryClient,
    ...renderHook((props: Parameters<typeof useBookingRealtime>[0]) => useBookingRealtime(props), {
      wrapper,
      initialProps,
    }),
  };
}

describe('useBookingRealtime', () => {
  beforeEach(() => {
    realtime.client = createFakeRealtimeClient();
    stateMachine.value = {
      state: { entries: {} },
      registerBookings: vi.fn(),
      getEntry: vi.fn(() => null),
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('@contract opens no channel while disabled or missing prerequisites', () => {
    setup({ enabled: false });
    expect(client().channel).not.toHaveBeenCalled();

    setup({ summary: null });
    expect(client().channel).not.toHaveBeenCalled();

    setup({ bookingIds: [] });
    expect(client().channel).not.toHaveBeenCalled();
  });

  it('@contract @external-mock subscribes to allocations and scoped table assignments', () => {
    setup();

    const channel = client().channels[0];
    expect(channel.name).toContain(`ops-allocations:${restaurantId}:${targetDate}`);
    expect(channel.handlers.map((handler) => handler.filter.table)).toEqual([
      'allocations',
      'booking_table_assignments',
    ]);
    expect(channel.handlers[1]?.filter.filter).toBe('booking_id=in.("booking-1")');
  });

  it('@contract @external-mock debounces allocation changes into summary and table invalidations', async () => {
    vi.useFakeTimers();
    const { queryClient } = setup();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    client().channels[0].emitPostgresChange('allocations');
    expect(invalidateSpy).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(150);
    });

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ refetchType: 'active' }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ exact: false }),
    );
  });

  it('@contract @external-mock retries with a fresh channel after a channel error', async () => {
    vi.useFakeTimers();
    setup();

    expect(client().channels).toHaveLength(1);

    act(() => client().channels[0].emitStatus('CHANNEL_ERROR'));
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(client().removeChannel).toHaveBeenCalled();
    expect(client().channels).toHaveLength(2);
    expect(client().channels[1].subscribe).toHaveBeenCalled();
  });

  it('@contract registers summary bookings with the booking state machine', () => {
    setup();

    expect(stateMachine.value?.registerBookings).toHaveBeenCalledWith([
      { id: 'booking-1', status: 'confirmed', updatedAt: null },
    ]);
  });

  it('@contract ignores summary bookings outside the tracked id set', () => {
    setup({ bookingIds: ['booking-other'] });

    expect(stateMachine.value?.registerBookings).not.toHaveBeenCalled();
  });

  it('@contract reflects summary fetching in the polling flag and exposes the summary date', () => {
    const { result, rerender } = setup();

    expect(result.current).toEqual({ isPolling: false, lastUpdatedAt: targetDate });

    rerender({
      restaurantId,
      targetDate,
      bookingIds: ['booking-1'],
      summary: makeSummary(),
      isSummaryFetching: true,
      enabled: true,
    });

    expect(result.current.isPolling).toBe(true);
  });

  it('@contract works without a booking state machine in context', () => {
    stateMachine.value = null;

    const { result } = setup();

    expect(result.current.lastUpdatedAt).toBe(targetDate);
  });
});
