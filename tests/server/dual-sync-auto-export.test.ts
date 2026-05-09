import { beforeEach, describe, expect, it, vi } from 'vitest';

const listOpenOutboundCandidatesMock = vi.hoisted(() => vi.fn());
const listRestaurantsWithOpenOutboundCandidatesMock = vi.hoisted(() => vi.fn());
const runPublishMock = vi.hoisted(() => vi.fn());
const defaultDualSyncPortsMock = vi.hoisted(() => vi.fn(() => ({})));

vi.mock('@/server/dual-sync/outbound/candidates', () => ({
  listOpenOutboundCandidates: listOpenOutboundCandidatesMock,
  listRestaurantsWithOpenOutboundCandidates: listRestaurantsWithOpenOutboundCandidatesMock,
}));

vi.mock('@/server/dual-sync/publish/orchestrator', () => ({
  runPublish: runPublishMock,
}));

vi.mock('@/server/dual-sync/publish/ports', () => ({
  defaultDualSyncPorts: defaultDualSyncPortsMock,
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
  runPublishMock.mockReset();
  defaultDualSyncPortsMock.mockReset();
  defaultDualSyncPortsMock.mockReturnValue({});
  runPublishMock.mockResolvedValue({
    summary: {
      publishJobId: 'job-1',
      restaurantId: RESTAURANT_ID,
      totalDecisions: 0,
      succeededCount: 0,
      failedCount: 0,
      skippedCount: 0,
      operations: [],
      failures: [],
    },
  });
});

describe('runAutoExportForRestaurant', () => {
  it('returns an empty result when no candidates are open', async () => {
    listOpenOutboundCandidatesMock.mockResolvedValue([]);
    const result = await runAutoExportForRestaurant({ client, restaurantId: RESTAURANT_ID });
    expect(result.candidatesConsidered).toBe(0);
    expect(result.decisionsExecuted).toBe(0);
    expect(result.publishResult).toBeNull();
    expect(runPublishMock).not.toHaveBeenCalled();
  });

  it('translates open candidates into export decisions and runs publish', async () => {
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

    expect(runPublishMock).toHaveBeenCalledTimes(1);
    const [, publishInput] = runPublishMock.mock.calls[0] ?? [];
    expect(publishInput?.restaurantId).toBe(RESTAURANT_ID);
    expect(publishInput?.actorUserId).toBeNull();
    expect(publishInput?.decisions).toEqual([
      expect.objectContaining({
        fieldKey: 'profile.name',
        sectionKey: 'profile',
        action: 'export_to_google',
        pinnedCoreHash: 'core-hash-1',
        pinnedGbpHash: 'gbp-hash-1',
      }),
      expect.objectContaining({
        fieldKey: 'operatingHours.weekly.1',
        sectionKey: 'operatingHours',
        action: 'export_to_google',
        pinnedCoreHash: 'core-hash-2',
        pinnedGbpHash: 'gbp-hash-2',
      }),
    ]);
    expect(result.candidatesConsidered).toBe(2);
    expect(result.decisionsExecuted).toBe(2);
    expect(result.publishResult).not.toBeNull();
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
    expect(runPublishMock).not.toHaveBeenCalled();
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
    expect(result.decisionsExecuted).toBe(2);
    const [, publishInput] = runPublishMock.mock.calls[0] ?? [];
    expect(publishInput?.decisions.map((d: { fieldKey: string }) => d.fieldKey)).toEqual([
      'profile.name',
      'profile.contactPhone',
    ]);
  });

  it('forwards actorUserId to the publish job', async () => {
    listOpenOutboundCandidatesMock.mockResolvedValue([makeCandidate()]);
    await runAutoExportForRestaurant({
      client,
      restaurantId: RESTAURANT_ID,
      actorUserId: 'user-42',
    });
    const [, publishInput] = runPublishMock.mock.calls[0] ?? [];
    expect(publishInput?.actorUserId).toBe('user-42');
  });

  it('honors injected publish ports for tests', async () => {
    listOpenOutboundCandidatesMock.mockResolvedValue([makeCandidate()]);
    const customPorts = { applyImportToCore: vi.fn(), applyExportToGoogle: vi.fn() };
    await runAutoExportForRestaurant({
      client,
      restaurantId: RESTAURANT_ID,
      publishOptions: { ports: customPorts },
    });
    const [, , publishOptions] = runPublishMock.mock.calls[0] ?? [];
    expect(publishOptions?.ports).toBe(customPorts);
    expect(defaultDualSyncPortsMock).not.toHaveBeenCalled();
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
    expect(runPublishMock).not.toHaveBeenCalled();
  });

  it('processes each discovered tenant via runAutoExportForRestaurant', async () => {
    listRestaurantsWithOpenOutboundCandidatesMock.mockResolvedValue(['rest-1', 'rest-2']);
    listOpenOutboundCandidatesMock.mockImplementation(({ restaurantId }) => {
      const cand = makeCandidate({ id: `cand-${restaurantId}` });
      return Promise.resolve([{ ...cand, restaurantId }]);
    });
    const result = await runAutoExportForAllTenants({ client });
    expect(result.restaurantsConsidered).toBe(2);
    expect(result.restaurantsProcessed).toBe(2);
    expect(result.summaries.map((s) => s.restaurantId)).toEqual(['rest-1', 'rest-2']);
    expect(runPublishMock).toHaveBeenCalledTimes(2);
  });

  it('skips publish when dryRun is true', async () => {
    listRestaurantsWithOpenOutboundCandidatesMock.mockResolvedValue(['rest-1', 'rest-2']);
    const result = await runAutoExportForAllTenants({ client, dryRun: true });
    expect(result.dryRun).toBe(true);
    expect(result.restaurantsConsidered).toBe(2);
    expect(result.restaurantsProcessed).toBe(0);
    expect(result.summaries).toEqual([]);
    expect(listOpenOutboundCandidatesMock).not.toHaveBeenCalled();
    expect(runPublishMock).not.toHaveBeenCalled();
  });

  it('forwards maxRestaurants and maxCandidatesPerRestaurant to the discovery + per-tenant runner', async () => {
    listRestaurantsWithOpenOutboundCandidatesMock.mockResolvedValue(['rest-1']);
    listOpenOutboundCandidatesMock.mockResolvedValue([
      makeCandidate({ id: 'cand-a' }),
      makeCandidate({ id: 'cand-b', fieldKey: 'profile.contactPhone' }),
    ]);
    await runAutoExportForAllTenants({
      client,
      maxRestaurants: 5,
      maxCandidatesPerRestaurant: 1,
    });
    const discoveryCall = listRestaurantsWithOpenOutboundCandidatesMock.mock.calls[0]?.[0];
    expect(discoveryCall?.limit).toBe(5);
    const [, publishInput] = runPublishMock.mock.calls[0] ?? [];
    expect(publishInput?.decisions).toHaveLength(1);
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

  it('emits a tenant_run_partial notification when a tenant publish has failed operations', async () => {
    listRestaurantsWithOpenOutboundCandidatesMock.mockResolvedValue(['rest-1']);
    listOpenOutboundCandidatesMock.mockResolvedValue([makeCandidate({ id: 'cand-x' })]);
    runPublishMock.mockResolvedValueOnce({
      summary: {
        publishJobId: 'job-rest-1',
        restaurantId: 'rest-1',
        totalDecisions: 2,
        succeededCount: 1,
        failedCount: 1,
        skippedCount: 0,
        operations: [
          { status: 'succeeded', errorCode: null },
          { status: 'failed', errorCode: 'PORT_FAILURE' },
        ],
        failures: [],
      },
    });
    const emit = vi.fn(async () => {});
    await runAutoExportForAllTenants({ client, notifications: { emit } });
    expect(emit).toHaveBeenCalledTimes(1);
    const [event] = emit.mock.calls[0]!;
    expect(event).toMatchObject({
      kind: 'tenant_run_partial',
      severity: 'warning',
      restaurantId: 'rest-1',
      publishJobId: 'job-rest-1',
      errorCode: 'PORT_FAILURE',
      counts: { succeeded: 1, failed: 1, skipped: 0, other: 0 },
    });
  });

  it('emits no notification when a tenant publish fully succeeds', async () => {
    listRestaurantsWithOpenOutboundCandidatesMock.mockResolvedValue(['rest-1']);
    listOpenOutboundCandidatesMock.mockResolvedValue([makeCandidate({ id: 'cand-x' })]);
    runPublishMock.mockResolvedValueOnce({
      summary: {
        publishJobId: 'job-rest-1',
        restaurantId: 'rest-1',
        totalDecisions: 1,
        succeededCount: 1,
        failedCount: 0,
        skippedCount: 0,
        operations: [{ status: 'succeeded', errorCode: null }],
        failures: [],
      },
    });
    const emit = vi.fn(async () => {});
    await runAutoExportForAllTenants({ client, notifications: { emit } });
    expect(emit).not.toHaveBeenCalled();
  });
});
