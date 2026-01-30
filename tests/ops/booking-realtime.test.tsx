import { QueryClient, QueryClientProvider, notifyManager } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';

async function waitForCondition(
  callback: () => void | Promise<void>,
  options: { timeout?: number; interval?: number } = {},
) {
  const { timeout = 5000, interval = 50 } = options;
  return vi.waitFor(
    async () => {
      await act(async () => {
        await callback();
      });
    },
    { timeout, interval },
  );
}

async function advanceTimers(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

async function invalidateQueries(queryClient: QueryClient) {
  await act(async () => {
    await queryClient.refetchQueries({ type: 'active' });
  });
}

async function invalidateAndAdvance(queryClient: QueryClient, ms: number) {
  await invalidateQueries(queryClient);
  await advanceTimers(ms);
}

const notifyManagerWrapper = (callback: () => void) => {
  act(() => {
    callback();
  });
};

const defaultNotifyManager = (callback: () => void) => {
  callback();
};

import { useBookingRealtime } from '@/hooks/ops/useBookingRealtime';

const mockGetTodaySummary = vi.fn();
const mockRegisterBookings = vi.fn();
const mockGetEntry = vi.fn();
const mockShowExternalUpdate = vi.fn();

vi.mock('@/contexts/ops-services', () => ({
  useBookingService: () => ({
    getTodaySummary: mockGetTodaySummary,
  }),
}));

vi.mock('@/contexts/booking-state-machine', () => ({
  useOptionalBookingStateMachine: () => ({
    state: { entries: {} },
    registerBookings: mockRegisterBookings,
    getEntry: mockGetEntry,
  }),
}));

vi.mock('@/components/features/booking-state-machine', () => ({
  useTransitionToast: () => ({
    showExternalUpdate: mockShowExternalUpdate,
  }),
}));

type SubscribeStatus = 'SUBSCRIBED' | 'TIMED_OUT' | 'CHANNEL_ERROR' | 'CLOSED' | 'JOINING';
type PostgresChangesPayload = { event: string; schema: string; table: string; filter: string };
type PostgresChangesCallback = (payload: unknown) => void;

vi.stubGlobal('window', {} as unknown);

function createMockChannel() {
  let subscribeCb: ((status: SubscribeStatus) => void) | null = null;
  const postgresHandlers: Array<{
    payload: PostgresChangesPayload;
    callback: PostgresChangesCallback;
  }> = [];

  return {
    on: vi.fn(
      (event: string, payload: PostgresChangesPayload, callback: PostgresChangesCallback) => {
        if (event === 'postgres_changes') {
          postgresHandlers.push({ payload, callback });
        }
        return {
          on: vi.fn().mockReturnThis(),
          subscribe: vi.fn(),
        };
      },
    ),
    subscribe: vi.fn((cb?: (status: SubscribeStatus) => void) => {
      subscribeCb = cb ?? null;
      return undefined;
    }),
    unsubscribe: vi.fn(),
    __emitStatus: (status: SubscribeStatus) => {
      subscribeCb?.(status);
    },
    __emitPostgresChange: (table: string, payload: unknown) => {
      for (const handler of postgresHandlers) {
        if (handler.payload.table === table) {
          handler.callback(payload);
        }
      }
    },
    __getPostgresHandlers: () => postgresHandlers,
  };
}

function createWrapper(queryClient?: QueryClient) {
  const client =
    queryClient ??
    new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
    });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe('useBookingRealtime', () => {
  let channel: ReturnType<typeof createMockChannel>;
  let originalEnv: string | undefined;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });

    channel = createMockChannel();
    originalEnv = process.env.NEXT_PUBLIC_FEATURE_REALTIME_FLOORPLAN;
    process.env.NEXT_PUBLIC_FEATURE_REALTIME_FLOORPLAN = 'true';

    notifyManager.setNotifyFunction(notifyManagerWrapper);

    const supabaseClientModule = await import('@/lib/supabase/realtime-client');
    const supabaseClient = supabaseClientModule.getRealtimeSupabaseClient() as {
      channel: MockInstance;
      removeChannel: MockInstance;
    };
    supabaseClient.channel.mockImplementation(() => channel);
    supabaseClient.removeChannel.mockImplementation(() => undefined);
  });

  afterEach(() => {
    notifyManager.setNotifyFunction(defaultNotifyManager);
    vi.useRealTimers();
    process.env.NEXT_PUBLIC_FEATURE_REALTIME_FLOORPLAN = originalEnv;
  });

  describe('initialization', () => {
    it('does not query when restaurantId is null', async () => {
      mockGetTodaySummary.mockResolvedValue({ date: '2026-01-18', bookings: [] });

      renderHook(
        () =>
          useBookingRealtime({
            restaurantId: null,
            targetDate: '2026-01-18',
            bookingIds: ['b-1'],
            enabled: true,
          }),
        { wrapper: createWrapper() },
      );

      await advanceTimers(100);
      expect(mockGetTodaySummary).not.toHaveBeenCalled();
    });

    it('does not query when bookingIds is empty', async () => {
      mockGetTodaySummary.mockResolvedValue({ date: '2026-01-18', bookings: [] });

      renderHook(
        () =>
          useBookingRealtime({
            restaurantId: 'r-1',
            targetDate: '2026-01-18',
            bookingIds: [],
            enabled: true,
          }),
        { wrapper: createWrapper() },
      );

      await advanceTimers(100);
      expect(mockGetTodaySummary).not.toHaveBeenCalled();
    });

    it('does not query when enabled is false', async () => {
      mockGetTodaySummary.mockResolvedValue({ date: '2026-01-18', bookings: [] });

      renderHook(
        () =>
          useBookingRealtime({
            restaurantId: 'r-1',
            targetDate: '2026-01-18',
            bookingIds: ['b-1'],
            enabled: false,
          }),
        { wrapper: createWrapper() },
      );

      await advanceTimers(100);
      expect(mockGetTodaySummary).not.toHaveBeenCalled();
    });

    it('queries when all conditions are met', async () => {
      mockGetTodaySummary.mockResolvedValue({ date: '2026-01-18', bookings: [] });

      renderHook(
        () =>
          useBookingRealtime({
            restaurantId: 'r-1',
            targetDate: '2026-01-18',
            bookingIds: ['b-1'],
            enabled: true,
          }),
        { wrapper: createWrapper() },
      );

      await advanceTimers(100);
      expect(mockGetTodaySummary).toHaveBeenCalledWith({
        restaurantId: 'r-1',
        date: '2026-01-18',
      });
    });
  });

  describe('realtime subscription', () => {
    it('subscribes to allocations table changes', async () => {
      mockGetTodaySummary.mockResolvedValue({ date: '2026-01-18', bookings: [] });

      renderHook(
        () =>
          useBookingRealtime({
            restaurantId: 'r-1',
            targetDate: '2026-01-18',
            bookingIds: ['b-1'],
            enabled: true,
          }),
        { wrapper: createWrapper() },
      );

      await advanceTimers(100);

      const handlers = channel.__getPostgresHandlers();
      const allocationsHandler = handlers.find((h) => h.payload.table === 'allocations');

      expect(allocationsHandler).toBeDefined();
      expect(allocationsHandler?.payload.filter).toBe('restaurant_id=eq.r-1');
    });

    it('subscribes to booking_table_assignments changes', async () => {
      mockGetTodaySummary.mockResolvedValue({ date: '2026-01-18', bookings: [] });

      renderHook(
        () =>
          useBookingRealtime({
            restaurantId: 'r-1',
            targetDate: '2026-01-18',
            bookingIds: ['b-1', 'b-2'],
            enabled: true,
          }),
        { wrapper: createWrapper() },
      );

      await advanceTimers(100);

      const handlers = channel.__getPostgresHandlers();
      const assignmentsHandler = handlers.find(
        (h) => h.payload.table === 'booking_table_assignments',
      );

      expect(assignmentsHandler).toBeDefined();
      expect(assignmentsHandler?.payload.filter).toContain('b-1');
      expect(assignmentsHandler?.payload.filter).toContain('b-2');
    });

    it('sets healthy status on SUBSCRIBED', async () => {
      mockGetTodaySummary.mockResolvedValue({ date: '2026-01-18', bookings: [] });

      const supabaseClientModule = await import('@/lib/supabase/realtime-client');
      const supabaseClient = supabaseClientModule.getRealtimeSupabaseClient() as {
        channel: MockInstance;
      };

      renderHook(
        () =>
          useBookingRealtime({
            restaurantId: 'r-1',
            targetDate: '2026-01-18',
            bookingIds: ['b-1'],
            enabled: true,
          }),
        { wrapper: createWrapper() },
      );

      act(() => {
        channel.__emitStatus('SUBSCRIBED');
      });

      expect(supabaseClient.channel).toHaveBeenCalled();
    });

    it('enables polling fallback when realtime subscription errors', async () => {
      mockGetTodaySummary.mockResolvedValue({ date: '2026-01-18', bookings: [] });

      const { unmount } = renderHook(
        () =>
          useBookingRealtime({
            restaurantId: 'r-1',
            targetDate: '2026-01-18',
            bookingIds: ['b-1'],
            enabled: true,
            intervalMs: 5000,
          }),
        { wrapper: createWrapper() },
      );

      act(() => {
        channel.__emitStatus('SUBSCRIBED');
      });

      act(() => {
        channel.__emitStatus('CHANNEL_ERROR');
      });

      const supabaseClientModule = await import('@/lib/supabase/realtime-client');
      const supabaseClient = supabaseClientModule.getRealtimeSupabaseClient() as {
        channel: MockInstance;
      };

      expect(supabaseClient.channel).toHaveBeenCalled();

      unmount();
    });

    it('retries connection on TIMED_OUT with exponential backoff', async () => {
      mockGetTodaySummary.mockResolvedValue({ date: '2026-01-18', bookings: [] });

      const supabaseClientModule = await import('@/lib/supabase/realtime-client');
      const supabaseClient = supabaseClientModule.getRealtimeSupabaseClient() as {
        channel: MockInstance;
        removeChannel: MockInstance;
      };

      renderHook(
        () =>
          useBookingRealtime({
            restaurantId: 'r-1',
            targetDate: '2026-01-18',
            bookingIds: ['b-1'],
            enabled: true,
          }),
        { wrapper: createWrapper() },
      );

      const initialChannelCalls = supabaseClient.channel.mock.calls.length;

      act(() => {
        channel.__emitStatus('TIMED_OUT');
      });

      await advanceTimers(1100);

      expect(supabaseClient.removeChannel).toHaveBeenCalled();
      expect(supabaseClient.channel.mock.calls.length).toBeGreaterThan(initialChannelCalls);
    });

    it('retries with increasing delay on consecutive failures', async () => {
      mockGetTodaySummary.mockResolvedValue({ date: '2026-01-18', bookings: [] });

      const supabaseClientModule = await import('@/lib/supabase/realtime-client');
      const supabaseClient = supabaseClientModule.getRealtimeSupabaseClient() as {
        channel: MockInstance;
        removeChannel: MockInstance;
      };

      const newChannel = createMockChannel();
      supabaseClient.channel
        .mockImplementationOnce(() => channel)
        .mockImplementation(() => newChannel);

      renderHook(
        () =>
          useBookingRealtime({
            restaurantId: 'r-1',
            targetDate: '2026-01-18',
            bookingIds: ['b-1'],
            enabled: true,
          }),
        { wrapper: createWrapper() },
      );

      act(() => {
        channel.__emitStatus('CHANNEL_ERROR');
      });

      await advanceTimers(1100);

      act(() => {
        newChannel.__emitStatus('CHANNEL_ERROR');
      });

      await advanceTimers(2100);

      await advanceTimers(0);

      expect(supabaseClient.removeChannel.mock.calls.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('booking status tracking', () => {
    it('registers bookings with state machine', async () => {
      mockGetTodaySummary.mockResolvedValue({
        date: '2026-01-18',
        bookings: [
          {
            id: 'b-1',
            status: 'confirmed',
            checkedInAt: null,
            checkedOutAt: null,
            customerName: 'John Doe',
          },
        ],
      });

      renderHook(
        () =>
          useBookingRealtime({
            restaurantId: 'r-1',
            targetDate: '2026-01-18',
            bookingIds: ['b-1'],
            enabled: true,
          }),
        { wrapper: createWrapper() },
      );

      await waitForCondition(() => {
        expect(mockRegisterBookings).toHaveBeenCalledWith([
          { id: 'b-1', status: 'confirmed', updatedAt: null },
        ]);
      });
    });

    it('filters out bookings not in bookingIds', async () => {
      mockGetTodaySummary.mockResolvedValue({
        date: '2026-01-18',
        bookings: [
          {
            id: 'b-1',
            status: 'confirmed',
            checkedInAt: null,
            checkedOutAt: null,
            customerName: 'John',
          },
          {
            id: 'b-2',
            status: 'seated',
            checkedInAt: '2026-01-18T12:00:00Z',
            checkedOutAt: null,
            customerName: 'Jane',
          },
          {
            id: 'b-3',
            status: 'completed',
            checkedInAt: null,
            checkedOutAt: null,
            customerName: 'Bob',
          },
        ],
      });

      renderHook(
        () =>
          useBookingRealtime({
            restaurantId: 'r-1',
            targetDate: '2026-01-18',
            bookingIds: ['b-1', 'b-2'],
            enabled: true,
          }),
        { wrapper: createWrapper() },
      );

      await waitForCondition(() => {
        expect(mockRegisterBookings).toHaveBeenCalled();
        const registeredBookings = mockRegisterBookings.mock.calls[0][0];
        expect(registeredBookings.map((b: { id: string }) => b.id)).not.toContain('b-3');
      });
    });

    it('deduplicates and sorts booking IDs', async () => {
      mockGetTodaySummary.mockResolvedValue({
        date: '2026-01-18',
        bookings: [
          {
            id: 'b-1',
            status: 'confirmed',
            checkedInAt: null,
            checkedOutAt: null,
            customerName: 'John',
          },
          {
            id: 'b-2',
            status: 'seated',
            checkedInAt: null,
            checkedOutAt: null,
            customerName: 'Jane',
          },
        ],
      });

      renderHook(
        () =>
          useBookingRealtime({
            restaurantId: 'r-1',
            targetDate: '2026-01-18',
            bookingIds: ['b-2', 'b-1', 'b-2', 'b-1'],
            enabled: true,
          }),
        { wrapper: createWrapper() },
      );

      await advanceTimers(100);

      expect(mockGetTodaySummary).toHaveBeenCalledTimes(1);
    });
  });

  describe('toast notifications', () => {
    it('shows toast when booking status changes externally', async () => {
      const visibleBookingIds = ['b-1'];
      mockGetTodaySummary
        .mockResolvedValueOnce({
          date: '2026-01-18',
          bookings: [
            {
              id: 'b-1',
              status: 'confirmed',
              checkedInAt: null,
              checkedOutAt: null,
              customerName: 'John Doe',
            },
          ],
        })
        .mockResolvedValueOnce({
          date: '2026-01-18',
          bookings: [
            {
              id: 'b-1',
              status: 'seated',
              checkedInAt: '2026-01-18T12:00:00Z',
              checkedOutAt: null,
              customerName: 'John Doe',
            },
          ],
        });

      mockGetEntry.mockReturnValue(null);

      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
      });

      renderHook(
        () =>
          useBookingRealtime({
            restaurantId: 'r-1',
            targetDate: '2026-01-18',
            bookingIds: ['b-1'],
            visibleBookingIds: ['b-1'],
            enabled: true,
            intervalMs: 1000,
          }),
        { wrapper: createWrapper(queryClient) },
      );

      await advanceTimers(100);
      await waitForCondition(() => {
        expect(mockRegisterBookings).toHaveBeenCalled();
      });

      await invalidateQueries(queryClient);

      await waitForCondition(
        () => {
          expect(mockShowExternalUpdate).toHaveBeenCalledWith({
            bookingLabel: 'John Doe',
            fromStatus: 'confirmed',
            toStatus: 'seated',
          });
        },
        { timeout: 5000 },
      );
    });

    it('does not show toast for non-visible bookings', async () => {
      const visibleBookingIds: string[] = [];

      mockGetTodaySummary
        .mockResolvedValueOnce({
          date: '2026-01-18',
          bookings: [
            {
              id: 'b-1',
              status: 'confirmed',
              checkedInAt: null,
              checkedOutAt: null,
              customerName: 'John',
            },
          ],
        })
        .mockResolvedValueOnce({
          date: '2026-01-18',
          bookings: [
            {
              id: 'b-1',
              status: 'seated',
              checkedInAt: '2026-01-18T12:00:00Z',
              checkedOutAt: null,
              customerName: 'John',
            },
          ],
        });

      mockGetEntry.mockReturnValue(null);

      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
      });

      renderHook(
        () =>
          useBookingRealtime({
            restaurantId: 'r-1',
            targetDate: '2026-01-18',
            bookingIds: ['b-1'],
            visibleBookingIds,
            enabled: true,
            intervalMs: 1000,
          }),
        { wrapper: createWrapper(queryClient) },
      );

      await advanceTimers(100);
      await waitForCondition(() => {
        expect(mockRegisterBookings).toHaveBeenCalled();
      });

      await invalidateAndAdvance(queryClient, 500);

      expect(mockShowExternalUpdate).not.toHaveBeenCalled();
    });

    it('does not show duplicate toasts within 10 seconds', async () => {
      const visibleBookingIds = ['b-1'];
      mockGetTodaySummary
        .mockResolvedValueOnce({
          date: '2026-01-18',
          bookings: [
            {
              id: 'b-1',
              status: 'confirmed',
              checkedInAt: null,
              checkedOutAt: null,
              customerName: 'John',
            },
          ],
        })
        .mockResolvedValue({
          date: '2026-01-18',
          bookings: [
            {
              id: 'b-1',
              status: 'seated',
              checkedInAt: '2026-01-18T12:00:00Z',
              checkedOutAt: null,
              customerName: 'John',
            },
          ],
        });

      mockGetEntry.mockReturnValue(null);

      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
      });

      renderHook(
        () =>
          useBookingRealtime({
            restaurantId: 'r-1',
            targetDate: '2026-01-18',
            bookingIds: ['b-1'],
            visibleBookingIds: ['b-1'],
            enabled: true,
            intervalMs: 1000,
          }),
        { wrapper: createWrapper(queryClient) },
      );

      await advanceTimers(100);
      await waitForCondition(() => {
        expect(mockRegisterBookings).toHaveBeenCalled();
      });

      await invalidateQueries(queryClient);

      await advanceTimers(200);

      await waitForCondition(() => {
        expect(mockShowExternalUpdate).toHaveBeenCalledTimes(1);
      });

      await invalidateAndAdvance(queryClient, 500);

      expect(mockShowExternalUpdate).toHaveBeenCalledTimes(1);
    });
  });

  describe('return values', () => {
    it('returns lastUpdatedAt from query data', async () => {
      mockGetTodaySummary.mockResolvedValue({
        date: '2026-01-18',
        bookings: [],
      });

      const { result } = renderHook(
        () =>
          useBookingRealtime({
            restaurantId: 'r-1',
            targetDate: '2026-01-18',
            bookingIds: ['b-1'],
            enabled: true,
          }),
        { wrapper: createWrapper() },
      );

      await waitForCondition(() => {
        expect(result.current.lastUpdatedAt).toBe('2026-01-18');
      });
    });

    it('returns null lastUpdatedAt when no data', async () => {
      mockGetTodaySummary.mockResolvedValue(null);

      const { result } = renderHook(
        () =>
          useBookingRealtime({
            restaurantId: 'r-1',
            targetDate: '2026-01-18',
            bookingIds: ['b-1'],
            enabled: true,
          }),
        { wrapper: createWrapper() },
      );

      await waitForCondition(() => {
        expect(result.current.lastUpdatedAt).toBeNull();
      });
    });
  });

  describe('cleanup', () => {
    it('removes channel on unmount', async () => {
      mockGetTodaySummary.mockResolvedValue({ date: '2026-01-18', bookings: [] });

      const supabaseClientModule = await import('@/lib/supabase/realtime-client');
      const supabaseClient = supabaseClientModule.getRealtimeSupabaseClient() as {
        removeChannel: MockInstance;
      };

      const { unmount } = renderHook(
        () =>
          useBookingRealtime({
            restaurantId: 'r-1',
            targetDate: '2026-01-18',
            bookingIds: ['b-1'],
            enabled: true,
          }),
        { wrapper: createWrapper() },
      );

      await advanceTimers(100);

      unmount();

      expect(supabaseClient.removeChannel).toHaveBeenCalled();
    });

    it('clears retry timeout on unmount', async () => {
      mockGetTodaySummary.mockResolvedValue({ date: '2026-01-18', bookings: [] });

      const supabaseClientModule = await import('@/lib/supabase/realtime-client');
      const supabaseClient = supabaseClientModule.getRealtimeSupabaseClient() as {
        channel: MockInstance;
        removeChannel: MockInstance;
      };

      const { unmount } = renderHook(
        () =>
          useBookingRealtime({
            restaurantId: 'r-1',
            targetDate: '2026-01-18',
            bookingIds: ['b-1'],
            enabled: true,
          }),
        { wrapper: createWrapper() },
      );

      act(() => {
        channel.__emitStatus('TIMED_OUT');
      });

      unmount();

      const channelCallsBeforeTimer = supabaseClient.channel.mock.calls.length;

      await advanceTimers(15000);

      expect(supabaseClient.channel.mock.calls.length).toBe(channelCallsBeforeTimer);
    });
  });

  describe('edge cases', () => {
    it('handles rapid consecutive status changes with single toast after debounce', async () => {
      mockGetTodaySummary
        .mockResolvedValueOnce({
          date: '2026-01-18',
          bookings: [
            {
              id: 'b-1',
              status: 'confirmed',
              checkedInAt: null,
              checkedOutAt: null,
              customerName: 'John',
            },
          ],
        })
        .mockResolvedValueOnce({
          date: '2026-01-18',
          bookings: [
            {
              id: 'b-1',
              status: 'seated',
              checkedInAt: '2026-01-18T12:00:00Z',
              checkedOutAt: null,
              customerName: 'John',
            },
          ],
        })
        .mockResolvedValueOnce({
          date: '2026-01-18',
          bookings: [
            {
              id: 'b-1',
              status: 'completed',
              checkedInAt: '2026-01-18T12:00:00Z',
              checkedOutAt: '2026-01-18T13:00:00Z',
              customerName: 'John',
            },
          ],
        });

      mockGetEntry.mockReturnValue(null);

      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
      });

      renderHook(
        () =>
          useBookingRealtime({
            restaurantId: 'r-1',
            targetDate: '2026-01-18',
            bookingIds: ['b-1'],
            visibleBookingIds: ['b-1'],
            enabled: true,
            intervalMs: 1000,
          }),
        { wrapper: createWrapper(queryClient) },
      );

      await advanceTimers(100);
      await waitForCondition(() => {
        expect(mockRegisterBookings).toHaveBeenCalled();
      });

      await invalidateQueries(queryClient);

      await waitForCondition(() => {
        expect(mockShowExternalUpdate).toHaveBeenCalledTimes(1);
      });

      await advanceTimers(11000);

      await invalidateQueries(queryClient);

      await waitForCondition(() => {
        expect(mockShowExternalUpdate).toHaveBeenCalledTimes(2);
      });
    });

    it('skips toast when optimistic update matches server status', async () => {
      mockGetTodaySummary
        .mockResolvedValueOnce({
          date: '2026-01-18',
          bookings: [
            {
              id: 'b-1',
              status: 'confirmed',
              checkedInAt: null,
              checkedOutAt: null,
              customerName: 'John',
            },
          ],
        })
        .mockResolvedValueOnce({
          date: '2026-01-18',
          bookings: [
            {
              id: 'b-1',
              status: 'seated',
              checkedInAt: '2026-01-18T12:00:00Z',
              checkedOutAt: null,
              customerName: 'John',
            },
          ],
        });

      mockGetEntry.mockReturnValue({
        id: 'b-1',
        status: 'confirmed',
        optimistic: {
          targetStatus: 'seated',
          startedAt: Date.now(),
        },
      });

      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
      });

      renderHook(
        () =>
          useBookingRealtime({
            restaurantId: 'r-1',
            targetDate: '2026-01-18',
            bookingIds: ['b-1'],
            visibleBookingIds: ['b-1'],
            enabled: true,
            intervalMs: 1000,
          }),
        { wrapper: createWrapper(queryClient) },
      );

      await advanceTimers(100);
      await waitForCondition(() => {
        expect(mockRegisterBookings).toHaveBeenCalled();
      });

      await invalidateAndAdvance(queryClient, 500);

      expect(mockShowExternalUpdate).not.toHaveBeenCalled();
    });

    it('cleans up stale booking IDs when bookingIds array changes', async () => {
      const visibleBookingIds = ['b-1'];
      mockGetTodaySummary.mockResolvedValue({
        date: '2026-01-18',
        bookings: [
          {
            id: 'b-1',
            status: 'confirmed',
            checkedInAt: null,
            checkedOutAt: null,
            customerName: 'John',
          },
          {
            id: 'b-2',
            status: 'seated',
            checkedInAt: '2026-01-18T12:00:00Z',
            checkedOutAt: null,
            customerName: 'Jane',
          },
        ],
      });

      mockGetEntry.mockReturnValue(null);

      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
      });

      const { rerender } = renderHook(
        ({ bookingIds }: { bookingIds: string[] }) =>
          useBookingRealtime({
            restaurantId: 'r-1',
            targetDate: '2026-01-18',
            bookingIds: ['b-1'],
            visibleBookingIds,
            enabled: true,
            intervalMs: 1000,
          }),
        {
          wrapper: createWrapper(queryClient),
          initialProps: { bookingIds: ['b-1', 'b-2'] },
        },
      );

      await advanceTimers(100);
      await waitForCondition(() => {
        expect(mockRegisterBookings).toHaveBeenCalled();
      });

      rerender({ bookingIds: ['b-1'] });

      await advanceTimers(100);

      mockGetTodaySummary.mockResolvedValue({
        date: '2026-01-18',
        bookings: [
          {
            id: 'b-1',
            status: 'confirmed',
            checkedInAt: null,
            checkedOutAt: null,
            customerName: 'John',
          },
          {
            id: 'b-2',
            status: 'completed',
            checkedInAt: '2026-01-18T12:00:00Z',
            checkedOutAt: '2026-01-18T13:00:00Z',
            customerName: 'Jane',
          },
        ],
      });

      await invalidateAndAdvance(queryClient, 500);

      expect(mockShowExternalUpdate).not.toHaveBeenCalled();
    });
  });

  describe('feature flag disabled', () => {
    it('does not subscribe to realtime when feature flag is false', async () => {
      process.env.NEXT_PUBLIC_FEATURE_REALTIME_FLOORPLAN = 'false';

      mockGetTodaySummary.mockResolvedValue({ date: '2026-01-18', bookings: [] });

      const supabaseClientModule = await import('@/lib/supabase/realtime-client');
      const supabaseClient = supabaseClientModule.getRealtimeSupabaseClient() as {
        channel: MockInstance;
      };

      const channelCallsBefore = supabaseClient.channel.mock.calls.length;

      renderHook(
        () =>
          useBookingRealtime({
            restaurantId: 'r-1',
            targetDate: '2026-01-18',
            bookingIds: ['b-1'],
            enabled: true,
          }),
        { wrapper: createWrapper() },
      );

      await advanceTimers(100);

      expect(supabaseClient.channel.mock.calls.length).toBe(channelCallsBefore);
    });
  });
});
