import { beforeEach, describe, expect, it, vi } from 'vitest';

const listOpenOutboundCandidatesMock = vi.hoisted(() => vi.fn());
const listRestaurantsWithOpenOutboundCandidatesMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/dual-sync/outbound/candidates', () => ({
  listOpenOutboundCandidates: listOpenOutboundCandidatesMock,
  listRestaurantsWithOpenOutboundCandidates: listRestaurantsWithOpenOutboundCandidatesMock,
}));

import {
  runAutoExportForAllTenants,
  runAutoExportForRestaurant,
} from '@/server/dual-sync/scheduling/auto-export';

import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

const RESTAURANT_ID = 'rest-1';
const client = { from: vi.fn() } as unknown as SupabaseClient<Database>;

function makeCandidate(
  over: Partial<{
    id: string;
    fieldKey: string;
    sectionKey: string;
    proposedValueHash: string | null;
    baselineGbpHash: string | null;
  }> = {},
) {
  return {
    id: over.id ?? 'cand-1',
    restaurantId: RESTAURANT_ID,
    provider: 'google_business_profile',
    sectionKey: over.sectionKey ?? 'profile',
    fieldKey: over.fieldKey ?? 'profile.name',
    proposedValue: { name: 'Acme' },
    proposedValueHash:
      'proposedValueHash' in over ? (over.proposedValueHash ?? null) : 'core-hash-1',
    baselineGbpHash: 'baselineGbpHash' in over ? (over.baselineGbpHash ?? null) : 'gbp-hash-1',
    status: 'open' as const,
    source: 'core_write' as const,
    createdByUserId: null,
    resolvedAt: null,
    createdAt: '2026-04-30T00:00:00Z',
    updatedAt: '2026-04-30T00:00:00Z',
  };
}

beforeEach(() => {
  listOpenOutboundCandidatesMock.mockReset();
  listRestaurantsWithOpenOutboundCandidatesMock.mockReset();
});

describe('runAutoExportForRestaurant', () => {
  it('returns an empty result when no candidates are open', async () => {
    listOpenOutboundCandidatesMock.mockResolvedValue([]);
    const result = await runAutoExportForRestaurant({ client, restaurantId: RESTAURANT_ID });
    expect(result.candidatesConsidered).toBe(0);
    expect(result.decisionsExecuted).toBe(0);
    expect(result.publishResult).toBeNull();
  });

  it('discovers eligible candidates without publishing or creating a mutation job', async () => {
    listOpenOutboundCandidatesMock.mockResolvedValue([
      makeCandidate({ id: 'cand-a', fieldKey: 'profile.name' }),
      makeCandidate({
        id: 'cand-b',
        fieldKey: 'operatingHours.weekly.1',
        sectionKey: 'operatingHours',
        proposedValueHash: 'core-hash-2',
        baselineGbpHash: 'gbp-hash-2',
      }),
    ]);

    const result = await runAutoExportForRestaurant({ client, restaurantId: RESTAURANT_ID });

    expect(result.candidatesConsidered).toBe(2);
    expect(result.decisionsExecuted).toBe(0);
    expect(result.publishResult).toBeNull();
    expect(result.skipped).toEqual([]);
  });

  it('skips candidates without a baseline GBP hash and does not call publish if none remain', async () => {
    listOpenOutboundCandidatesMock.mockResolvedValue([
      makeCandidate({ id: 'cand-no-baseline', baselineGbpHash: null }),
    ]);
    const result = await runAutoExportForRestaurant({ client, restaurantId: RESTAURANT_ID });
    expect(result.candidatesConsidered).toBe(1);
    expect(result.decisionsExecuted).toBe(0);
    expect(result.skipped).toEqual([
      { candidateId: 'cand-no-baseline', fieldKey: 'profile.name', reason: 'no_baseline' },
    ]);
  });

  it('respects maxCandidates and only considers the first N', async () => {
    listOpenOutboundCandidatesMock.mockResolvedValue([
      makeCandidate({ id: 'cand-a', fieldKey: 'profile.name' }),
      makeCandidate({ id: 'cand-b', fieldKey: 'profile.contactPhone' }),
      makeCandidate({ id: 'cand-c', fieldKey: 'profile.address' }),
    ]);
    const result = await runAutoExportForRestaurant({
      client,
      restaurantId: RESTAURANT_ID,
      maxCandidates: 2,
    });
    expect(result.candidatesConsidered).toBe(2);
    expect(result.decisionsExecuted).toBe(0);
  });

  it('accepts a legacy actor attribution without publishing', async () => {
    listOpenOutboundCandidatesMock.mockResolvedValue([makeCandidate()]);
    const result = await runAutoExportForRestaurant({
      client,
      restaurantId: RESTAURANT_ID,
      actorUserId: 'user-42',
    });
    expect(result.decisionsExecuted).toBe(0);
    expect(result.publishResult).toBeNull();
  });
});

