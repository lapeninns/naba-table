'use client';

import { useEffect, useState } from 'react';

import { isRealtimeFloorplanEnabled } from '@/lib/feature-flags/realtime';
import { getRealtimeSupabaseClient } from '@/lib/supabase/realtime-client';

export type RealtimeStatus = {
  enabled: boolean;
  connected: boolean;
  channels: number;
  lastEvent: Date | null;
  error: string | null;
};

export function useRealtimeDiagnostics() {
  const [status, setStatus] = useState<RealtimeStatus>({
    enabled: false,
    connected: false,
    channels: 0,
    lastEvent: null,
    error: null,
  });

  useEffect(() => {
    const enabled = isRealtimeFloorplanEnabled();

    if (!enabled) {
      setStatus({
        enabled: false,
        connected: false,
        channels: 0,
        lastEvent: null,
        error: 'Realtime is disabled (set NEXT_PUBLIC_FEATURE_REALTIME_FLOORPLAN=false)',
      });
      return;
    }

    try {
      const client = getRealtimeSupabaseClient();

      // Monitor connection status
      const checkConnection = () => {
        const channels = client.getChannels();
        const connected = channels.some((ch) => ch.state === 'joined');

        setStatus((prev) => ({
          ...prev,
          enabled: true,
          connected,
          channels: channels.length,
          error: null,
        }));
      };

      // Check immediately
      checkConnection();

      // Check every 2 seconds
      const interval = setInterval(checkConnection, 2000);

      return () => {
        clearInterval(interval);
      };
    } catch (error) {
      setStatus((prev) => ({
        ...prev,
        enabled: true,
        connected: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  }, []);

  return status;
}
