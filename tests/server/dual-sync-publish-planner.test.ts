import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getDualSyncRestaurantControlMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/dual-sync/controls', () => ({
  getDualSyncRestaurantControl: getDualSyncRestaurantControlMock,
}));

import { hashCanonicalJson } from '@/server/dual-sync/hashing';
import { buildPublishPlan } from '@/server/dual-sync/publish/planner';

import type { DualSyncPublishDecision } from '@/server/dual-sync/publish/types';
import type { DualSyncCanonicalSnapshot } from '@/server/dual-sync/snapshots/types';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

const RESTAURANT_ID = 'rest-1';
const client = {} as SupabaseClient<Database>;

beforeEach(() => {
  getDualSyncRestaurantControlMock.mockReset();
  getDualSyncRestaurantControlMock.mockResolvedValue({
    restaurantId: RESTAURANT_ID,
    provider: 'google_business_profile',
    syncPaused: false,
    pauseReason: null,
    pausedByUserId: null,
    pausedAt: null,
    resumedAt: null,
    createdAt: null,
    updatedAt: null,
  });
});

afterEach(() => {
  delete process.env.GBP_EXPORT_ENABLED;
  delete process.env.GBP_HIGH_RISK_EXPORTS_ENABLED;
  delete process.env.GBP_MENU_SYNC_ENABLED;
});

function makeSnapshot(over: Partial<DualSyncCanonicalSnapshot> = {}): DualSyncCanonicalSnapshot {
  return {
    profile: {
      name: 'Acme',
      businessDescription: 'Tasty',
      contactPhone: '+44 1223 123456',
      address: '1 Main Street',
      storefrontAddress: null,
      googleMapUrl: 'https://maps.example/acme',
      googleReviewUrl: 'https://reviews.example/acme',
    },
    operatingHours: { weekly: [] },
    servicePeriods: { periods: [] },
    businessContext: {
      categories: [],
      serviceAreas: [],
      attributes: [],
      serviceItems: [],
    },
    foodMenus: { items: [] },
    ...over,
  };
}

function makeDecision(over: Partial<DualSyncPublishDecision> = {}): DualSyncPublishDecision {
  return {
    fieldKey: 'profile.businessDescription',
    sectionKey: 'profile',
    action: 'export_to_google',
    pinnedCoreHash: hashCanonicalJson('Tasty'),
    pinnedGbpHash: hashCanonicalJson('Tasty'),
    ...over,
  };
}

function buildPlan(decisions: ReadonlyArray<DualSyncPublishDecision>, actorUserId = 'user-1') {
  return buildPublishPlan(
    client,
    {
      restaurantId: RESTAURANT_ID,
      decisions,
      actorUserId,
    },
    {
      readCoreSnapshot: vi.fn(async () => makeSnapshot()),
      readGbpSnapshot: vi.fn(async () => makeSnapshot()),
    },
  );
}

