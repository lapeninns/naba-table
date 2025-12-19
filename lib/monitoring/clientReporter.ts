'use client';

import { useEffect } from 'react';

import { useSupabaseSession } from '@/hooks/useSupabaseSession';

const send = (payload: Record<string, unknown>) => {
  try {
    void fetch('/api/client-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch {
    // ignore
  }
};

export function useClientErrorReporter() {
  const { user } = useSupabaseSession();

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      send({
        type: 'error',
        message: event.message,
        stack: event.error?.stack ?? null,
        path: window.location.pathname + window.location.search,
        userId: user?.id ?? null,
      });
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason as unknown;
      const message = typeof reason === 'string' ? reason : (reason as { message?: string })?.message;
      send({
        type: 'unhandledrejection',
        message: message ?? 'Unhandled rejection',
        stack: typeof reason === 'object' && reason && 'stack' in reason ? (reason as { stack?: string }).stack ?? null : null,
        path: window.location.pathname + window.location.search,
        userId: user?.id ?? null,
      });
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, [user?.id]);
}
