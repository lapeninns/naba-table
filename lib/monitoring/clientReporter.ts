'use client';

import { useEffect } from 'react';

import { useSupabaseSession } from '@/hooks/useSupabaseSession';
import { track } from '@/lib/analytics';
import { emit } from '@/lib/analytics/emit';

const send = (payload: Record<string, unknown>) => {
  try {
    void fetch('/api/client-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // ignore
  }
};

export function useClientErrorReporter() {
  const { user } = useSupabaseSession();

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      const path = window.location.pathname + window.location.search;
      send({
        type: 'error',
        message: event.message,
        stack: event.error?.stack ?? null,
        path,
        userId: user?.id ?? null,
      });
      track('client_error_reported', { type: 'error', path });
      emit('client_error_reported', { type: 'error', path });
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason as unknown;
      const message = typeof reason === 'string' ? reason : (reason as { message?: string })?.message;
      const path = window.location.pathname + window.location.search;
      send({
        type: 'unhandledrejection',
        message: message ?? 'Unhandled rejection',
        stack: typeof reason === 'object' && reason && 'stack' in reason ? (reason as { stack?: string }).stack ?? null : null,
        path,
        userId: user?.id ?? null,
      });
      track('client_error_reported', { type: 'unhandledrejection', path });
      emit('client_error_reported', { type: 'unhandledrejection', path });
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, [user?.id]);
}
