import { beforeEach, describe, expect, it, vi } from 'vitest';

const buildPublishPlanMock = vi.hoisted(() => vi.fn());
const createPublishBatchMock = vi.hoisted(() => vi.fn());
const createOperationGroupsForPlanMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/dual-sync/publish/planner', () => ({
  buildPublishPlan: buildPublishPlanMock,
}));

vi.mock('@/server/dual-sync/publish/operations', () => ({
  createPublishBatch: createPublishBatchMock,
  createOperationGroupsForPlan: createOperationGroupsForPlanMock,
}));

import { initializePublishBatch } from '@/server/dual-sync/publish/orchestrator-batch-initialization';

import type {
  DualSyncPublishDecision,
  DualSyncPublishGroup,
  DualSyncPublishPlan,
  DualSyncRunPublishInput,
} from '@/server/dual-sync/publish/types';
import type { DualSyncCanonicalSnapshot } from '@/server/dual-sync/snapshots/types';
import type { DualSyncPublishBatch, DualSyncPublishOperationGroup } from '@/server/dual-sync/types';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

const client = { from: vi.fn() } as unknown as SupabaseClient<Database>;

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

function decision(overrides: Partial<DualSyncPublishDecision> = {}): DualSyncPublishDecision {
  return {
    fieldKey: 'profile.businessDescription',
    sectionKey: 'profile',
    action: 'export_to_google',
    pinnedCoreHash: 'core-field',
    pinnedGbpHash: 'gbp-field',
    ...overrides,
  };
}

function group(overrides: Partial<DualSyncPublishGroup> = {}): DualSyncPublishGroup {
  return {
    groupId: 'export_to_google:profile:location.profile',
    direction: 'export_to_google',
    sectionKey: 'profile',
    writeGroup: 'location.profile',
    fields: [decision()],
    riskLevel: 'medium',
    requiresPreflight: false,
    requiresManualConfirmation: false,
    destructiveWritePossible: false,
    googleUpdateMasks: ['profile.description'],
    ...overrides,
  };
}

function plan(overrides: Partial<DualSyncPublishPlan> = {}): DualSyncPublishPlan {
  const groups = overrides.groups ?? [group()];
  return {
    restaurantId: 'rest-1',
    coreSnapshotHash: 'core-snapshot',
    gbpSnapshotHash: 'gbp-snapshot',
    groups,
    rejected: [],
    warnings: [],
    acceptedCount: groups.reduce((sum, item) => sum + item.fields.length, 0),
    rejectedCount: 0,
    ignoredCount: 0,
    ...overrides,
  };
}

function batch(overrides: Partial<DualSyncPublishBatch> = {}): DualSyncPublishBatch {
  return {
    id: 'batch-1',
    restaurantId: 'rest-1',
    provider: 'google_business_profile',
    clientRequestId: 'client-1',
    actorUserId: 'user-1',
    status: 'pending',
    decisionHash: 'decision-hash',
    pinnedCoreSnapshotHash: 'pinned-core',
    pinnedGbpSnapshotHash: null,
    coreSnapshotHash: 'core-snapshot',
    gbpSnapshotHash: 'gbp-snapshot',
    fieldPolicyVersionId: 'policy-version-1',
    fieldPolicyHash: 'policy-hash',
    acceptedCount: 1,
    rejectedCount: 0,
    ignoredCount: 0,
    planSummary: {},
    errorCode: null,
    errorMessage: null,
    startedAt: null,
    finishedAt: null,
    createdAt: '2026-05-22T08:00:00.000Z',
    updatedAt: '2026-05-22T08:00:00.000Z',
    ...overrides,
  };
}

function operationGroup(
  overrides: Partial<DualSyncPublishOperationGroup> = {},
): DualSyncPublishOperationGroup {
  return {
    id: 'group-1',
    restaurantId: 'rest-1',
    publishBatchId: 'batch-1',
    groupKey: 'export_to_google:profile:location.profile',
    sectionKey: 'profile',
    direction: 'export_to_google',
    writeGroup: 'location.profile',
    status: 'pending',
    riskLevel: 'medium',
    requiresPreflight: false,
    requiresManualConfirmation: false,
    destructiveWritePossible: false,
    googleUpdateMasks: ['profile.description'],
    decisionCount: 1,
    preflightStatus: null,
    preflightResult: null,
    requestSummary: null,
    responseSummary: null,
    errorCode: null,
    errorMessage: null,
    startedAt: null,
    finishedAt: null,
    createdAt: '2026-05-22T08:00:00.000Z',
    updatedAt: '2026-05-22T08:00:00.000Z',
    ...overrides,
  };
}

function publishInput(overrides: Partial<DualSyncRunPublishInput> = {}): DualSyncRunPublishInput {
  return {
    restaurantId: 'rest-1',
    actorUserId: 'user-1',
    clientRequestId: 'client-1',
    pinnedCoreSnapshotHash: 'pinned-core',
    pinnedGbpSnapshotHash: null,
    decisions: [decision()],
    ...overrides,
  };
}

