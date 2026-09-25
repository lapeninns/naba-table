import { QueryClient } from '@tanstack/react-query';

import {
  applyQueryDefaults,
  DEFAULT_QUERY_GC_TIME,
  DEFAULT_QUERY_STALE_TIME,
} from '@/lib/query/staleTimes';

export function createAppQueryClient(): QueryClient {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: 2,
        retryDelay: (attempt) => Math.min(500 * 2 ** attempt, 4000),
        refetchOnWindowFocus: false,
        staleTime: DEFAULT_QUERY_STALE_TIME,
        gcTime: DEFAULT_QUERY_GC_TIME,
      },
    },
  });
  applyQueryDefaults(queryClient);
  return queryClient;
}
