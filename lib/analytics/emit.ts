'use client';

import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

const EVENT_ENDPOINT = '/api/events';
const STORAGE_KEY = 'srx.analytics.anonId';
const FLUSH_INTERVAL_MS = 5_000;
const MAX_BATCH_SIZE = 10;
const DEBUG_ENABLED = process.env.NODE_ENV !== 'production';
const APP_VERSION =
  process.env.NEXT_PUBLIC_APP_VERSION ??
  process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ??
  'web-dev';

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type AnalyticsEventProps = Record<string, JsonValue>;

export type AnalyticsUser = {
  anonId: string;
  emailHash: string | null;
};

export type AnalyticsContext = {
  route: string;
  version: string;
};

export type AnalyticsEventPayload = {
  name: string;
  ts: string;
  user: AnalyticsUser;
  context: AnalyticsContext;
  props: AnalyticsEventProps;
};

let queue: AnalyticsEventPayload[] = [];
let flushTimer: number | null = null;
let isFlushing = false;
let identityPromise: Promise<AnalyticsUser> | null = null;
let listenersBound = false;

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

function scheduleFlush(): void {
  if (!isBrowser()) return;
  if (flushTimer !== null || queue.length === 0) return;
  flushTimer = window.setTimeout(() => {
    flushTimer = null;
    void flushQueue('timer');
  }, FLUSH_INTERVAL_MS);
}

function clearFlushTimer(): void {
  if (flushTimer !== null) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
}

function getRoute(): string {
  if (!isBrowser()) return 'server';
  try {
    return window.location?.pathname ?? 'unknown';
  } catch (error) {
    if (DEBUG_ENABLED) {
      console.warn('[analytics] failed to read route', error);
    }
    return 'unknown';
  }
}

function getAnonId(): string {
  if (!isBrowser()) {
    return 'server-anon';
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return stored;
    }
    const generated = window.crypto?.randomUUID?.() ?? `anon-${Math.random().toString(36).slice(2, 12)}`;
    window.localStorage.setItem(STORAGE_KEY, generated);
    return generated;
  } catch (error) {
    if (DEBUG_ENABLED) {
      console.warn('[analytics] unable to access localStorage for anonId', error);
    }
    return window.crypto?.randomUUID?.() ?? `anon-${Math.random().toString(36).slice(2, 12)}`;
  }
}

async function hashEmail(email: string | null | undefined): Promise<string | null> {
  const normalized = email?.trim().toLowerCase();
  if (!normalized) return null;

  try {
    if (typeof window !== 'undefined' && !window.crypto?.subtle) {
      return null;
    }

    const encoder = new TextEncoder();
    const data = encoder.encode(normalized);
    const digest = await crypto.subtle.digest('SHA-256', data);
    const bytes = new Uint8Array(digest);
    return Array.from(bytes)
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  } catch (error) {
    if (DEBUG_ENABLED) {
      console.warn('[analytics] failed to hash email', error);
    }
    return null;
  }
}

async function resolveIdentity(): Promise<AnalyticsUser> {
  if (identityPromise) {
    return identityPromise;
  }

  identityPromise = (async () => {
    const anonId = getAnonId();
    try {
      const supabase = getSupabaseBrowserClient();
      const { data } = await supabase.auth.getUser();
      const email = data?.user?.email ?? null;
      const emailHash = await hashEmail(email);
      return { anonId, emailHash };
    } catch (error) {
      if (DEBUG_ENABLED) {
        console.warn('[analytics] failed to resolve identity', error);
      }
      return { anonId, emailHash: null };
    }
  })().catch((error) => {
    if (DEBUG_ENABLED) {
      console.warn('[analytics] identity promise rejected', error);
    }
    identityPromise = null;
    return { anonId: getAnonId(), emailHash: null as string | null };
  });

  return identityPromise;
}

function sanitizeProps(input: Record<string, unknown> | undefined): AnalyticsEventProps {
  const props: AnalyticsEventProps = {};
  if (!input) return props;

  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || typeof value === 'function' || typeof value === 'symbol') {
      continue;
    }
    if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      props[key] = value as JsonValue;
      continue;
    }
    if (Array.isArray(value)) {
      props[key] = value as JsonValue[];
      continue;
    }
    try {
      props[key] = JSON.parse(JSON.stringify(value));
    } catch {
      if (DEBUG_ENABLED) {
        console.warn('[analytics] dropping unserializable prop', key);
      }
    }
  }

  return props;
}

async function buildEvent(name: string, payload?: Record<string, unknown>): Promise<AnalyticsEventPayload> {
  const user = await resolveIdentity();
  const context: AnalyticsContext = {
    route: getRoute(),
    version: APP_VERSION,
  };

  return {
    name,
    ts: new Date().toISOString(),
    user,
    context,
    props: sanitizeProps(payload),
  };
}

async function dispatch(events: AnalyticsEventPayload[]): Promise<void> {
  if (!isBrowser() || events.length === 0) return;

  const body = JSON.stringify({ events });

  try {
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([body], { type: 'application/json' });
      const dispatched = navigator.sendBeacon(EVENT_ENDPOINT, blob);
      if (dispatched) {
        return;
      }
    }
  } catch (error) {
    if (DEBUG_ENABLED) {
      console.warn('[analytics] sendBeacon failed, falling back to fetch', error);
    }
  }

  await fetch(EVENT_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  });
}

async function flushQueue(trigger: 'timer' | 'visibility' | 'manual'): Promise<void> {
  if (isFlushing || queue.length === 0) {
    return;
  }

  isFlushing = true;
  clearFlushTimer();

  const batch = queue;
  queue = [];

  if (DEBUG_ENABLED) {
    // eslint-disable-next-line no-console
    console.debug('[analytics] flushing events', trigger, batch);
  }

  try {
    await dispatch(batch);
  } catch (error) {
    if (DEBUG_ENABLED) {
      console.warn('[analytics] failed to flush events', error);
    }
    queue = batch.concat(queue);
    scheduleFlush();
  } finally {
    isFlushing = false;
  }
}

function bindLifecycleListeners(): void {
  if (!isBrowser() || listenersBound) return;

  const handler = () => {
    void flushQueue('visibility');
  };

  window.addEventListener('visibilitychange', handler, { passive: true });
  window.addEventListener('pagehide', handler, { passive: true });
  window.addEventListener('beforeunload', handler, { passive: true });
  listenersBound = true;
}

export async function emit(eventName: string, payload?: Record<string, unknown>): Promise<void> {
  if (!isBrowser()) return;

  bindLifecycleListeners();

  try {
    const event = await buildEvent(eventName, payload);

    if (DEBUG_ENABLED) {
      // eslint-disable-next-line no-console
      console.debug('[analytics]', eventName, event.props);
    }

    queue.push(event);

    if (queue.length >= MAX_BATCH_SIZE) {
      clearFlushTimer();
      void flushQueue('manual');
    } else {
      scheduleFlush();
    }
  } catch (error) {
    if (DEBUG_ENABLED) {
      console.warn('[analytics] emit failed', eventName, error);
    }
  }
}

if (isBrowser()) {
  // Warm up identity resolution eagerly so the first emit has cached context.
  void resolveIdentity();
}

export async function flushPendingEvents(): Promise<void> {
  await flushQueue('manual');
}
