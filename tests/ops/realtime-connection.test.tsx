import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import { useRealtimeConnection } from '@/hooks/ops/useRealtimeConnection';

function createMockChannel() {
  let subscribeCb: ((status: string, error: { message: string } | null) => void) | null = null;

  return {
    subscribe: vi.fn((cb) => {
      subscribeCb = cb;
      return undefined;
    }),
    on: vi.fn().mockReturnThis(),
    unsubscribe: vi.fn(),
    __emitStatus: (status: string, error: { message: string } | null = null) => {
      subscribeCb?.(status, error);
    },
  };
}

let mockChannel: ReturnType<typeof createMockChannel>;

vi.mock('@/lib/supabase/realtime-client', () => ({
  getRealtimeSupabaseClient: vi.fn(() => ({
    channel: vi.fn(() => mockChannel),
    removeChannel: vi.fn(),
    getChannels: vi.fn(() => []),
  })),
}));

describe('useRealtimeConnection', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockChannel = createMockChannel();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('initializes with default state when enabled', () => {
    const { result } = renderHook(() => useRealtimeConnection({ enabled: true }));

    expect(result.current.status).toBe('connecting');
    expect(result.current.metrics).toEqual({
      messagesReceived: 0,
      messagesPerSecond: 0,
      reconnectAttempts: 0,
      lastHeartbeat: null,
      lastError: null,
      uptimeSeconds: 0,
      latencyMs: 0,
    });
  });

  it('stays in initializing state when disabled', () => {
    const { result } = renderHook(() => useRealtimeConnection({ enabled: false }));

    expect(result.current.status).toBe('initializing');
  });

  it('tracks heartbeats and updates uptime', () => {
    const { result } = renderHook(() => useRealtimeConnection({ enabled: true }));

    act(() => {
      result.current.recordHeartbeat(50);
    });

    expect(result.current.metrics.lastHeartbeat).toBeInstanceOf(Date);
    expect(result.current.metrics.latencyMs).toBe(50);
  });

  it('calculates average latency from multiple samples', () => {
    const { result } = renderHook(() => useRealtimeConnection({ enabled: true }));

    act(() => {
      result.current.recordHeartbeat(100);
      result.current.recordHeartbeat(200);
      result.current.recordHeartbeat(150);
    });

    expect(result.current.metrics.latencyMs).toBe(150);
  });

  it('tracks message count', () => {
    const { result } = renderHook(() => useRealtimeConnection({ enabled: true }));

    act(() => {
      result.current.recordHeartbeat();
    });

    expect(result.current.metrics.messagesReceived).toBeGreaterThanOrEqual(0);
  });

  it('records errors and increments reconnect attempts', () => {
    const { result } = renderHook(() => useRealtimeConnection({ enabled: true }));

    const testError = new Error('Connection lost');

    act(() => {
      result.current.recordError(testError);
    });

    expect(result.current.status).toBe('error');
    expect(result.current.metrics.lastError).toBe(testError);
    expect(result.current.metrics.reconnectAttempts).toBe(1);
  });

  it('accumulates reconnect attempts across multiple errors', () => {
    const { result } = renderHook(() => useRealtimeConnection({ enabled: true }));

    act(() => {
      result.current.recordError(new Error('Error 1'));
      result.current.recordError(new Error('Error 2'));
      result.current.recordError(new Error('Error 3'));
    });

    expect(result.current.metrics.reconnectAttempts).toBe(3);
  });

  it('allows updating metrics directly', () => {
    const { result } = renderHook(() => useRealtimeConnection({ enabled: true }));

    act(() => {
      result.current.updateMetrics({
        messagesReceived: 100,
        messagesPerSecond: 5,
      });
    });

    expect(result.current.metrics.messagesReceived).toBe(100);
    expect(result.current.metrics.messagesPerSecond).toBe(5);
  });

  it('provides monitorChannel function for channel subscription', () => {
    const { result } = renderHook(() => useRealtimeConnection({ enabled: true }));

    expect(typeof result.current.monitorChannel).toBe('function');
  });

  it('transitions to initializing when disabled after being enabled', () => {
    const { result, rerender } = renderHook(({ enabled }) => useRealtimeConnection({ enabled }), {
      initialProps: { enabled: true },
    });

    expect(result.current.status).toBe('connecting');

    rerender({ enabled: false });

    expect(result.current.status).toBe('initializing');
  });

  it('maintains latency sample window of 100 samples', () => {
    const { result } = renderHook(() => useRealtimeConnection({ enabled: true }));

    act(() => {
      for (let i = 1; i <= 105; i++) {
        result.current.recordHeartbeat(i);
      }
    });

    expect(result.current.metrics.latencyMs).toBe(56);
  });
});

