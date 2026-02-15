'use client';

import { PostHogProvider as PHProvider, usePostHog } from 'posthog-js/react';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { useSupabaseSession } from '@/hooks/useSupabaseSession';
import { clientEnv } from '@/lib/env-client';

import type { PostHog } from 'posthog-js';

type PosthogQueuedEvent = { event: string; payload: Record<string, unknown> };

const noop = () => undefined;

const createNoopPostHog = (): PostHog =>
  ({
    __loaded: false,
    config: {},
    identify: noop,
    reset: noop,
    capture: noop,
    onFeatureFlags: () => noop,
    isFeatureEnabled: () => undefined,
    getFeatureFlag: () => undefined,
    getFeatureFlagPayload: () => undefined,
    getAllFlags: () => ({}),
    reloadFeatureFlags: noop,
    set_config: noop,
  }) as unknown as PostHog;

const flushPosthogQueue = (client: PostHog) => {
  if (typeof window === 'undefined') return;
  const win = window as Window & { __posthogQueue?: PosthogQueuedEvent[] };
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
 * - Feature flags
 * - Event capturing
 */
export function PostHogProvider({ children }: { children: ReactNode }) {
  const [client, setClient] = useState<PostHog | null>(null);
  const noopClientRef = useRef<PostHog>(createNoopPostHog());

  useEffect(() => {
    const { key, host, enabled } = clientEnv.posthog;
    const isOpsHost =
      typeof window !== 'undefined' &&
      (window.location.hostname.startsWith('app.') || window.location.pathname.startsWith('/app'));

    if (isOpsHost) {
      return;
    }

    if (!enabled) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[PostHog] Missing NEXT_PUBLIC_POSTHOG_KEY or NEXT_PUBLIC_POSTHOG_HOST environment variables');
      }
      return;
    }

    let didCancel = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let idleId: number | null = null;

    const initPosthog = async () => {
      if (didCancel) return;
      const { default: posthog } = await import('posthog-js');
      if (didCancel) return;
      posthog.init(key, {
        api_host: host,
        person_profiles: 'identified_only',
        capture_pageview: false, // We capture pageviews manually via instrumentation-client.ts
        capture_pageleave: true,
        autocapture: true,
        persistence: 'localStorage+cookie',
        loaded: (posthog) => {
          if (process.env.NODE_ENV === 'development') {
            // Enable debug mode in development
            posthog.debug();
          }
        },
      });
      flushPosthogQueue(posthog);
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
  }, []);

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

  useEffect(() => {
    if (user?.id) {
      posthogClient.identify(user.id, {
        email: user.email,
      });
    } else {
      posthogClient.reset();
    }
  }, [posthogClient, user?.id, user?.email]);

  return null;
}