describe('initializePublishBatch', () => {
  beforeEach(() => {
    buildPublishPlanMock.mockReset();
    createPublishBatchMock.mockReset();
    createOperationGroupsForPlanMock.mockReset();
  });

  it('builds the plan from supplied snapshots and persists batch metadata and groups', async () => {
    const coreSnapshot = snapshot();
    const gbpSnapshot = snapshot({
      profile: { ...snapshot().profile, businessDescription: 'GBP' },
    });
    const publishPlan = plan({
      warnings: [
        {
          code: 'PREFLIGHT_REQUIRED',
          groupId: 'export_to_google:profile:location.profile',
          message: 'profile requires preflight before publish.',
        },
      ],
    });
    buildPublishPlanMock.mockImplementation(async (_client, _input, options) => {
      expect(await options.readCoreSnapshot({ client, restaurantId: 'rest-1' })).toBe(coreSnapshot);
      expect(await options.readGbpSnapshot({ client, restaurantId: 'rest-1' })).toBe(gbpSnapshot);
      return publishPlan;
    });
    createPublishBatchMock.mockResolvedValue(batch());
    createOperationGroupsForPlanMock.mockResolvedValue([operationGroup()]);
    const input = publishInput();

    const result = await initializePublishBatch({
      client,
      input,
      decisionHash: 'decision-hash',
      fieldPolicyVersionId: 'policy-version-1',
      fieldPolicyHash: 'policy-hash',
      coreSnapshot,
      gbpSnapshot,
    });

    expect(buildPublishPlanMock).toHaveBeenCalledWith(
      client,
      input,
      expect.objectContaining({
        readCoreSnapshot: expect.any(Function),
        readGbpSnapshot: expect.any(Function),
      }),
    );
    expect(createPublishBatchMock).toHaveBeenCalledWith({
      client,
      restaurantId: 'rest-1',
      clientRequestId: 'client-1',
      actorUserId: 'user-1',
      decisionHash: 'decision-hash',
      pinnedCoreSnapshotHash: 'pinned-core',
      pinnedGbpSnapshotHash: null,
      coreSnapshotHash: 'core-snapshot',
      gbpSnapshotHash: 'gbp-snapshot',
      fieldPolicyVersionId: 'policy-version-1',
      fieldPolicyHash: 'policy-hash',
      acceptedCount: 1,
      rejectedCount: 0,
      ignoredCount: 0,
      planSummary: {
        groups: publishPlan.groups,
        rejected: [],
        warnings: publishPlan.warnings,
      },
    });
    expect(createOperationGroupsForPlanMock).toHaveBeenCalledWith({
      client,
      restaurantId: 'rest-1',
      publishBatchId: 'batch-1',
      groups: publishPlan.groups,
    });
    expect(result.plan).toBe(publishPlan);
    expect(result.publishBatch.id).toBe('batch-1');
    expect(result.publishJobId).toBe('batch-1');
    expect(result.operationGroups).toEqual([operationGroup()]);
    expect(result.operationGroupIdByKey.get('export_to_google:profile:location.profile')).toBe(
      'group-1',
    );
  });

  it('normalizes omitted optional pins and returns an empty group map when the plan has no groups', async () => {
    const publishPlan = plan({ groups: [], acceptedCount: 0, ignoredCount: 1 });
    buildPublishPlanMock.mockResolvedValue(publishPlan);
    createPublishBatchMock.mockResolvedValue(
      batch({
        clientRequestId: null,
        pinnedCoreSnapshotHash: null,
        pinnedGbpSnapshotHash: null,
        acceptedCount: 0,
        ignoredCount: 1,
      }),
    );
    createOperationGroupsForPlanMock.mockResolvedValue([]);

    const result = await initializePublishBatch({
      client,
      input: publishInput({
        clientRequestId: undefined,
        pinnedCoreSnapshotHash: undefined,
        pinnedGbpSnapshotHash: undefined,
      }),
      decisionHash: 'decision-hash',
      fieldPolicyVersionId: 'policy-version-1',
      fieldPolicyHash: null,
      coreSnapshot: snapshot(),
      gbpSnapshot: snapshot(),
    });

    expect(createPublishBatchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        clientRequestId: null,
        pinnedCoreSnapshotHash: null,
        pinnedGbpSnapshotHash: null,
        fieldPolicyHash: null,
        acceptedCount: 0,
        ignoredCount: 1,
      }),
    );
    expect(createOperationGroupsForPlanMock).toHaveBeenCalledWith(
      expect.objectContaining({ groups: [] }),
    );
    expect(result.operationGroups).toEqual([]);
    expect(result.operationGroupIdByKey.size).toBe(0);
  });
});
