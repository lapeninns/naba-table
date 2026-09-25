import type { QueryClient, QueryKey } from '@tanstack/react-query';

const MINUTE = 60_000;

export const DEFAULT_QUERY_STALE_TIME = 30_000;
export const DEFAULT_QUERY_GC_TIME = 5 * MINUTE;

type QueryDefaultRule = { prefix: QueryKey; staleTime: number };

/**
 * Per-prefix stale times, applied with `queryClient.setQueryDefaults`.
 *
 * TanStack Query v5 merges every matching prefix in registration order (last wins), so list
 * generic prefixes before more specific ones. Matching is positional (`partialMatchKey`): rules
 * that depend on a segment at any position (ops restaurant `hours` / `service-periods`) cannot be
 * expressed here and are set explicitly in `useOpsOperatingHours` / `useOpsServicePeriods`.
 * A hook or prefetch option always wins over these defaults.
 */
export const QUERY_DEFAULT_RULES: readonly QueryDefaultRule[] = [
  // Relatively static profile/settings data
  { prefix: ['profile'], staleTime: 5 * MINUTE },
  { prefix: ['owner', 'restaurants'], staleTime: 5 * MINUTE },
  { prefix: ['ops', 'settings'], staleTime: 5 * MINUTE },
  { prefix: ['ops', 'tables'], staleTime: 2 * MINUTE },
  { prefix: ['ops', 'occasions'], staleTime: 5 * MINUTE },
  // Operational data that changes often
  { prefix: ['bookings'], staleTime: 45_000 },
  { prefix: ['ops', 'bookings'], staleTime: 45_000 },
  { prefix: ['ops', 'dashboard'], staleTime: 60_000 },
  { prefix: ['ops', 'customers'], staleTime: 2 * MINUTE },
  { prefix: ['restaurants'], staleTime: 2 * MINUTE },
  // Guest reservations & availability
  { prefix: ['reservation'], staleTime: 60_000 },
  { prefix: ['reservations', 'schedule'], staleTime: 60_000 },
];

// Keep cache around at least twice the stale window to allow quick back/forward navigations.
function gcTimeFor(staleTime: number): number {
  return Math.max(staleTime * 2, DEFAULT_QUERY_GC_TIME);
}

export function applyQueryDefaults(queryClient: QueryClient): void {
  for (const rule of QUERY_DEFAULT_RULES) {
    queryClient.setQueryDefaults(rule.prefix, {
      staleTime: rule.staleTime,
      gcTime: gcTimeFor(rule.staleTime),
    });
  }
}
