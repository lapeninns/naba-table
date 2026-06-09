import { beforeEach, describe, expect, it, vi } from 'vitest';

const assertDualSyncRestaurantNotPausedMock = vi.hoisted(() => vi.fn());
const refreshFromGoogleWithoutLockMock = vi.hoisted(() => vi.fn());
const buildRegistryMock = vi.hoisted(() => vi.fn());
const ensureActiveFieldPolicyVersionMock = vi.hoisted(() => vi.fn());
const buildDecisionHashMock = vi.hoisted(() => vi.fn());
const getDualSyncRuntimeControlsMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/dual-sync/controls', () => ({
  assertDualSyncRestaurantNotPaused: assertDualSyncRestaurantNotPausedMock,
}));

vi.mock('@/server/dual-sync/refresh/service', () => ({
  refreshFromGoogleWithoutLock: refreshFromGoogleWithoutLockMock,
}));

vi.mock('@/server/dual-sync/registry', () => ({
  buildRegistry: buildRegistryMock,
}));

vi.mock('@/server/dual-sync/registry/field-policy-versions', () => ({
  ensureActiveFieldPolicyVersion: ensureActiveFieldPolicyVersionMock,
}));

vi.mock('@/server/dual-sync/publish/orchestrator-domain', () => ({
  buildDecisionHash: buildDecisionHashMock,
}));

vi.mock('@/server/dual-sync/runtime-controls', () => ({
  getDualSyncRuntimeControls: getDualSyncRuntimeControlsMock,
}));

import { preparePublishRuntimeContext } from '@/server/dual-sync/publish/orchestrator-runtime-context';

import type { DualSyncRunPublishInput } from '@/server/dual-sync/publish/types';
import type { DualSyncFieldConfig } from '@/server/dual-sync/registry';
import type { DualSyncCanonicalSnapshot } from '@/server/dual-sync/snapshots/types';
import type { DualSyncFieldPolicyVersion } from '@/server/dual-sync/types';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

const client = { from: vi.fn() } as unknown as SupabaseClient<Database>;
const registry = [
  { fieldKey: 'profile.businessDescription' },
] as unknown as ReadonlyArray<DualSyncFieldConfig>;
const runtimeControls = {
  importEnabled: true,
  exportEnabled: true,
  autoCandidatesEnabled: true,
  highRiskExportsEnabled: true,
  menuSyncEnabled: true,
  attributesSyncEnabled: true,
  scheduledRefreshEnabled: true,
};

