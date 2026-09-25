'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { SessionActivityReporter } from '@/components/features/account-sessions/SessionActivityReporter';
import {
  SupabaseSessionProvider,
  useSupabaseSession,
  useSupabaseSessionResolved,
} from '@/hooks/useSupabaseSession';
import { useClientErrorReporter } from '@/lib/monitoring/clientReporter';
import { PostHogProvider } from '@/lib/posthog/provider';
import { createAppQueryClient } from '@/lib/query/client';
import {
  buildQueryStorageKey,
  clearPersistedQueryCache,
  configureQueryPersistence,
} from '@/lib/query/persist';

import type { Session } from '@supabase/supabase-js';

const enableDevtools = process.env.NODE_ENV !== 'production';
const ReactQueryDevtools = dynamic(
  () => import('@tanstack/react-query-devtools').then((mod) => mod.ReactQueryDevtools),
  { ssr: false },
);

type AppProvidersProps = {
  children: ReactNode;
  initialSession?: Session | null;
};

function QueryLayer({ children }: { children: ReactNode }) {
  const { user, status } = useSupabaseSession();
  const sessionResolved = useSupabaseSessionResolved();
  useClientErrorReporter();
  const [queryClient] = useState(createAppQueryClient);
  const [showDevtools, setShowDevtools] = useState(false);
  const persistenceCleanupRef = useRef<(() => void) | null>(null);
  const storageKeyRef = useRef<string>(buildQueryStorageKey(user?.id ?? null));

  // Configure per-user query persistence and clear cache on auth changes.
  // Wait for the browser client to confirm the session: the root layout bootstraps as
  // "unauthenticated", and persisting under the anonymous key before confirmation would
  // store (then wipe) data fetched by signed-in ops pages.
  useEffect(() => {
    if (status === 'loading' || !sessionResolved) {
      return;
    }

    const nextUserId = status === 'authenticated' ? (user?.id ?? null) : null;
    const nextKey = buildQueryStorageKey(nextUserId);
    const prevKey = storageKeyRef.current;
    const keyChanged = nextKey !== prevKey;
    const hadPersistenceConfigured = persistenceCleanupRef.current !== null;
    const rehydratingAuthenticatedSessionAfterAnonymousBootstrap =
      !hadPersistenceConfigured &&
      prevKey === buildQueryStorageKey(null) &&
      status === 'authenticated' &&
      nextUserId !== null;

    if (keyChanged || !persistenceCleanupRef.current) {
      persistenceCleanupRef.current?.();

      if (keyChanged) {
        if (!rehydratingAuthenticatedSessionAfterAnonymousBootstrap) {
          queryClient.clear();
        }
        clearPersistedQueryCache(prevKey);
      }

      persistenceCleanupRef.current = configureQueryPersistence(queryClient, {
        storageKey: nextKey,
      });
      storageKeyRef.current = nextKey;
    }

    return () => {
      // cleanup happens on unmount via outer effect below
    };
  }, [queryClient, sessionResolved, status, user?.id]);

  useEffect(
    () => () => {
      persistenceCleanupRef.current?.();
    },
    [],
  );

  useEffect(() => {
    if (!enableDevtools || typeof window === 'undefined') {
      return;
    }
    const isOpsHost =
      window.location.hostname.startsWith('app.') || window.location.pathname.startsWith('/app');
    setShowDevtools(!isOpsHost);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <SessionActivityReporter />
      {children}
      {showDevtools ? (
        <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
      ) : null}
    </QueryClientProvider>
  );
}

export function AppProviders({ children, initialSession }: AppProvidersProps) {
  return (
    <SupabaseSessionProvider initialSession={initialSession}>
      <PostHogProvider>
        <QueryLayer>{children}</QueryLayer>
      </PostHogProvider>
    </SupabaseSessionProvider>
  );
}
