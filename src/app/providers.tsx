'use client';

import { QueryClient, QueryClientProvider, type DefaultOptions } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useEffect, useState, type ReactNode } from 'react';

import { configureQueryPersistence } from '@/lib/query/persist';
import { getQueryGcTime, getQueryStaleTime } from '@/lib/query/staleTimes';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

import type { Session } from '@supabase/supabase-js';

type ExperimentalQueryDefaults = DefaultOptions['queries'] & {
  _experimental_beforeQuery?: (options: { queryKey?: readonly unknown[]; staleTime?: number; gcTime?: number }) => void;
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

type AppProvidersProps = {
  children: ReactNode;
  initialSession?: Session | null;
};

export function AppProviders({ children, initialSession }: AppProvidersProps) {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions }));
  useEffect(() => configureQueryPersistence(queryClient), [queryClient]);

  useEffect(() => {
    if (!initialSession) return;

    const supabase = getSupabaseBrowserClient();

    // Hydrate the browser client with the server-issued session so client hooks render as authenticated
    supabase.auth
      .setSession({
        access_token: initialSession.access_token,
        refresh_token: initialSession.refresh_token,
      })
      .catch((error) => {
        console.error('[AppProviders] failed to hydrate Supabase session', error);
      });
  }, [initialSession]);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {enableDevtools ? (
        <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
      ) : null}
    </QueryClientProvider>
  );
}
