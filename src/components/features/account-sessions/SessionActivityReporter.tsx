'use client';

import { useEffect } from 'react';

import { useSupabaseSession } from '@/hooks/useSupabaseSession';
import { getAccountDeviceHeartbeat } from '@/lib/account/device-identity';
import { fetchJson } from '@/lib/http/fetchJson';

const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000;
let lastHeartbeatAt = 0;
let lastHeartbeatIdentity: string | null = null;
let heartbeatInFlight: Promise<void> | null = null;

function sendHeartbeat(identity: string, userId: string): Promise<void> {
  const now = Date.now();
  if (identity === lastHeartbeatIdentity && now - lastHeartbeatAt < HEARTBEAT_INTERVAL_MS) {
    return Promise.resolve();
  }
  if (heartbeatInFlight) return heartbeatInFlight;

  heartbeatInFlight = fetchJson<unknown>('/api/account/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(getAccountDeviceHeartbeat(userId)),
  })
    .then(() => {
      lastHeartbeatAt = Date.now();
      lastHeartbeatIdentity = identity;
    })
    .catch(() => {
      // Activity reporting must never interrupt the signed-in experience.
    })
    .finally(() => {
      heartbeatInFlight = null;
    });

  return heartbeatInFlight;
}

export function SessionActivityReporter() {
  const { status, session } = useSupabaseSession();
  const identity =
    status === 'authenticated' && session
      ? `${session.user.id}:${session.user.last_sign_in_at ?? session.expires_at}`
      : null;
  const userId = status === 'authenticated' && session ? session.user.id : null;

  useEffect(() => {
    if (!identity || !userId) return undefined;

    void sendHeartbeat(identity, userId);

    const reportIfVisible = () => {
      if (document.visibilityState === 'visible') {
        void sendHeartbeat(identity, userId);
      }
    };

    const intervalId = window.setInterval(reportIfVisible, HEARTBEAT_INTERVAL_MS);
    window.addEventListener('focus', reportIfVisible);
    document.addEventListener('visibilitychange', reportIfVisible);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', reportIfVisible);
      document.removeEventListener('visibilitychange', reportIfVisible);
    };
  }, [identity, userId]);

  return null;
}