describe('buildPublishPlan', () => {
  it('rejects the whole plan when restaurant sync is paused', async () => {
    getDualSyncRestaurantControlMock.mockResolvedValueOnce({
      restaurantId: RESTAURANT_ID,
      provider: 'google_business_profile',
      syncPaused: true,
      pauseReason: 'Maintenance window.',
      pausedByUserId: 'user-1',
      pausedAt: '2026-05-09T10:00:00.000Z',
      resumedAt: null,
      createdAt: '2026-05-09T10:00:00.000Z',
      updatedAt: '2026-05-09T10:00:00.000Z',
    });

    const plan = await buildPublishPlan(
      client,
      {
        restaurantId: RESTAURANT_ID,
        decisions: [makeDecision(), makeDecision({ fieldKey: 'profile.name' })],
        actorUserId: 'user-1',
      },
      {
        readCoreSnapshot: vi.fn(async () => makeSnapshot()),
        readGbpSnapshot: vi.fn(async () => makeSnapshot()),
      },
    );

    expect(plan.groups).toEqual([]);
    expect(plan.rejectedCount).toBe(2);
    expect(plan.rejected.every((entry) => entry.failure.code === 'SYNC_PAUSED')).toBe(true);
    expect(plan.rejected[0]?.failure.message).toBe('Maintenance window.');
  });

  it('groups accepted decisions by direction, section, and write group', async () => {
    const plan = await buildPlan([
      makeDecision({ fieldKey: 'profile.businessDescription', action: 'export_to_google' }),
      makeDecision({
        fieldKey: 'profile.name',
        action: 'export_to_google',
        pinnedCoreHash: hashCanonicalJson('acme'),
        pinnedGbpHash: hashCanonicalJson('acme'),
      }),
      makeDecision({
        fieldKey: 'profile.contactPhone',
        action: 'import_from_google',
        pinnedCoreHash: hashCanonicalJson('+441223123456'),
        pinnedGbpHash: hashCanonicalJson('+441223123456'),
      }),
      makeDecision({ action: 'ignore' }),
    ]);

    expect(plan.acceptedCount).toBe(3);
    expect(plan.ignoredCount).toBe(1);
    expect(plan.rejectedCount).toBe(0);
    expect(plan.groups).toHaveLength(2);
    expect(plan.groups[0]).toMatchObject({
      groupId: 'export_to_google:profile:location.profile',
      direction: 'export_to_google',
      sectionKey: 'profile',
      writeGroup: 'location.profile',
      riskLevel: 'critical',
      requiresPreflight: true,
      requiresManualConfirmation: true,
      destructiveWritePossible: true,
      googleUpdateMasks: ['profile', 'title'],
    });
    expect(plan.groups[0]?.fields.map((field) => field.fieldKey)).toEqual([
      'profile.businessDescription',
      'profile.name',
    ]);
    expect(plan.groups[1]).toMatchObject({
      groupId: 'import_from_google:profile:core.profile',
      direction: 'import_from_google',
      writeGroup: 'core.profile',
      requiresPreflight: false,
    });
    expect(plan.warnings.map((warning) => warning.code)).toEqual([
      'PREFLIGHT_REQUIRED',
      'HIGH_RISK',
      'DESTRUCTIVE_WRITE',
    ]);
  });

  it('rejects the whole plan when the pinned snapshot hash is stale', async () => {
    const coreSnapshot = makeSnapshot();
    const gbpSnapshot = makeSnapshot();

    const plan = await buildPublishPlan(
      client,
      {
        restaurantId: RESTAURANT_ID,
        decisions: [makeDecision(), makeDecision({ fieldKey: 'profile.name' })],
        actorUserId: 'user-1',
        pinnedCoreSnapshotHash: `${hashCanonicalJson(coreSnapshot)}-stale`,
      },
      {
        readCoreSnapshot: vi.fn(async () => coreSnapshot),
        readGbpSnapshot: vi.fn(async () => gbpSnapshot),
      },
    );

    expect(plan.groups).toEqual([]);
    expect(plan.rejectedCount).toBe(2);
    expect(plan.rejected).toEqual([
      expect.objectContaining({ fieldKey: 'profile.businessDescription' }),
      expect.objectContaining({ fieldKey: 'profile.name' }),
    ]);
    expect(plan.rejected.every((entry) => entry.failure.code === 'CORE_DRIFT')).toBe(true);
  });

  it('rejects section mismatches, stale field pins, unsupported writes, and automation review gaps', async () => {
    const coreSnapshot = makeSnapshot();
    const gbpSnapshot = makeSnapshot();

    const plan = await buildPublishPlan(
      client,
      {
        restaurantId: RESTAURANT_ID,
        decisions: [
          makeDecision({ sectionKey: 'operatingHours' }),
          makeDecision({ pinnedCoreHash: 'stale-core-hash' }),
          makeDecision({
            fieldKey: 'profile.googleMapUrl',
            pinnedCoreHash: hashCanonicalJson('https://maps.example/acme'),
            pinnedGbpHash: hashCanonicalJson('https://maps.example/acme'),
          }),
          makeDecision({
            fieldKey: 'profile.name',
            pinnedCoreHash: hashCanonicalJson('acme'),
            pinnedGbpHash: hashCanonicalJson('acme'),
          }),
        ],
        actorUserId: null,
      },
      {
        readCoreSnapshot: vi.fn(async () => coreSnapshot),
        readGbpSnapshot: vi.fn(async () => gbpSnapshot),
      },
    );

    expect(plan.acceptedCount).toBe(0);
    expect(plan.rejected.map((entry) => [entry.fieldKey, entry.failure.code])).toEqual([
      ['profile.businessDescription', 'INVALID_DECISION'],
      ['profile.businessDescription', 'CORE_DRIFT'],
      ['profile.googleMapUrl', 'UNSUPPORTED_FIELD'],
      ['profile.name', 'UNSUPPORTED_FIELD'],
    ]);
  });

  it('treats null field pins as expected absent values in preview planning', async () => {
    const plan = await buildPublishPlan(
      client,
      {
        restaurantId: RESTAURANT_ID,
        decisions: [
          makeDecision({
            action: 'export_to_google',
            pinnedCoreHash: null,
            pinnedGbpHash: hashCanonicalJson('Tasty'),
          }),
        ],
        actorUserId: 'user-1',
      },
      {
        readCoreSnapshot: vi.fn(async () => makeSnapshot()),
        readGbpSnapshot: vi.fn(async () => makeSnapshot()),
      },
    );

    expect(plan.groups).toEqual([]);
    expect(plan.rejected).toEqual([
      expect.objectContaining({
        fieldKey: 'profile.businessDescription',
        failure: expect.objectContaining({ code: 'CORE_DRIFT' }),
      }),
    ]);
  });

  it('does not treat null field pins as drift when the previewed value is still absent', async () => {
    const absentSnapshot = makeSnapshot({
      profile: {
        ...makeSnapshot().profile,
        businessDescription: null,
      },
    });

    const plan = await buildPublishPlan(
      client,
      {
        restaurantId: RESTAURANT_ID,
        decisions: [makeDecision({ action: 'ignore', pinnedCoreHash: null, pinnedGbpHash: null })],
        actorUserId: 'user-1',
      },
      {
        readCoreSnapshot: vi.fn(async () => absentSnapshot),
        readGbpSnapshot: vi.fn(async () => absentSnapshot),
      },
    );

    expect(plan.ignoredCount).toBe(1);
    expect(plan.rejected).toEqual([]);
  });

  it('rejects decisions disabled by production rollback flags before grouping', async () => {
    process.env.GBP_EXPORT_ENABLED = 'false';

    const plan = await buildPlan([
      makeDecision({ fieldKey: 'profile.businessDescription', action: 'export_to_google' }),
      makeDecision({
        fieldKey: 'profile.contactPhone',
        action: 'import_from_google',
        pinnedCoreHash: hashCanonicalJson('+441223123456'),
        pinnedGbpHash: hashCanonicalJson('+441223123456'),
      }),
    ]);

    expect(plan.acceptedCount).toBe(1);
    expect(plan.rejected).toEqual([
      expect.objectContaining({
        fieldKey: 'profile.businessDescription',
        failure: expect.objectContaining({
          code: 'UNSUPPORTED_FIELD',
          message: 'Google exports are disabled for this deployment.',
        }),
      }),
    ]);
    expect(plan.groups).toHaveLength(1);
    expect(plan.groups[0]).toMatchObject({
      direction: 'import_from_google',
      writeGroup: 'core.profile',
    });
  });
});