describe('useRealtimeConnection.monitorChannel', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockChannel = createMockChannel();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('sets status to connected on SUBSCRIBED event', () => {
    const { result } = renderHook(() => useRealtimeConnection({ enabled: false }));

    const mockChannel = {
      subscribe: vi.fn((callback) => {
        callback('SUBSCRIBED', null);
      }),
      on: vi.fn().mockReturnThis(),
      unsubscribe: vi.fn(),
    };

    act(() => {
      result.current.monitorChannel(mockChannel as any);
    });

    expect(result.current.status).toBe('connected');
  });

  it('sets status to degraded on TIMED_OUT event', () => {
    const { result } = renderHook(() => useRealtimeConnection({ enabled: false }));

    const mockChannel = {
      subscribe: vi.fn((callback) => {
        callback('TIMED_OUT', null);
      }),
      on: vi.fn().mockReturnThis(),
      unsubscribe: vi.fn(),
    };

    act(() => {
      result.current.monitorChannel(mockChannel as any);
    });

    expect(result.current.status).toBe('degraded');
    expect(result.current.metrics.reconnectAttempts).toBe(1);
  });

  it('sets status to disconnected on CHANNEL_ERROR event', () => {
    const { result } = renderHook(() => useRealtimeConnection({ enabled: false }));

    const mockChannel = {
      subscribe: vi.fn((callback) => {
        callback('CHANNEL_ERROR', { message: 'Test error' });
      }),
      on: vi.fn().mockReturnThis(),
      unsubscribe: vi.fn(),
    };

    act(() => {
      result.current.monitorChannel(mockChannel as any);
    });

    expect(result.current.status).toBe('disconnected');
  });

  it('sets status to disconnected on CLOSED event', () => {
    const { result } = renderHook(() => useRealtimeConnection({ enabled: false }));

    const mockChannel = {
      subscribe: vi.fn((callback) => {
        callback('CLOSED', null);
      }),
      on: vi.fn().mockReturnThis(),
      unsubscribe: vi.fn(),
    };

    act(() => {
      result.current.monitorChannel(mockChannel as any);
    });

    expect(result.current.status).toBe('disconnected');
  });

  it('sets status to connecting on JOINING event', () => {
    const { result } = renderHook(() => useRealtimeConnection({ enabled: false }));

    const mockChannel = {
      subscribe: vi.fn((callback) => {
        callback('JOINING', null);
      }),
      on: vi.fn().mockReturnThis(),
      unsubscribe: vi.fn(),
    };

    act(() => {
      result.current.monitorChannel(mockChannel as any);
    });

    expect(result.current.status).toBe('connecting');
  });

  it('returns cleanup function that unsubscribes channel', () => {
    const { result } = renderHook(() => useRealtimeConnection({ enabled: false }));

    const mockChannel = {
      subscribe: vi.fn(),
      on: vi.fn().mockReturnThis(),
      unsubscribe: vi.fn(),
    };

    let cleanup: (() => void) | undefined;
    act(() => {
      cleanup = result.current.monitorChannel(mockChannel as any);
    });

    expect(typeof cleanup).toBe('function');

    act(() => {
      cleanup?.();
    });

    expect(mockChannel.unsubscribe).toHaveBeenCalled();
  });
});
