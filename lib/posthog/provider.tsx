'use client';

import { PostHogProvider as PHProvider, usePostHog } from 'posthog-js/react';
import { useEffect, useRef, useState, type ReactNode } from 'react';

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
  const [client, setClient] = useState<PostHog | null>(null);
  const noopClientRef = useRef<PostHog>(createNoopPostHog());

  useEffect(() => {
    const { key, host, enabled } = clientEnv.posthog;

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
        // Explicit true overrides the remote $exception_capture_enabled_server_side
        // flag, so unhandled errors/rejections always produce native $exception
        // events (still filtered through before_send below).
        capture_exceptions: true,
        persistence: 'localStorage+cookie',
        before_send: (event) => {
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
