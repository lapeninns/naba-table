'use client';

import { usePathname } from 'next/navigation';
import { PostHogProvider as PHProvider, usePostHog } from 'posthog-js/react';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

import { useSupabaseSession } from '@/hooks/useSupabaseSession';
import { clientEnv } from '@/lib/env-client';
import {
  filterPosthogEventBeforeSend,
  matchPosthogExceptionSuppression,
} from '@/lib/posthog/error-filter';

import type { PostHog } from 'posthog-js';

type PosthogQueuedEvent = { event: string; payload: Record<string, unknown> };
type PosthogCaptureClient = {
  capture: (event: string, payload: Record<string, unknown>) => void;
};
type PosthogWindow = Window & {
  posthog?: PosthogCaptureClient;
  __posthogQueue?: PosthogQueuedEvent[];
};

const noop = () => undefined;
const noopCaptureClient: PosthogCaptureClient = { capture: noop };
const SENSITIVE_ANALYTICS_PATH = /(?:^|\/)(?:google-business-profile|dual-sync|gbp)(?:\/|$)/i;
const PRIVATE_OR_MULTI_LABEL_PUBLIC_SUFFIXES = new Set([
  'co.uk',
  'org.uk',
  'gov.uk',
  'ac.uk',
  'com.au',
  'net.au',
  'org.au',
  'co.nz',
  'github.io',
  'pages.dev',
  'vercel.app',
  'netlify.app',
  'herokuapp.com',
]);
const COUNTRY_CODE_SECOND_LEVEL_LABELS = new Set([
  'ac',
  'co',
  'com',
  'edu',
  'gov',
  'mil',
  'net',
  'org',
]);

export function isSensitiveAnalyticsPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  const normalized = pathname.split(/[?#]/, 1)[0]?.replace(/\/+$/, '') || '/';
  return SENSITIVE_ANALYTICS_PATH.test(normalized);
}

export function getPosthogCookieExpiryDomains(hostname: string): Array<string | null> {
  const normalized = hostname.trim().toLowerCase().replace(/\.$/, '');
  if (
    normalized.length === 0 ||
    normalized === 'localhost' ||
    normalized.includes(':') ||
    /^\d+(?:\.\d+){3}$/.test(normalized)
  ) {
    return [null];
  }

  const labels = normalized.split('.');
  if (labels.length < 2 || labels.some((label) => !/^[a-z0-9-]+$/.test(label))) return [null];

  const lastTwoLabels = labels.slice(-2).join('.');
  const usesMultiLabelPublicSuffix =
    PRIVATE_OR_MULTI_LABEL_PUBLIC_SUFFIXES.has(lastTwoLabels) ||
    (labels.at(-1)?.length === 2 && COUNTRY_CODE_SECOND_LEVEL_LABELS.has(labels.at(-2) ?? ''));
  const publicSuffixLabelCount = usesMultiLabelPublicSuffix ? 2 : 1;
  const registrableDomainStart = labels.length - publicSuffixLabelCount - 1;
  if (registrableDomainStart < 0) return [null];

  const domains: Array<string | null> = [null];
  for (let index = 0; index <= registrableDomainStart; index += 1) {
    domains.push(labels.slice(index).join('.'));
  }
  return domains;
}

function eventReferencesSensitivePath(event: unknown): boolean {
  if (!event || typeof event !== 'object') return false;
  const properties = (event as { properties?: unknown }).properties;
  if (!properties || typeof properties !== 'object' || Array.isArray(properties)) return false;
  return ['$current_url', '$pathname'].some((key) => {
    const value = (properties as Record<string, unknown>)[key];
    if (typeof value !== 'string') return false;
    try {
      return isSensitiveAnalyticsPath(new URL(value, window.location.origin).pathname);
    } catch {
      return isSensitiveAnalyticsPath(value);
    }
  });
}

function clearStorage(storage: Storage): void {
  try {
    const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index)).filter(
      (key): key is string => Boolean(key),
    );
    for (const key of keys) {
      if (key.startsWith('ph_') && key.includes('posthog')) storage.removeItem(key);
    }
  } catch {
    return;
  }
}

function clearPosthogStorage(): void {
  if (typeof window === 'undefined') return;
  clearStorage(window.localStorage);
  clearStorage(window.sessionStorage);
  for (const cookie of document.cookie.split(';')) {
    const name = cookie.split('=', 1)[0]?.trim();
    if (name?.startsWith('ph_') && name.includes('posthog')) {
      for (const domain of getPosthogCookieExpiryDomains(window.location.hostname)) {
        const domainAttribute = domain ? `; Domain=${domain}` : '';
        document.cookie = `${name}=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/${domainAttribute}; SameSite=Lax`;
      }
    }
  }
}

function suppressPosthogOnSensitivePath(client?: PostHog): void {
  if (client) {
    client.stopSessionRecording();
    client.set_config({
      autocapture: false,
      capture_pageleave: false,
      disable_session_recording: true,
      persistence: 'memory',
    });
    client.reset();
    client.opt_out_capturing();
  }
  clearPosthogStorage();
  if (typeof window !== 'undefined') {
    const win = window as PosthogWindow;
    win.posthog = noopCaptureClient;
    win.__posthogQueue = [];
  }
}