describe('runAutoExportForAllTenants', () => {
  it('returns an empty fan-out when no tenants have open candidates', async () => {
    listRestaurantsWithOpenOutboundCandidatesMock.mockResolvedValue([]);
    const result = await runAutoExportForAllTenants({ client });
    expect(result.restaurantsConsidered).toBe(0);
    expect(result.restaurantsProcessed).toBe(0);
    expect(result.summaries).toEqual([]);
    expect(result.errors).toEqual([]);
    expect(result.dryRun).toBe(false);
    expect(listOpenOutboundCandidatesMock).not.toHaveBeenCalled();
  });

  it('discovers candidates for each tenant without publishing', async () => {
    listRestaurantsWithOpenOutboundCandidatesMock.mockResolvedValue(['rest-1', 'rest-2']);
    listOpenOutboundCandidatesMock.mockImplementation(({ restaurantId }) => {
      const cand = makeCandidate({ id: `cand-${restaurantId}` });
      return Promise.resolve([{ ...cand, restaurantId }]);
    });
    const result = await runAutoExportForAllTenants({ client });
    expect(result.restaurantsConsidered).toBe(2);
    expect(result.restaurantsProcessed).toBe(2);
    expect(result.summaries.map((s) => s.restaurantId)).toEqual(['rest-1', 'rest-2']);
    expect(result.summaries.every((summary) => summary.decisionsExecuted === 0)).toBe(true);
    expect(result.summaries.every((summary) => summary.publishResult === null)).toBe(true);
  });

  it('still discovers candidates when dryRun is true because discovery is non-mutating', async () => {
    listRestaurantsWithOpenOutboundCandidatesMock.mockResolvedValue(['rest-1', 'rest-2']);
    listOpenOutboundCandidatesMock.mockResolvedValue([makeCandidate()]);
    const result = await runAutoExportForAllTenants({ client, dryRun: true });
    expect(result.dryRun).toBe(true);
    expect(result.restaurantsConsidered).toBe(2);
    expect(result.restaurantsProcessed).toBe(2);
    expect(result.summaries).toHaveLength(2);
  });

  it('forwards maxRestaurants and maxCandidatesPerRestaurant to the discovery + per-tenant runner', async () => {
    listRestaurantsWithOpenOutboundCandidatesMock.mockResolvedValue(['rest-1']);
    listOpenOutboundCandidatesMock.mockResolvedValue([
      makeCandidate({ id: 'cand-a' }),
      makeCandidate({ id: 'cand-b', fieldKey: 'profile.contactPhone' }),
    ]);
    const result = await runAutoExportForAllTenants({
      client,
      maxRestaurants: 5,
      maxCandidatesPerRestaurant: 1,
    });
    const discoveryCall = listRestaurantsWithOpenOutboundCandidatesMock.mock.calls[0]?.[0];
    expect(discoveryCall?.limit).toBe(5);
    expect(result.summaries[0]?.candidatesConsidered).toBe(1);
  });

  it('continues past tenants that throw and records the error', async () => {
    listRestaurantsWithOpenOutboundCandidatesMock.mockResolvedValue(['rest-1', 'rest-2']);
    listOpenOutboundCandidatesMock
      .mockImplementationOnce(() => {
        throw new Error('rest-1 blew up');
      })
      .mockImplementationOnce(() => Promise.resolve([makeCandidate({ id: 'cand-2' })]));
    const result = await runAutoExportForAllTenants({ client });
    expect(result.errors).toEqual([{ restaurantId: 'rest-1', message: 'rest-1 blew up' }]);
    expect(result.summaries.map((s) => s.restaurantId)).toEqual(['rest-2']);
    expect(result.restaurantsProcessed).toBe(1);
  });

  it('rethrows when onError is "throw"', async () => {
    listRestaurantsWithOpenOutboundCandidatesMock.mockResolvedValue(['rest-1', 'rest-2']);
    listOpenOutboundCandidatesMock.mockImplementationOnce(() => {
      throw new Error('boom');
    });
    await expect(runAutoExportForAllTenants({ client, onError: 'throw' })).rejects.toThrow('boom');
  });

  it('emits a tenant_run_failed notification when a tenant throws', async () => {
    listRestaurantsWithOpenOutboundCandidatesMock.mockResolvedValue(['rest-1']);
    listOpenOutboundCandidatesMock.mockImplementationOnce(() => {
      throw new Error('credentials revoked');
    });
    const emit = vi.fn(async () => {});
    await runAutoExportForAllTenants({ client, notifications: { emit } });
    expect(emit).toHaveBeenCalledTimes(1);
    const [event] = emit.mock.calls[0]!;
    expect(event).toMatchObject({
      kind: 'tenant_run_failed',
      severity: 'error',
      restaurantId: 'rest-1',
      errorMessage: 'credentials revoked',
    });
  });

  it('emits no notification when candidate discovery succeeds', async () => {
    listRestaurantsWithOpenOutboundCandidatesMock.mockResolvedValue(['rest-1']);
    listOpenOutboundCandidatesMock.mockResolvedValue([makeCandidate({ id: 'cand-x' })]);
    const emit = vi.fn(async () => {});
    await runAutoExportForAllTenants({ client, notifications: { emit } });
    expect(emit).not.toHaveBeenCalled();
  });
});
