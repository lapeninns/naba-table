import { QueryObserver } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';

import { prefetchSafely } from '@/lib/prefetchers';
import { createAppQueryClient } from '@/lib/query/client';
import { queryKeys } from '@/lib/query/keys';

import type { QueryKey } from '@tanstack/react-query';

const MINUTE = 60_000;

// One representative live key per rule in lib/query/staleTimes.ts.
const RULE_CASES: Array<{ name: string; key: QueryKey; staleTime: number; gcTime: number }> = [
  { name: 'profile', key: queryKeys.profile.self(), staleTime: 5 * MINUTE, gcTime: 10 * MINUTE },
  {
    name: 'owner restaurants',
    key: queryKeys.ownerRestaurants.hours('rest-1'),
    staleTime: 5 * MINUTE,
    gcTime: 10 * MINUTE,
  },
  {
    name: 'ops settings',
    key: queryKeys.opsSettings.strategicConfig('rest-1'),
    staleTime: 5 * MINUTE,
    gcTime: 10 * MINUTE,
  },
  {
    name: 'ops tables',
    key: queryKeys.opsTables.list('rest-1'),
    staleTime: 2 * MINUTE,
    gcTime: 5 * MINUTE,
  },
  {
    name: 'ops occasions',
    key: queryKeys.opsOccasions.list(),
    staleTime: 5 * MINUTE,
    gcTime: 10 * MINUTE,
  },
  { name: 'bookings', key: queryKeys.bookings.list(), staleTime: 45_000, gcTime: 5 * MINUTE },
  {
    name: 'ops bookings',
    key: queryKeys.opsBookings.detail('b-1'),
    staleTime: 45_000,
    gcTime: 5 * MINUTE,
  },
  {
    name: 'ops dashboard',
    key: queryKeys.opsDashboard.summary('rest-1'),
    staleTime: 60_000,
    gcTime: 5 * MINUTE,
  },
  {
    name: 'ops customers',
    key: queryKeys.opsCustomers.list(),
    staleTime: 2 * MINUTE,
    gcTime: 5 * MINUTE,
  },
  {
    name: 'restaurants',
    key: queryKeys.restaurants.list(),
    staleTime: 2 * MINUTE,
    gcTime: 5 * MINUTE,
  },
  { name: 'reservation', key: ['reservation', 'res-1'], staleTime: 60_000, gcTime: 5 * MINUTE },
  {
    name: 'reservations schedule',
    key: ['reservations', 'schedule', 'rest-1', '2026-09-25'],
    staleTime: 60_000,
    gcTime: 5 * MINUTE,
  },
];

describe('createAppQueryClient per-key defaults', () => {
  it.each(RULE_CASES)('getQueryDefaults applies the $name rule', ({ key, staleTime, gcTime }) => {
    const client = createAppQueryClient();

    expect(client.getQueryDefaults(key)).toMatchObject({ staleTime, gcTime });
    expect(client.defaultQueryOptions({ queryKey: key })).toMatchObject({ staleTime, gcTime });
  });

  it('keeps the 30s / 5min baseline for keys without a rule', () => {
    const client = createAppQueryClient();
    const key = queryKeys.opsRestaurants.detail('rest-1');

    expect(client.getQueryDefaults(key)).toEqual({});
    expect(client.defaultQueryOptions({ queryKey: key })).toMatchObject({
      staleTime: 30_000,
      gcTime: 5 * MINUTE,
      retry: 2,
      refetchOnWindowFocus: false,
    });
  });

  it('does not register prefix defaults for content-matched hours/service-period keys', () => {
    // Prefix matching cannot express "hours at any position"; the ops hooks set staleTime explicitly.
    const client = createAppQueryClient();

    expect(client.getQueryDefaults(queryKeys.opsRestaurants.hours('rest-1'))).toEqual({});
    expect(client.getQueryDefaults(queryKeys.opsRestaurants.servicePeriods('rest-1'))).toEqual({});
  });

  it('lets a hook-level staleTime/gcTime win over the prefix defaults', () => {
    const client = createAppQueryClient();
    const observer = new QueryObserver(client, {
      queryKey: queryKeys.profile.self(),
      queryFn: () => Promise.resolve('profile'),
      enabled: false,
      staleTime: 1_234,
      gcTime: 9_876,
    });

    expect(observer.options.staleTime).toBe(1_234);
    expect(observer.options.gcTime).toBe(9_876);
  });

  it('does not drop the prefix default when a prefetch helper passes undefined staleTime', async () => {
    const client = createAppQueryClient();
    const key = queryKeys.opsTables.list('rest-1');
    client.setQueryData(key, ['cached']);
    let calls = 0;

    await prefetchSafely({
      queryClient: client,
      queryKey: key,
      queryFn: () => {
        calls += 1;
        return Promise.resolve(['fresh']);
      },
    });

    expect(calls).toBe(0);
    expect(client.getQueryData(key)).toEqual(['cached']);
  });
});
