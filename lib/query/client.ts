import { QueryClient } from '@tanstack/react-query';
import { ZodError } from 'zod';

import { HttpError } from '@/lib/http/errors';
import {
  applyQueryDefaults,
  DEFAULT_QUERY_GC_TIME,
  DEFAULT_QUERY_STALE_TIME,
} from '@/lib/query/staleTimes';

const MAX_QUERY_RETRIES = 2;

/**
 * Retries only failures that can succeed on a second attempt: network errors, 5xx, 408 and 429.
 * Other 4xx answers (a 401 would also re-trigger the sign-in redirect per attempt), unparseable
 * responses and schema validation errors fail at once.
 */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (failureCount >= MAX_QUERY_RETRIES) {
    return false;
  }
  if (error instanceof HttpError) {
    return (
      error.status >= 500 ||
      error.status === 408 ||
      error.status === 429 ||
      error.code === 'READ_ERROR'
    );
  }
  return !(error instanceof ZodError);
}

export function createAppQueryClient(): QueryClient {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: shouldRetryQuery,
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
