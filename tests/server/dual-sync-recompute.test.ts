import { beforeEach, describe, expect, it, vi } from 'vitest';

const upsertFieldStateMock = vi.hoisted(() => vi.fn());
const listFieldStatesMock = vi.hoisted(() => vi.fn());
const listOpenOutboundCandidatesMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/dual-sync/state/write', () => ({
  upsertFieldState: upsertFieldStateMock,
}));

vi.mock('@/server/dual-sync/state/read', () => ({
  listFieldStates: listFieldStatesMock,
}));

vi.mock('@/server/dual-sync/outbound/candidates', () => ({
  listOpenOutboundCandidates: listOpenOutboundCandidatesMock,
}));

import { recomputeAllStates } from '@/server/dual-sync/state/recompute';

import type { DualSyncCanonicalSnapshot } from '@/server/dual-sync/snapshots/types';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

const RESTAURANT_ID = 'rest-1';
const client = { from: vi.fn() } as unknown as SupabaseClient<Database>;

function makeSnapshot(over: Partial<DualSyncCanonicalSnapshot> = {}): DualSyncCanonicalSnapshot {
  return {
    profile: {
      name: 'Acme',
      businessDescription: 'Tasty',
      contactPhone: null,
      address: '1 Main',
      storefrontAddress: null,
      googleMapUrl: null,
      googleReviewUrl: null,
    },
    operatingHours: { weekly: [] },
    servicePeriods: { periods: [] },
    businessContext: {
      categories: [],
      serviceAreas: [],
      attributes: [],
      serviceItems: [],
    },
    ...over,
  };
}

describe('recomputeAllStates', () => {
  beforeEach(() => {
    upsertFieldStateMock.mockReset();
    listFieldStatesMock.mockResolvedValue([]);
    listOpenOutboundCandidatesMock.mockResolvedValue([]);
  });

  it('marks every registry field in_sync when both snapshots match', async () => {
    const snap = makeSnapshot();

    const result = await recomputeAllStates({
      client,
      restaurantId: RESTAURANT_ID,
      coreSnapshot: snap,
      gbpSnapshot: snap,
      includeCoreOnly: false,
    });

    const states = result.transitions.map((t) => t.toState);
    expect(states.length).toBeGreaterThan(0);
    expect(states.every((s) => s === 'in_sync')).toBe(true);
    expect(upsertFieldStateMock).toHaveBeenCalled();
  });

  it('marks unsupported for core-only fields when included', async () => {
    const snap = makeSnapshot();

    const result = await recomputeAllStates({
      client,
      restaurantId: RESTAURANT_ID,
      coreSnapshot: snap,
      gbpSnapshot: snap,
      includeCoreOnly: true,
    });

    const coreOnlyTransitions = result.transitions.filter((t) =>
      t.fieldKey.startsWith('core.'),
    );
    expect(coreOnlyTransitions.length).toBeGreaterThan(0);
    expect(coreOnlyTransitions.every((t) => t.toState === 'unsupported')).toBe(true);
  });

  it('detects drift between core and gbp values when there is no prior in-sync hash', async () => {
    const core = makeSnapshot();
    const gbp = makeSnapshot({
      profile: {
        ...core.profile,
        businessDescription: 'Different',
      },
    });

    const result = await recomputeAllStates({
      client,
      restaurantId: RESTAURANT_ID,
      coreSnapshot: core,
      gbpSnapshot: gbp,
      includeCoreOnly: false,
    });

    const description = result.transitions.find(
      (t) => t.fieldKey === 'profile.businessDescription',
    );
    expect(description).toBeDefined();
    // No in-sync baseline + open candidate absent → 'drifted'.
    expect(['drifted']).toContain(description?.toState);
  });

  it('overlays pending_export when an open outbound candidate exists for an exportable field', async () => {
    const core = makeSnapshot();
    const gbp = makeSnapshot({
      profile: {
        ...core.profile,
        businessDescription: 'Different',
      },
    });

    listOpenOutboundCandidatesMock.mockResolvedValue([
      {
        id: 'cand-1',
        restaurantId: RESTAURANT_ID,
        provider: 'google_business_profile',
        sectionKey: 'profile',
        fieldKey: 'profile.businessDescription',
        proposedValue: 'Tasty',
        proposedValueHash: 'p',
        baselineGbpHash: null,
        status: 'open',
        source: 'core_write',
        createdByUserId: null,
        resolvedAt: null,
        createdAt: '2026-04-29T00:00:00.000Z',
        updatedAt: '2026-04-29T00:00:00.000Z',
      },
    ]);

    const result = await recomputeAllStates({
      client,
      restaurantId: RESTAURANT_ID,
      coreSnapshot: core,
      gbpSnapshot: gbp,
      includeCoreOnly: false,
    });

    const description = result.transitions.find(
      (t) => t.fieldKey === 'profile.businessDescription',
    );
    expect(description?.toState).toBe('pending_export');
  });

  it('preserves ignored state when previous state was ignored', async () => {
    const core = makeSnapshot();
    const gbp = makeSnapshot({
      profile: {
        ...core.profile,
        businessDescription: 'Other',
      },
    });

    listFieldStatesMock.mockResolvedValue([
      {
        id: 'st-1',
        restaurantId: RESTAURANT_ID,
        provider: 'google_business_profile',
        sectionKey: 'profile',
        fieldKey: 'profile.businessDescription',
        state: 'ignored',
        coreValueHash: 'c',
        gbpValueHash: 'g',
        lastInSyncHash: null,
        lastCoreChangeAt: null,
        lastGbpChangeAt: null,
        lastInSyncAt: null,
        lastSnapshotRunId: null,
        metadata: {},
        createdAt: '2026-04-29T00:00:00.000Z',
        updatedAt: '2026-04-29T00:00:00.000Z',
      },
    ]);

    const result = await recomputeAllStates({
      client,
      restaurantId: RESTAURANT_ID,
      coreSnapshot: core,
      gbpSnapshot: gbp,
      includeCoreOnly: false,
    });

    const description = result.transitions.find(
      (t) => t.fieldKey === 'profile.businessDescription',
    );
    expect(description?.toState).toBe('ignored');
  });
});
