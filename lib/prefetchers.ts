import { type QueryKey, type QueryFunction } from '@tanstack/react-query';

import type { QueryClient } from '@tanstack/react-query';

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
 * Resolves the staleTime a prefetch should honour: the caller's value (normally the
 * hook's shared constant), else the client's defaults for this key, else 0.
 */
function resolvePrefetchStaleTime(
  queryClient: QueryClient,
  queryKey: QueryKey,
  staleTime: number | undefined,
): number {
  if (staleTime !== undefined) return staleTime;
  const defaults = queryClient.defaultQueryOptions({ queryKey }).staleTime;
  if (typeof defaults === 'number') return defaults;
  return defaults === 'static' ? Number.POSITIVE_INFINITY : 0;
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
  const effectiveStaleTime = resolvePrefetchStaleTime(queryClient, queryKey, staleTime);
  const state = queryClient.getQueryState(queryKey);
  const isFresh = Boolean(
    state &&
    state.data !== undefined &&
    !state.isInvalidated &&
    Date.now() - state.dataUpdatedAt < effectiveStaleTime,
  );
  if (isFresh) return;
  return prefetchSafely({
    queryClient,
    queryKey,
    queryFn,
    staleTime: effectiveStaleTime,
    gcTime,
    enabled,
  });
}
