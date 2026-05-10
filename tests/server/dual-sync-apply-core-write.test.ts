import { beforeEach, describe, expect, it, vi } from 'vitest';

const upsertOutboundCandidateMock = vi.hoisted(() => vi.fn());
const upsertFieldStateMock = vi.hoisted(() => vi.fn());
const readFieldStateMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/dual-sync/outbound/candidates', () => ({
  upsertOutboundCandidate: upsertOutboundCandidateMock,
}));

vi.mock('@/server/dual-sync/state/write', () => ({
  upsertFieldState: upsertFieldStateMock,
}));

vi.mock('@/server/dual-sync/state/read', () => ({
  readFieldState: readFieldStateMock,
}));

import { applyCoreWriteSideEffects } from '@/server/dual-sync/core-writes/apply';

import type { DualSyncCanonicalSnapshot } from '@/server/dual-sync/snapshots/types';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

const RESTAURANT_ID = 'rest-1';
const client = { from: vi.fn() } as unknown as SupabaseClient<Database>;

function makeSnapshot(over: Partial<DualSyncCanonicalSnapshot> = {}): DualSyncCanonicalSnapshot {
  const base: DualSyncCanonicalSnapshot = {
    profile: {
      name: 'Acme Bistro',
      businessDescription: 'Delicious meals',
      contactPhone: null,
      address: '123 Main St, Anytown',
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
  };
  return { ...base, ...over };
}

describe('applyCoreWriteSideEffects', () => {
  beforeEach(() => {
    upsertOutboundCandidateMock.mockReset();
    upsertFieldStateMock.mockReset();
    readFieldStateMock.mockReset();
    readFieldStateMock.mockResolvedValue(null);
  });

  it('is a no-op when before and after snapshots are identical', async () => {
    const snap = makeSnapshot();
    const result = await applyCoreWriteSideEffects({
      client,
      restaurantId: RESTAURANT_ID,
      before: snap,
      after: snap,
    });

    expect(result.changedFieldKeys).toEqual([]);
    expect(upsertOutboundCandidateMock).not.toHaveBeenCalled();
    expect(upsertFieldStateMock).not.toHaveBeenCalled();
  });

  it('queues outbound candidate and marks core_dirty when no Google baseline exists', async () => {
    readFieldStateMock.mockResolvedValue(null);
    const before = makeSnapshot();
    const after = makeSnapshot({
      profile: {
        ...before.profile,
        businessDescription: 'Brand new tagline',
      },
    });

    const result = await applyCoreWriteSideEffects({
      client,
      restaurantId: RESTAURANT_ID,
      before,
      after,
      actorUserId: 'user-1',
    });

    expect(result.changedFieldKeys).toContain('profile.businessDescription');

    expect(upsertOutboundCandidateMock).toHaveBeenCalledTimes(1);
    expect(upsertOutboundCandidateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        restaurantId: RESTAURANT_ID,
        sectionKey: 'profile',
        fieldKey: 'profile.businessDescription',
        source: 'core_write',
        createdByUserId: 'user-1',
        baselineGbpHash: null,
      }),
    );

    expect(upsertFieldStateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        fieldKey: 'profile.businessDescription',
        state: 'core_dirty',
      }),
    );
  });

  it('marks pending_export when a previous lastInSyncHash exists', async () => {
    readFieldStateMock.mockResolvedValue({
      id: 'state-1',
      restaurantId: RESTAURANT_ID,
      provider: 'google_business_profile',
      sectionKey: 'profile',
      fieldKey: 'profile.businessDescription',
      state: 'in_sync',
      coreValueHash: 'before-hash',
      gbpValueHash: 'gbp-hash',
      lastInSyncHash: 'before-hash',
      lastCoreChangeAt: null,
      lastGbpChangeAt: null,
      lastInSyncAt: '2026-04-29T00:00:00.000Z',
      lastSnapshotRunId: null,
      metadata: {},
      createdAt: '2026-04-29T00:00:00.000Z',
      updatedAt: '2026-04-29T00:00:00.000Z',
    });

    const before = makeSnapshot();
    const after = makeSnapshot({
      profile: {
        ...before.profile,
        businessDescription: 'Updated description',
      },
    });

    await applyCoreWriteSideEffects({
      client,
      restaurantId: RESTAURANT_ID,
      before,
      after,
    });

    expect(upsertFieldStateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        fieldKey: 'profile.businessDescription',
        state: 'pending_export',
      }),
    );
    expect(upsertOutboundCandidateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        baselineGbpHash: 'gbp-hash',
      }),
    );
  });

  it('skips fields whose canonical hash did not change', async () => {
    const before = makeSnapshot({
      profile: {
        name: 'Acme Bistro',
        businessDescription: '   Delicious meals   ',
        contactPhone: null,
        address: '123 Main St, Anytown',
        storefrontAddress: null,
        googleMapUrl: null,
        googleReviewUrl: null,
      },
    });
    const after = makeSnapshot({
      profile: {
        ...before.profile,
        businessDescription: 'Delicious meals',
      },
    });

    const result = await applyCoreWriteSideEffects({
      client,
      restaurantId: RESTAURANT_ID,
      before,
      after,
    });

    expect(result.changedFieldKeys).toEqual([]);
  });

  it('detects changes in operating hours per-day', async () => {
    const before = makeSnapshot({
      operatingHours: {
        weekly: [
          { dayOfWeek: 0, opensAt: '09:00', closesAt: '17:00', isClosed: false },
          { dayOfWeek: 1, opensAt: '09:00', closesAt: '17:00', isClosed: false },
        ],
      },
    });
    const after = makeSnapshot({
      operatingHours: {
        weekly: [
          { dayOfWeek: 0, opensAt: '09:00', closesAt: '17:00', isClosed: false },
          { dayOfWeek: 1, opensAt: '08:00', closesAt: '17:00', isClosed: false },
        ],
      },
    });

    const result = await applyCoreWriteSideEffects({
      client,
      restaurantId: RESTAURANT_ID,
      before,
      after,
    });

    expect(result.changedFieldKeys).toContain('operatingHours.weekly.1');
    expect(result.changedFieldKeys).not.toContain('operatingHours.weekly.0');
  });
});
