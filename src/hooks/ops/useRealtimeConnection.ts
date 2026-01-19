'use client';

import { useCallback, useState, useRef, useEffect } from 'react';

import { getRealtimeSupabaseClient } from '@/lib/supabase/realtime-client';

import type { RealtimeChannel } from '@supabase/supabase-js';

export type ConnectionStatus =
  | 'initializing'
  | 'connecting'
  | 'connected'
  | 'degraded'
  | 'disconnected'
  | 'error';

export interface RealtimeConnectionMetrics {
  messagesReceived: number;
  messagesPerSecond: number;
  reconnectAttempts: number;
  lastHeartbeat: Date | null;
  lastError: Error | null;
  uptimeSeconds: number;
  latencyMs: number;
}

export interface UseRealtimeConnectionOptions {
  enabled?: boolean;
}

export function useRealtimeConnection({ enabled = true }: UseRealtimeConnectionOptions = {}) {
  const [status, setStatus] = useState<ConnectionStatus>('initializing');
  const [metrics, setMetrics] = useState<RealtimeConnectionMetrics>({
    messagesReceived: 0,
    messagesPerSecond: 0,
    reconnectAttempts: 0,
    lastHeartbeat: null,
    lastError: null,
    uptimeSeconds: 0,
    latencyMs: 0,
  });

  const startTimeRef = useRef<number>(Date.now());
  const latencySamplesRef = useRef<number[]>([]);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusRef = useRef<ConnectionStatus>(status);
  statusRef.current = status;

  const updateMetrics = useCallback((updates: Partial<RealtimeConnectionMetrics>) => {
    setMetrics((prev) => ({
      ...prev,
      ...updates,
    }));
  }, []);

  const recordHeartbeat = useCallback(
    (latency?: number) => {
      const now = new Date();
      const startTime = startTimeRef.current as Date | number;
      if (typeof startTime === 'number') {
        updateMetrics({
          lastHeartbeat: now,
          uptimeSeconds: Math.floor((now.getTime() - startTime) / 1000),
        });
      }

      if (latency !== undefined) {
        latencySamplesRef.current.push(latency);
        if (latencySamplesRef.current.length > 100) {
          latencySamplesRef.current.shift();
        }
        const avgLatency =
          latencySamplesRef.current.reduce((a, b) => a + b, 0) / latencySamplesRef.current.length;
        updateMetrics({ latencyMs: Math.round(avgLatency) });
      }
    },
    [updateMetrics],
  );

  const recordMessage = useCallback(() => {
    setMetrics((prev) => {
      const elapsedSeconds = (Date.now() - startTimeRef.current) / 1000;
      const nextMessagesReceived = prev.messagesReceived + 1;
      const messagesPerSecond = elapsedSeconds > 0 ? nextMessagesReceived / elapsedSeconds : 0;

      return {
        ...prev,
        messagesReceived: nextMessagesReceived,
        messagesPerSecond: Math.round(messagesPerSecond * 10) / 10,
      };
    });
  }, []);

  const recordError = useCallback((error: Error, overrideStatus?: ConnectionStatus) => {
    setMetrics((prev) => ({
      ...prev,
      lastError: error,
      reconnectAttempts: prev.reconnectAttempts + 1,
    }));
    if (overrideStatus) {
      setStatus(overrideStatus);
    } else {
      setStatus('error');
    }
    console.error('Realtime connection error:', error);
  }, []);

  const monitorChannel = useCallback(
    (channel: RealtimeChannel) => {
      const currentTimeoutRef = reconnectTimeoutRef.current;

      channel.subscribe((subscriptionStatus, error) => {
        if (subscriptionStatus === 'SUBSCRIBED') {
          setStatus('connected');
          recordHeartbeat();
          return;
        }

        if (subscriptionStatus === 'TIMED_OUT') {
          recordError(new Error('Connection timeout - server did not respond in time'), 'degraded');
          return;
        }

        if (subscriptionStatus === 'CHANNEL_ERROR' || subscriptionStatus === 'CLOSED') {
          if (error) {
            recordError(new Error(error.message || 'Channel error'), 'disconnected');
          } else {
            setStatus('disconnected');
          }
          return;
        }

        if (subscriptionStatus === 'JOINING') {
          setStatus('connecting');
          return;
        }

        console.warn('Unknown subscription status:', subscriptionStatus);
      });

      channel.on('broadcast', { event: '*' }, () => {
        recordMessage();
        recordHeartbeat();
      });

      return () => {
        if (currentTimeoutRef) {
          clearTimeout(currentTimeoutRef);
        }
        channel.unsubscribe();
      };
    },
    [recordHeartbeat, recordMessage, recordError],
  );

  useEffect(() => {
    if (!enabled) {
      setStatus('initializing');
      return;
    }

    setStatus('connecting');

    const client = getRealtimeSupabaseClient();

    // Create a lightweight presence channel to monitor connection health
    const channel = client.channel('connection-health', {
      config: {
        broadcast: { self: false },
        presence: { key: '' },
      },
    });

    channel.subscribe((subscriptionStatus, error) => {
      if (subscriptionStatus === 'SUBSCRIBED') {
        setStatus('connected');
        recordHeartbeat();
        return;
      }

      if (subscriptionStatus === 'TIMED_OUT') {
        recordError(new Error('Connection timeout - server did not respond in time'), 'degraded');
        return;
      }

      if (subscriptionStatus === 'CHANNEL_ERROR' || subscriptionStatus === 'CLOSED') {
        if (error) {
          recordError(new Error(error.message || 'Channel error'), 'disconnected');
        } else {
          setStatus('disconnected');
        }
        return;
      }

      if (subscriptionStatus === 'JOINING') {
        setStatus('connecting');
        return;
      }
    });

    // Set up periodic heartbeat check
    const heartbeatInterval = setInterval(() => {
      if (statusRef.current === 'connected') {
        recordHeartbeat();
      }
    }, 30000);

    return () => {
      clearInterval(heartbeatInterval);
      client.removeChannel(channel);
      setStatus('initializing');
    };
  }, [enabled, recordHeartbeat, recordError]);

  return {
    status,
    metrics,
    monitorChannel,
    updateMetrics,
    recordHeartbeat,
    recordError,
  };
}
