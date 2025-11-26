'use client';

import { QueryClient, QueryClientProvider, type DefaultOptions, type Query } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useEffect, useState, type ReactNode } from 'react';

import { configureQueryPersistence } from '@/lib/query/persist';
import { getQueryGcTime, getQueryStaleTime } from '@/lib/query/staleTimes';

const defaultOptions: DefaultOptions = {
  queries: {
    retry: 1,
    refetchOnWindowFocus: false,
    staleTime: (query) => getQueryStaleTime(query as unknown as Query),
    gcTime: (query) => getQueryGcTime(query as unknown as Query),
  },
};

const enableDevtools = process.env.NODE_ENV !== 'production';

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions }));
  useEffect(() => configureQueryPersistence(queryClient), [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {enableDevtools ? (
        <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
      ) : null}
    </QueryClientProvider>
  );
}
