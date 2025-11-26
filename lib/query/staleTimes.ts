import type { Query, QueryKey } from '@tanstack/react-query';

const MINUTE = 60_000;

// Map query key patterns to stale times (ms)
const STALE_TIME_RULES: Array<{ match: (key: readonly unknown[]) => boolean; staleTime: number }> = [
  // Relatively static profile/settings data
  { match: (key) => key[0] === 'profile', staleTime: 5 * MINUTE },
  { match: (key) => key[0] === 'owner' && key[1] === 'restaurants', staleTime: 5 * MINUTE },
  { match: (key) => key[0] === 'ops' && key[1] === 'settings', staleTime: 5 * MINUTE },
  { match: (key) => key[0] === 'ops' && key[1] === 'restaurants' && key.includes('hours'), staleTime: 5 * MINUTE },
  { match: (key) => key[0] === 'ops' && key[1] === 'restaurants' && key.includes('service-periods'), staleTime: 5 * MINUTE },
  { match: (key) => key[0] === 'ops' && key[1] === 'tables', staleTime: 2 * MINUTE },
  { match: (key) => key[0] === 'ops' && key[1] === 'occasions', staleTime: 5 * MINUTE },
  // Operational data that changes often
  { match: (key) => key[0] === 'bookings', staleTime: 30_000 },
  { match: (key) => key[0] === 'ops' && key[1] === 'bookings', staleTime: 30_000 },
  { match: (key) => key[0] === 'ops' && key[1] === 'dashboard', staleTime: 60_000 },
  { match: (key) => key[0] === 'ops' && key[1] === 'customers', staleTime: 2 * MINUTE },
  { match: (key) => key[0] === 'restaurants', staleTime: 2 * MINUTE },
];

const DEFAULT_STALE_TIME = 30_000;

type QueryKeyLike = Query | QueryKey | undefined;

function toQueryKey(input: QueryKeyLike): readonly unknown[] {
  if (!input) return [];
  if (Array.isArray(input)) return input;
  return 'queryKey' in input ? input.queryKey ?? [] : [];
}

export function getQueryStaleTime(query: QueryKeyLike): number {
  const key = toQueryKey(query);
  for (const rule of STALE_TIME_RULES) {
    if (rule.match(key)) return rule.staleTime;
  }
  return DEFAULT_STALE_TIME;
}

export function getQueryGcTime(query: QueryKeyLike): number {
  const stale = getQueryStaleTime(query);
  // Keep cache around at least twice the stale window to allow quick back/forward navigations.
  return Math.max(stale * 2, 5 * MINUTE);
}
