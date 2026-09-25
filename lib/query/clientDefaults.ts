import { getQueryGcTime, getQueryStaleTime } from '@/lib/query/staleTimes';

import type { DefaultOptions } from '@tanstack/react-query';

/**
 * Options object `_experimental_beforeQuery` receives. useQuery calls the hook
 * with its defaulted options on every render and the hook may overwrite them.
 */
export type BeforeQueryOptions = {
  queryKey?: readonly unknown[];
  staleTime?: unknown;
  gcTime?: unknown;
};

type ExperimentalQueryDefaults = NonNullable<DefaultOptions['queries']> & {
  _experimental_beforeQuery?: (options: BeforeQueryOptions) => void;
};

const appQueryDefaults: ExperimentalQueryDefaults = {
  retry: 2,
  retryDelay: (attempt) => Math.min(500 * 2 ** attempt, 4000),
  refetchOnWindowFocus: false,
  // Provide baseline values; per-query adjustments happen in `_experimental_beforeQuery`.
  staleTime: getQueryStaleTime(undefined),
  gcTime: getQueryGcTime(undefined),
  // This overrides any hook-level staleTime/gcTime with the key-based rules, so
  // prefetchers must resolve freshness through the same hook (see lib/prefetchers.ts).
  _experimental_beforeQuery: (options) => {
    options.staleTime = getQueryStaleTime(options.queryKey);
    options.gcTime = getQueryGcTime(options.queryKey ?? []);
  },
};

/** QueryClient defaults used by the app providers, and by tests that need app parity. */
export const appQueryClientDefaultOptions: DefaultOptions = {
  queries: appQueryDefaults,
};