function restorePosthogOutsideSensitivePath(client: PostHog): void {
  client.set_config({
    autocapture: true,
    capture_pageleave: true,
    disable_session_recording: false,
    cross_subdomain_cookie: false,
    persistence: 'localStorage+cookie',
  });
  client.opt_in_capturing();
  if (typeof window !== 'undefined') {
    const win = window as PosthogWindow;
    win.__posthogQueue = [];
    win.posthog = client;
  }
}

const createNoopPostHog = (): PostHog =>
  ({
    __loaded: false,
    config: {},
    identify: noop,
    reset: noop,
    capture: noop,
    set_config: noop,
  }) as unknown as PostHog;

const flushPosthogQueue = (client: PosthogCaptureClient) => {
  if (typeof window === 'undefined') return;
  const win = window as PosthogWindow;
  if (!win.__posthogQueue || win.__posthogQueue.length === 0) return;
  const batch = win.__posthogQueue.splice(0, win.__posthogQueue.length);
  batch.forEach(({ event, payload }) => {
    client.capture(event, payload);
  });
};

/**
 * PostHog analytics provider for client-side tracking.
 * Wraps the application to enable PostHog features like:
 * - Automatic pageview tracking
 * - Session recording
 * - Event capturing
 */
export function PostHogProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const sensitivePath = isSensitiveAnalyticsPath(pathname);
  const [client, setClient] = useState<PostHog | null>(null);
  const noopClientRef = useRef<PostHog>(createNoopPostHog());
  const loadedClientRef = useRef<PostHog | null>(null);

  useLayoutEffect(() => {
    if (!sensitivePath) return;
    suppressPosthogOnSensitivePath(loadedClientRef.current ?? undefined);
    if (loadedClientRef.current) setClient(null);
  }, [sensitivePath]);

  useEffect(() => {
    const { key, host, enabled } = clientEnv.posthog;

    if (sensitivePath) {
      return;
    }

    if (loadedClientRef.current) {
      restorePosthogOutsideSensitivePath(loadedClientRef.current);
      setClient(loadedClientRef.current);
      return;
    }

    if (
      !enabled ||
      typeof key !== 'string' ||
      key.length === 0 ||
      typeof host !== 'string' ||
      host.length === 0
    ) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(
          '[PostHog] Missing NEXT_PUBLIC_POSTHOG_KEY or NEXT_PUBLIC_POSTHOG_HOST environment variables',
        );
      }
      return;
    }
    const posthogKey = key;
    const posthogHost = host;

    let didCancel = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let idleId: number | null = null;

    const initPosthog = async () => {
      if (didCancel) return;
      const { default: posthog } = await import('posthog-js');
      if (didCancel) return;
      posthog.init(posthogKey, {
        api_host: posthogHost,
        person_profiles: 'identified_only',
        capture_pageview: false, // We capture pageviews manually via instrumentation-client.ts
        capture_pageleave: true,
        autocapture: true,
        disable_session_recording: false,
        cross_subdomain_cookie: false,
        // Explicit true overrides the remote $exception_capture_enabled_server_side
        // flag, so unhandled errors/rejections always produce native $exception
        // events (still filtered through before_send below).
        capture_exceptions: true,
        persistence: 'localStorage+cookie',
        before_send: (event) => {
          if (
            typeof window !== 'undefined' &&
            (isSensitiveAnalyticsPath(window.location.pathname) ||
              eventReferencesSensitivePath(event))
          ) {
            return null;
          }
          const suppressionMatch = matchPosthogExceptionSuppression(event);
          if (suppressionMatch && process.env.NODE_ENV === 'development') {
            console.info('[PostHog] Suppressed noisy exception', {
              key: suppressionMatch.key,
              message: suppressionMatch.message,
            });
          }
          return filterPosthogEventBeforeSend(event);
        },
        loaded: (posthog) => {
          if (process.env.NODE_ENV === 'development') {
            posthog.debug();
          }
        },
      });
      if (typeof window !== 'undefined') {
        (window as PosthogWindow).posthog = posthog;
      }
      loadedClientRef.current = posthog;
      flushPosthogQueue(posthog);
      setTimeout(() => flushPosthogQueue(posthog), 0);
      setClient(posthog);
    };

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      idleId = window.requestIdleCallback(() => initPosthog(), { timeout: 3000 });
    } else {
      timeoutId = setTimeout(initPosthog, 1500);
    }

    return () => {
      didCancel = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (idleId !== null && typeof window !== 'undefined' && 'cancelIdleCallback' in window) {
        window.cancelIdleCallback(idleId);
      }
    };
  }, [sensitivePath]);

  const resolvedClient = client ?? noopClientRef.current;
  return (
    <PHProvider client={resolvedClient}>
      {client ? <PostHogUserIdentifier /> : null}
      {children}
    </PHProvider>
  );
}

/**
 * Hook to identify the current user in PostHog.
 * Should be used within the PostHogProvider context.
 */
export function PostHogUserIdentifier() {
  const posthogClient = usePostHog();
  const { user } = useSupabaseSession();
  const identifiedUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (user?.id) {
      if (identifiedUserIdRef.current !== user.id) {
        posthogClient.identify(user.id);
        identifiedUserIdRef.current = user.id;
      }
      return;
    }

    if (identifiedUserIdRef.current) {
      posthogClient.reset();
      identifiedUserIdRef.current = null;
    }
  }, [posthogClient, user?.id]);

  return null;
}
