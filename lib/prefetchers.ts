import { type QueryKey, type QueryFunction } from '@tanstack/react-query';

import type { QueryClient} from '@tanstack/react-query';

type PrefetchOptions<TQueryFnData> = {
  queryClient: QueryClient;
  queryKey: QueryKey;
  queryFn: QueryFunction<TQueryFnData>;
  staleTime?: number;
  gcTime?: number;
  enabled?: boolean;
};

/**
 * Safe wrapper around queryClient.prefetchQuery/ensureQueryData with guards and quiet failure in prod.
 */
export async function prefetchSafely<TQueryFnData>({
  queryClient,
  queryKey,
  queryFn,
  staleTime,
  gcTime,
  enabled = true,
}: PrefetchOptions<TQueryFnData>): Promise<void> {
  if (!enabled) return;
  try {
    await queryClient.prefetchQuery({ queryKey, queryFn, staleTime, gcTime });
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[prefetch] failed', { queryKey, error });
    }
  }
}

/**
 * Prefetch helper that no-ops when key is already fresh according to cache state.
 */
export async function prefetchIfStale<TQueryFnData>({
  queryClient,
  queryKey,
  queryFn,
  staleTime,
  gcTime,
  enabled = true,
}: PrefetchOptions<TQueryFnData>): Promise<void> {
  if (!enabled) return;
  const state = queryClient.getQueryState(queryKey);
  const effectiveStaleTime = staleTime ?? 0;
  const isFresh = Boolean(state && effectiveStaleTime > 0 && Date.now() - state.dataUpdatedAt < effectiveStaleTime);
  if (isFresh) return;
  return prefetchSafely({ queryClient, queryKey, queryFn, staleTime, gcTime, enabled });
}