function snapshot(overrides: Partial<DualSyncCanonicalSnapshot> = {}): DualSyncCanonicalSnapshot {
  return {
    profile: {
      name: 'Acme',
      businessDescription: 'Fresh food',
      contactPhone: null,
      address: '1 Main Street',
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
    foodMenus: { items: [] },
    ...overrides,
  };
}

function publishInput(overrides: Partial<DualSyncRunPublishInput> = {}): DualSyncRunPublishInput {
  return {
    restaurantId: 'rest-1',
    actorUserId: 'user-1',
    clientRequestId: 'client-1',
    decisions: [
      {
        fieldKey: 'profile.businessDescription',
        sectionKey: 'profile',
        action: 'export_to_google',
        pinnedCoreHash: 'core-field',
        pinnedGbpHash: 'gbp-field',
      },
    ],
    ...overrides,
  };
}

function fieldPolicyVersion(
  overrides: Partial<DualSyncFieldPolicyVersion> = {},
): DualSyncFieldPolicyVersion {
  return {
    id: 'policy-version-1',
    restaurantId: 'rest-1',
    provider: 'google_business_profile',
    versionLabel: 'active',
    policyHash: 'policy-hash',
    policySnapshot: {},
    fieldCount: 1,
    active: true,
    createdByUserId: 'user-1',
    activatedAt: '2026-05-22T08:00:00.000Z',
    createdAt: '2026-05-22T08:00:00.000Z',
    ...overrides,
  };
}

describe('preparePublishRuntimeContext', () => {
  beforeEach(() => {
    assertDualSyncRestaurantNotPausedMock.mockReset();
    assertDualSyncRestaurantNotPausedMock.mockResolvedValue(null);
    refreshFromGoogleWithoutLockMock.mockReset();
    refreshFromGoogleWithoutLockMock.mockResolvedValue(null);
    buildRegistryMock.mockReset();
    buildRegistryMock.mockReturnValue(registry);
    ensureActiveFieldPolicyVersionMock.mockReset();
    ensureActiveFieldPolicyVersionMock.mockResolvedValue(fieldPolicyVersion());
    buildDecisionHashMock.mockReset();
    buildDecisionHashMock.mockReturnValue('decision-hash');
    getDualSyncRuntimeControlsMock.mockReset();
    getDualSyncRuntimeControlsMock.mockReturnValue(runtimeControls);
  });

  it('builds runtime context without refreshing Google when refresh is disabled', async () => {
    const coreSnapshot = snapshot();
    const gbpSnapshot = snapshot({
      profile: { ...snapshot().profile, businessDescription: 'Google description' },
    });
    const readCoreSnapshot = vi.fn().mockResolvedValue(coreSnapshot);
    const readGbpSnapshot = vi.fn().mockResolvedValue(gbpSnapshot);
    const input = publishInput();

    const result = await preparePublishRuntimeContext({
      client,
      input,
      refreshGoogleBeforePublish: false,
      readCoreSnapshot,
      readGbpSnapshot,
    });

    expect(assertDualSyncRestaurantNotPausedMock).toHaveBeenCalledWith({
      client,
      restaurantId: 'rest-1',
    });
    expect(refreshFromGoogleWithoutLockMock).not.toHaveBeenCalled();
    expect(readCoreSnapshot).toHaveBeenCalledWith({ client, restaurantId: 'rest-1' });
    expect(readGbpSnapshot).toHaveBeenCalledWith({ client, restaurantId: 'rest-1' });
    expect(buildRegistryMock).toHaveBeenCalledWith({
      coreSnapshot,
      gbpSnapshot,
      includeCoreOnly: false,
    });
    expect(ensureActiveFieldPolicyVersionMock).toHaveBeenCalledWith({
      client,
      registry,
      restaurantId: 'rest-1',
      createdByUserId: 'user-1',
    });
    expect(buildDecisionHashMock).toHaveBeenCalledWith(input, 'policy-hash');
    expect(getDualSyncRuntimeControlsMock).toHaveBeenCalledWith({ restaurantId: 'rest-1' });
    expect(result).toMatchObject({
      restaurantId: 'rest-1',
      coreSnapshot,
      gbpSnapshot,
      registry,
      fieldPolicyVersion: expect.objectContaining({ id: 'policy-version-1' }),
      decisionHash: 'decision-hash',
      runtimeControls,
    });
    expect(result.readCoreSnapshot).toBe(readCoreSnapshot);
    expect(result.readGbpSnapshot).toBe(readGbpSnapshot);
  });

  it('refreshes Google after the pause guard and before reading snapshots when enabled', async () => {
    const order: string[] = [];
    assertDualSyncRestaurantNotPausedMock.mockImplementation(async () => {
      order.push('pause-guard');
    });
    refreshFromGoogleWithoutLockMock.mockImplementation(async () => {
      order.push('refresh');
    });
    const readCoreSnapshot = vi.fn().mockImplementation(async () => {
      order.push('read-core');
      return snapshot();
    });
    const readGbpSnapshot = vi.fn().mockImplementation(async () => {
      order.push('read-gbp');
      return snapshot();
    });

    await preparePublishRuntimeContext({
      client,
      input: publishInput({ actorUserId: null }),
      refreshGoogleBeforePublish: true,
      readCoreSnapshot,
      readGbpSnapshot,
    });

    expect(refreshFromGoogleWithoutLockMock).toHaveBeenCalledWith({
      client,
      restaurantId: 'rest-1',
      runKind: 'preflight',
      skipPull: false,
    });
    expect(ensureActiveFieldPolicyVersionMock).toHaveBeenCalledWith(
      expect.objectContaining({ createdByUserId: null }),
    );
    expect(order.slice(0, 2)).toEqual(['pause-guard', 'refresh']);
    expect(order).toContain('read-core');
    expect(order).toContain('read-gbp');
  });
});
