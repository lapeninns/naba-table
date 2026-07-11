import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';

import { queryKeys } from '@/lib/query/keys';
import {
  dualSyncQueryKeys,
  invalidateDualSyncWorkspaceQueries,
  invalidateGoogleBusinessProfileQueries,
  invalidateOpsIntegrationQueries,
} from '@src/hooks/ops/opsIntegrationQueries';

const restaurantId = 'rest-1';

function spyClient() {
  const queryClient = new QueryClient();
  const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
  return { queryClient, invalidateSpy };
}

function invalidatedKeys(invalidateSpy: ReturnType<typeof vi.spyOn>) {
  return (invalidateSpy.mock.calls as Array<[{ queryKey: readonly unknown[] }]>).map(
    ([filters]) => filters.queryKey,
  );
}

describe('opsIntegrationQueries', () => {
  it('@contract invalidates both Google Business Profile caches', () => {
    const { queryClient, invalidateSpy } = spyClient();

    invalidateGoogleBusinessProfileQueries(queryClient, restaurantId);

    expect(invalidatedKeys(invalidateSpy)).toEqual([
      queryKeys.opsRestaurants.googleBusinessProfile(restaurantId),
      queryKeys.opsRestaurants.googleBusinessProfileLocations(restaurantId),
    ]);
  });

  it('@contract invalidates every dual-sync workspace cache plus the restaurant detail', () => {
    const { queryClient, invalidateSpy } = spyClient();

    invalidateDualSyncWorkspaceQueries(queryClient, restaurantId);

    expect(invalidatedKeys(invalidateSpy)).toEqual([
      dualSyncQueryKeys.state(restaurantId),
      dualSyncQueryKeys.operations(restaurantId),
      dualSyncQueryKeys.jobs(restaurantId),
      dualSyncQueryKeys.candidates(restaurantId),
      dualSyncQueryKeys.metrics(restaurantId),
      dualSyncQueryKeys.publishJobs(restaurantId),
      dualSyncQueryKeys.publishJobDetail(restaurantId),
      queryKeys.opsRestaurants.detail(restaurantId),
    ]);
  });

  it('@contract invalidates the full integration surface in one call', () => {
    const { queryClient, invalidateSpy } = spyClient();

    invalidateOpsIntegrationQueries(queryClient, restaurantId);

    const keys = invalidatedKeys(invalidateSpy);
    expect(keys).toHaveLength(10);
    expect(keys).toContainEqual(queryKeys.opsRestaurants.googleBusinessProfile(restaurantId));
    expect(keys).toContainEqual(dualSyncQueryKeys.state(restaurantId));
    expect(keys).toContainEqual(queryKeys.opsRestaurants.detail(restaurantId));
  });

  it('@contract scopes dual-sync keys per restaurant', () => {
    expect(dualSyncQueryKeys.state('a')).toEqual(['dual-sync-state', 'a']);
    expect(dualSyncQueryKeys.publishJobDetail('b')).toEqual([
      'dual-sync-publish-job-detail',
      'b',
    ]);
  });
});
