'use client';

import { QueryClient, QueryClientProvider, type DefaultOptions } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState, type ReactNode } from 'react';

const defaultOptions: DefaultOptions = {
  queries: {
    retry: 1,
    refetchOnWindowFocus: false,
    staleTime: 30_000,
  },
};

const enableDevtools = process.env.NODE_ENV !== 'production';

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions }));

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {enableDevtools ? (
        <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
      ) : null}
    </QueryClientProvider>
  );
}
