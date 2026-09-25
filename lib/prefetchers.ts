import { type QueryKey, type QueryFunction } from '@tanstack/react-query';

import type { BeforeQueryOptions } from '@/lib/query/clientDefaults';
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

type BeforeQueryHook = (options: BeforeQueryOptions) => void;

function isBeforeQueryHook(value: unknown): value is BeforeQueryHook {
  return typeof value === 'function';
}

function toMilliseconds(staleTime: unknown): number {
  if (typeof staleTime === 'number') return staleTime;
  // Unknown shapes (e.g. a staleTime function) resolve to 0: always fetch.
  return staleTime === 'static' ? Number.POSITIVE_INFINITY : 0;
}

/**
 * Resolves the staleTime/gcTime a prefetch should honour exactly as useQuery does
 * on mount: caller options (normally the hook's shared constant) over the client's
 * defaults, then the client's `_experimental_beforeQuery` hook, which the app uses
 * to override per-key freshness. Prefetch and page mount therefore always agree.
 */
function resolvePrefetchTiming(
  queryClient: QueryClient,
  queryKey: QueryKey,
  staleTime: number | undefined,
  gcTime: number | undefined,
): { staleTime: number; gcTime: number | undefined } {
  const defaulted = queryClient.defaultQueryOptions({
    queryKey,
    ...(staleTime === undefined ? {} : { staleTime }),
    ...(gcTime === undefined ? {} : { gcTime }),
  });
  const options: BeforeQueryOptions = {
    queryKey: defaulted.queryKey,
    staleTime: defaulted.staleTime,
    gcTime: defaulted.gcTime,
  };
  const queryDefaults = queryClient.getDefaultOptions().queries;
  const beforeQuery =
    queryDefaults && '_experimental_beforeQuery' in queryDefaults
      ? queryDefaults._experimental_beforeQuery
      : undefined;
  if (isBeforeQueryHook(beforeQuery)) beforeQuery(options);
  return {
    staleTime: toMilliseconds(options.staleTime),
    gcTime: typeof options.gcTime === 'number' ? options.gcTime : undefined,
  };
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
  const { staleTime: effectiveStaleTime, gcTime: effectiveGcTime } = resolvePrefetchTiming(
    queryClient,
    queryKey,
    staleTime,
    gcTime,
  );
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
    gcTime: effectiveGcTime,
    enabled,
  });
}
