'use client';

import posthog from 'posthog-js';
import { PostHogProvider as PHProvider, usePostHog } from 'posthog-js/react';
import { useEffect, type ReactNode } from 'react';

import { useSupabaseSession } from '@/hooks/useSupabaseSession';

/**
 * PostHog analytics provider for client-side tracking.
 * Wraps the application to enable PostHog features like:
 * - Automatic pageview tracking
 * - Session recording
 * - Feature flags
 * - Event capturing
 */
export function PostHogProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;

    if (!key || !host) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[PostHog] Missing NEXT_PUBLIC_POSTHOG_KEY or NEXT_PUBLIC_POSTHOG_HOST environment variables');
      }
      return;
    }

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
  }, []);

  return <PHProvider client={posthog}>{children}</PHProvider>;
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

export { posthog };
