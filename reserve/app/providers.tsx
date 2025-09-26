'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState, type PropsWithChildren } from 'react';

const defaultQueryOptions = {
  queries: {
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  },
};

export function ReserveProviders({ children }: PropsWithChildren) {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: defaultQueryOptions }));

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
    </QueryClientProvider>
  );
}
