import { beforeEach, describe, expect, it, vi } from 'vitest';

const refreshFromGoogleMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/dual-sync/refresh', () => ({
  refreshFromGoogle: refreshFromGoogleMock,
}));

import {
  listRestaurantsWithLinkedGoogleBusinessProfile,
  runScheduledRefreshForAllTenants,
  runScheduledRefreshForRestaurant,
} from '@/server/dual-sync/scheduling/refresh';

import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

interface MockChain {
  readonly select: ReturnType<typeof vi.fn>;
  readonly eq: ReturnType<typeof vi.fn>;
  readonly not: ReturnType<typeof vi.fn>;
  readonly order: ReturnType<typeof vi.fn>;
  readonly limit: ReturnType<typeof vi.fn>;
  readonly then: (resolve: (value: { data: unknown[]; error: null }) => unknown) => unknown;
}

const RESTAURANT_ID = 'rest-1';

function makeChain(rows: unknown[]): MockChain {
  const chain: Partial<MockChain> = {};
  const fluent = vi.fn(() => chain as MockChain);
  Object.assign(chain, {
    select: fluent,
    eq: fluent,
    not: fluent,
    order: fluent,
    limit: fluent,
    then: (resolve: (value: { data: unknown[]; error: null }) => unknown) =>
      Promise.resolve(resolve({ data: rows, error: null })),
  });
  return chain as MockChain;
}

function makeClient(rows: unknown[]) {
  const chain = makeChain(rows);
  const client = { from: vi.fn(() => chain) } as unknown as SupabaseClient<Database>;
  return { chain, client };
}

function mockRefreshResult(restaurantId = RESTAURANT_ID) {
  return {
    snapshotRun: {
      id: `run-${restaurantId}`,
      restaurantId,
      provider: 'google_business_profile',
      runKind: 'scheduled',
      status: 'succeeded',
      snapshotHash: 'h'.repeat(64),
      errorCode: null,
      errorMessage: null,
      startedAt: '2026-05-02T18:00:00.000Z',
      finishedAt: '2026-05-02T18:00:01.000Z',
      createdAt: '2026-05-02T18:00:00.000Z',
    },
    coreSnapshot: {},
    gbpSnapshot: {},
    foodMenusRefresh: {
      status: 'refreshed',
      projectionSnapshotId: 'projection-snapshot-1',
      googleSnapshotId: 'google-snapshot-1',
      googleFoodMenusHash: 'g'.repeat(64),
      importReviewCount: 2,
    },
    recompute: {
      evaluatedFieldKeys: ['profile.name', 'foodMenus.items.starters.item-1'],
      transitions: [{ fieldKey: 'profile.name', fromState: null, toState: 'in_sync' }],
    },
  };
}

beforeEach(() => {
  refreshFromGoogleMock.mockReset();
  refreshFromGoogleMock.mockImplementation(async ({ restaurantId }) =>
    mockRefreshResult(restaurantId),
  );
});

describe('listRestaurantsWithLinkedGoogleBusinessProfile', () => {
  it('discovers linked Google Business Profile restaurants in oldest-pull order', async () => {
    const { chain, client } = makeClient([
      { restaurant_id: 'rest-1' },
      { restaurant_id: 'rest-1' },
      { restaurant_id: 'rest-2' },
      { restaurant_id: null },
    ]);

    const ids = await listRestaurantsWithLinkedGoogleBusinessProfile({ client, limit: 2 });

    expect(client.from).toHaveBeenCalledWith('restaurant_external_profiles');
    expect(chain.eq).toHaveBeenCalledWith('provider', 'google_business_profile');
    expect(chain.eq).toHaveBeenCalledWith('connection_status', 'linked');
    expect(chain.not).toHaveBeenCalledWith('restaurant_id', 'is', null);
    expect(chain.order).toHaveBeenCalledWith('last_pull_at', {
      ascending: true,
      nullsFirst: true,
    });
    expect(chain.limit).toHaveBeenCalledWith(8);
    expect(ids).toEqual(['rest-1', 'rest-2']);
  });
});

describe('runScheduledRefreshForRestaurant', () => {
  it('runs a scheduled dual-sync refresh for one restaurant', async () => {
    const { client } = makeClient([]);

    const summary = await runScheduledRefreshForRestaurant({
      client,
      restaurantId: RESTAURANT_ID,
    });

    expect(refreshFromGoogleMock).toHaveBeenCalledWith({
      client,
      restaurantId: RESTAURANT_ID,
      runKind: 'scheduled',
    });
    expect(summary).toMatchObject({
      restaurantId: RESTAURANT_ID,
      evaluatedFieldCount: 2,
      transitionCount: 1,
      foodMenusRefresh: { status: 'refreshed', importReviewCount: 2 },
    });
  });
});

describe('runScheduledRefreshForAllTenants', () => {
  it('returns discovery only in dry-run mode', async () => {
    const { client } = makeClient([{ restaurant_id: 'rest-1' }, { restaurant_id: 'rest-2' }]);

    const result = await runScheduledRefreshForAllTenants({
      client,
      dryRun: true,
    });

    expect(result).toMatchObject({
      restaurantsConsidered: 2,
      restaurantsProcessed: 0,
      restaurantIds: ['rest-1', 'rest-2'],
      summaries: [],
      errors: [],
      dryRun: true,
    });
    expect(refreshFromGoogleMock).not.toHaveBeenCalled();
  });

  it('refreshes each discovered restaurant and continues past tenant errors', async () => {
    const { client } = makeClient([{ restaurant_id: 'rest-1' }, { restaurant_id: 'rest-2' }]);
    refreshFromGoogleMock
      .mockImplementationOnce(async () => {
        throw new Error('credentials revoked');
      })
      .mockImplementationOnce(async ({ restaurantId }) => mockRefreshResult(restaurantId));
    const emit = vi.fn(async () => {});

    const result = await runScheduledRefreshForAllTenants({
      client,
      notifications: { emit },
    });

    expect(result.restaurantsConsidered).toBe(2);
    expect(result.restaurantsProcessed).toBe(1);
    expect(result.errors).toEqual([{ restaurantId: 'rest-1', message: 'credentials revoked' }]);
    expect(result.summaries.map((summary) => summary.restaurantId)).toEqual(['rest-2']);
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'tenant_run_failed',
        severity: 'error',
        restaurantId: 'rest-1',
        errorMessage: 'credentials revoked',
      }),
    );
  });
});
