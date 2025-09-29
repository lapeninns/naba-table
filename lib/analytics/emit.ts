'use client';

const EVENT_ENDPOINT = '/api/events';

export type AnalyticsEventPayload = Record<string, unknown> | undefined;

export async function emit(eventName: string, payload?: AnalyticsEventPayload): Promise<void> {
  if (typeof window === 'undefined') return;

  const body = JSON.stringify({
    name: eventName,
    ts: new Date().toISOString(),
    props: payload ?? {},
  });

  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.debug('[analytics]', eventName, payload ?? {});
  }

  if (typeof navigator !== 'undefined' && 'sendBeacon' in navigator) {
    const blob = new Blob([body], { type: 'application/json' });
    navigator.sendBeacon(EVENT_ENDPOINT, blob);
    return;
  }

  try {
    await fetch(EVENT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    });
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.warn('[analytics]', 'failed to emit event', eventName, error);
    }
  }
}
