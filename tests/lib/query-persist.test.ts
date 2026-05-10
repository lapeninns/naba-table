import { describe, expect, it } from 'vitest';

import { isVolatileOpsIntegrationQueryKey, shouldPersistQuery } from '@/lib/query/persist';
import { queryKeys } from '@/lib/query/keys';

import type { Query } from '@tanstack/react-query';

function queryWithKey(queryKey: Query['queryKey'], meta?: Query['meta']): Query {
  return { queryKey, meta } as Query;
}

describe('query persistence filter', () => {
  it.each(
    [
      queryKeys.opsRestaurants.googleBusinessProfile('rest-1'),
      queryKeys.opsRestaurants.googleBusinessProfileLocations('rest-1'),
      ['dual-sync-state', 'rest-1'],
      ['dual-sync-operations', 'rest-1', 50, null, null, null],
      ['dual-sync-publish-jobs', 'rest-1', 25, null, null],
      ['dual-sync-publish-job-detail', 'rest-1', 'job-1'],
      ['ops', 'food-menus', 'rest-1', 'import-reviews'],
    ].map((queryKey) => [queryKey] as const),
  )('excludes volatile ops integration query %#', (queryKey) => {
    expect(isVolatileOpsIntegrationQueryKey(queryKey)).toBe(true);
    expect(shouldPersistQuery(queryWithKey(queryKey))).toBe(false);
  });

  it('allows stable unrelated query keys to persist', () => {
    expect(shouldPersistQuery(queryWithKey(queryKeys.opsRestaurants.detail('rest-1')))).toBe(true);
    expect(shouldPersistQuery(queryWithKey(queryKeys.bookings.detail('booking-1')))).toBe(true);
  });

  it('honors explicit persist false metadata', () => {
    expect(
      shouldPersistQuery(queryWithKey(queryKeys.bookings.detail('booking-1'), { persist: false })),
    ).toBe(false);
  });
});
