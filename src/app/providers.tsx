'use client';

import { QueryClient, QueryClientProvider, type DefaultOptions } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { SupabaseSessionProvider, useSupabaseSession } from '@/hooks/useSupabaseSession';
import { useClientErrorReporter } from '@/lib/monitoring/clientReporter';
import { PostHogProvider, PostHogUserIdentifier } from '@/lib/posthog/provider';
import {
  buildQueryStorageKey,
  clearPersistedQueryCache,
  configureQueryPersistence,
} from '@/lib/query/persist';
import { getQueryGcTime, getQueryStaleTime } from '@/lib/query/staleTimes';

import type { Session } from '@supabase/supabase-js';

type ExperimentalQueryDefaults = DefaultOptions['queries'] & {
  _experimental_beforeQuery?: (options: {
    queryKey?: readonly unknown[];
    staleTime?: number;
    gcTime?: number;
  }) => void;
};

const queryDefaults: ExperimentalQueryDefaults = {
  retry: 2,
  retryDelay: (attempt) => Math.min(500 * 2 ** attempt, 4000),
  refetchOnWindowFocus: false,
  // Provide baseline values; per-query adjustments happen in `_experimental_beforeQuery`.
  staleTime: getQueryStaleTime(undefined),
  gcTime: getQueryGcTime(undefined),
  _experimental_beforeQuery: (options) => {
    const staleTime = getQueryStaleTime(options.queryKey);
    options.staleTime = staleTime;
    options.gcTime = getQueryGcTime(options.queryKey ?? []);
  },
};

const defaultOptions: DefaultOptions = {
  queries: queryDefaults,
};

const enableDevtools = process.env.NODE_ENV !== 'production';

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const parts = document.cookie.split(';').map((p) => p.trim());
  for (const part of parts) {
    if (!part.startsWith(`${name}=`)) continue;
    return decodeURIComponent(part.slice(name.length + 1));
  }
  return null;
}

function useAnalyticsConsent(): boolean {
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    setAllowed(readCookie('nat_consent') === 'granted');
  }, []);

  return allowed;
}

type AppProvidersProps = {
  children: ReactNode;
  initialSession?: Session | null;
};

function QueryLayer({ children }: { children: ReactNode }) {
  const { user } = useSupabaseSession();
  useClientErrorReporter();
  const [queryClient] = useState(() => new QueryClient({ defaultOptions }));
  const persistenceCleanupRef = useRef<(() => void) | null>(null);
  const storageKeyRef = useRef<string>(buildQueryStorageKey(user?.id ?? null));

  // Configure per-user query persistence and clear cache on auth changes
  useEffect(() => {
    const nextKey = buildQueryStorageKey(user?.id ?? null);
    const prevKey = storageKeyRef.current;
    const keyChanged = nextKey !== prevKey;

    if (keyChanged || !persistenceCleanupRef.current) {
      persistenceCleanupRef.current?.();

      if (keyChanged) {
        queryClient.clear();
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
  }, [queryClient, user?.id]);

  useEffect(
    () => () => {
      persistenceCleanupRef.current?.();
    },
    [],
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {enableDevtools ? (
        <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
      ) : null}
    </QueryClientProvider>
  );
}

export function AppProviders({ children, initialSession }: AppProvidersProps) {
  const analyticsAllowed = useAnalyticsConsent();

  const content = (
    <SupabaseSessionProvider initialSession={initialSession}>
      {analyticsAllowed ? <PostHogUserIdentifier /> : null}
      <QueryLayer>{children}</QueryLayer>
    </SupabaseSessionProvider>
  );

  return analyticsAllowed ? <PostHogProvider>{content}</PostHogProvider> : content;
}
