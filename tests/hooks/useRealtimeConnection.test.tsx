import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createFakeRealtimeChannel,
  createFakeRealtimeClient,
  type FakeRealtimeClient,
} from './__helpers__/realtime';

import { useRealtimeConnection } from '@src/hooks/ops/useRealtimeConnection';

import type { RealtimeChannel } from '@supabase/supabase-js';

const realtime = vi.hoisted(() => ({ client: null as unknown }));

vi.mock('@/lib/supabase/realtime-client', () => ({
  getRealtimeSupabaseClient: () => realtime.client,
}));

const NOW_ISO = '2026-07-11T12:00:00.000Z';

function client(): FakeRealtimeClient {
  return realtime.client as FakeRealtimeClient;
}

describe('useRealtimeConnection', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW_ISO));
    realtime.client = createFakeRealtimeClient();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('@contract stays initializing and opens no channel while disabled', () => {
    const { result } = renderHook(() => useRealtimeConnection({ enabled: false }));

    expect(result.current.status).toBe('initializing');
    expect(client().channel).not.toHaveBeenCalled();
  });

  it('@contract @external-mock moves to connecting then connected once subscribed', () => {
    const { result } = renderHook(() => useRealtimeConnection());

    expect(result.current.status).toBe('connecting');
    expect(client().channels[0].name).toBe('connection-health');

    act(() => client().channels[0].emitStatus('SUBSCRIBED'));

    expect(result.current.status).toBe('connected');
    expect(result.current.metrics.lastHeartbeat).toEqual(new Date(NOW_ISO));
  });

  it('@contract @external-mock degrades on timeout and counts the reconnect attempt', () => {
    const { result } = renderHook(() => useRealtimeConnection());

    act(() => client().channels[0].emitStatus('TIMED_OUT'));

    expect(result.current.status).toBe('degraded');
    expect(result.current.metrics.reconnectAttempts).toBe(1);
    expect(result.current.metrics.lastError?.message).toContain('Connection timeout');
  });

  it('@contract @external-mock disconnects on channel errors, recording the error when present', () => {
    const { result } = renderHook(() => useRealtimeConnection());

    act(() => client().channels[0].emitStatus('CHANNEL_ERROR', new Error('socket lost')));
    expect(result.current.status).toBe('disconnected');
    expect(result.current.metrics.lastError?.message).toBe('socket lost');

    act(() => client().channels[0].emitStatus('SUBSCRIBED'));
    expect(result.current.status).toBe('connected');

    act(() => client().channels[0].emitStatus('CLOSED'));
    expect(result.current.status).toBe('disconnected');
  });

  it('@contract @external-mock records heartbeats and uptime on the 30s interval while connected', () => {
    const { result } = renderHook(() => useRealtimeConnection());

    act(() => client().channels[0].emitStatus('SUBSCRIBED'));

    act(() => {
      vi.advanceTimersByTime(30_000);
    });

    expect(result.current.metrics.uptimeSeconds).toBe(30);
    expect(result.current.metrics.lastHeartbeat).toEqual(
      new Date('2026-07-11T12:00:30.000Z'),
    );
  });

  it('@contract monitorChannel tracks broadcast traffic in the message metrics', () => {
    const { result } = renderHook(() => useRealtimeConnection());
    const monitored = createFakeRealtimeChannel('monitored');

    let cleanup: (() => void) | undefined;
    act(() => {
      cleanup = result.current.monitorChannel(monitored as unknown as RealtimeChannel);
    });

    act(() => monitored.emitStatus('SUBSCRIBED'));
    expect(result.current.status).toBe('connected');

    act(() => {
      vi.advanceTimersByTime(10_000);
      monitored.emitBroadcast({ event: 'ping' });
    });

    expect(result.current.metrics.messagesReceived).toBe(1);
    expect(result.current.metrics.messagesPerSecond).toBeCloseTo(0.1, 5);

    cleanup?.();
    expect(monitored.unsubscribe).toHaveBeenCalled();
  });

  it('@contract @external-mock resets to initializing and removes the channel on unmount', () => {
    const { unmount } = renderHook(() => useRealtimeConnection());

    unmount();

    expect(client().removeChannel).toHaveBeenCalledWith(client().channels[0]);
  });
});
