import { beforeEach, describe, expect, it, vi } from 'vitest';

const createOperationMock = vi.hoisted(() => vi.fn());
const markIgnoredMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/dual-sync/publish/operations', () => ({
  createOperation: createOperationMock,
}));

vi.mock('@/server/dual-sync/state/write', () => ({
  markIgnored: markIgnoredMock,
}));

import { hashCanonicalJson } from '@/server/dual-sync/hashing';
import { valueForField } from '@/server/dual-sync/publish/orchestrator-domain';
import { preparePublishDecisions } from '@/server/dual-sync/publish/orchestrator-prepare-decisions';
import { buildRegistry, findFieldConfig } from '@/server/dual-sync/registry';

import type { DualSyncRuntimeControls } from '@/server/dual-sync/runtime-controls';
import type { DualSyncPublishDecision } from '@/server/dual-sync/publish/types';
import type { DualSyncCanonicalSnapshot } from '@/server/dual-sync/snapshots/types';
import type { DualSyncPublishOperation } from '@/server/dual-sync/types';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

const client = { from: vi.fn() } as unknown as SupabaseClient<Database>;

const runtimeControls: DualSyncRuntimeControls = {
  importEnabled: true,
  exportEnabled: true,
  autoCandidatesEnabled: true,
  highRiskExportsEnabled: true,
  menuSyncEnabled: true,
  attributesSyncEnabled: true,
  scheduledRefreshEnabled: true,
};

function makeSnapshot(
  overrides: Partial<DualSyncCanonicalSnapshot> = {},
): DualSyncCanonicalSnapshot {
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
    ...overrides,
  };
}

function makeOperation(
  overrides: Partial<DualSyncPublishOperation> = {},
): DualSyncPublishOperation {
  return {
    id: 'op-1',
    restaurantId: 'rest-1',
    publishJobId: 'job-1',
    publishBatchId: 'batch-1',
    operationGroupId: null,
    sectionKey: 'profile',
    fieldKey: 'profile.businessDescription',
    direction: 'export_to_google',
    status: 'pending',
    attemptCount: 0,
    beforeCoreHash: null,
    beforeGbpHash: null,
    afterCoreHash: null,
    afterGbpHash: null,
    googleUpdateMask: null,
    errorCode: null,
    errorMessage: null,
    externalResponse: null,
    startedAt: null,
    finishedAt: null,
    createdAt: '2026-05-22T00:00:00.000Z',
    updatedAt: '2026-05-22T00:00:00.000Z',
    ...overrides,
  };
}

function defaultPinsFor(
  fieldKey: string,
  snapshots: {
    readonly coreSnapshot: DualSyncCanonicalSnapshot;
    readonly gbpSnapshot: DualSyncCanonicalSnapshot;
  },
): Pick<DualSyncPublishDecision, 'pinnedCoreHash' | 'pinnedGbpHash'> {
  const registry = buildRegistry({
    coreSnapshot: snapshots.coreSnapshot,
    gbpSnapshot: snapshots.gbpSnapshot,
    includeCoreOnly: false,
  });
  const config = findFieldConfig(registry, fieldKey);
  if (!config) return { pinnedCoreHash: null, pinnedGbpHash: null };
  const coreValue = valueForField(snapshots.coreSnapshot, config, 'core');
  const gbpValue = valueForField(snapshots.gbpSnapshot, config, 'gbp');
  return {
    pinnedCoreHash: hashCanonicalJson(config.canonicalizeCoreValue(coreValue)),
    pinnedGbpHash: hashCanonicalJson(config.canonicalizeGbpValue(gbpValue)),
  };
}

function makeDecision(
  overrides: Partial<DualSyncPublishDecision> = {},
  snapshots = { coreSnapshot: makeSnapshot(), gbpSnapshot: makeSnapshot() },
): DualSyncPublishDecision {
  const base = {
    fieldKey: overrides.fieldKey ?? 'profile.businessDescription',
    sectionKey: overrides.sectionKey ?? 'profile',
    action: overrides.action ?? 'export_to_google',
  } satisfies Omit<DualSyncPublishDecision, 'pinnedCoreHash' | 'pinnedGbpHash'>;
  return {
    ...base,
    ...defaultPinsFor(base.fieldKey, snapshots),
    ...overrides,
  };
}

function makeInput(
  overrides: Partial<Parameters<typeof preparePublishDecisions>[0]> = {},
): Parameters<typeof preparePublishDecisions>[0] {
  const coreSnapshot = overrides.coreSnapshot ?? makeSnapshot();
  const gbpSnapshot = overrides.gbpSnapshot ?? makeSnapshot();
  const registry =
    overrides.registry ?? buildRegistry({ coreSnapshot, gbpSnapshot, includeCoreOnly: false });
  return {
    client,
    restaurantId: 'rest-1',
    publishJobId: 'job-1',
    publishBatchId: 'batch-1',
    decisions: [makeDecision({}, { coreSnapshot, gbpSnapshot })],
    registry,
    coreSnapshot,
    gbpSnapshot,
    preflightFailures: new Map(),
    operationGroupIdByKey: new Map([
      ['export_to_google:profile:location.profile', 'group-profile'],
      ['import_from_google:profile:core.profile', 'group-core-profile'],
    ]),
    runtimeControls,
    actorUserId: 'user-1',
    ...overrides,
  };
}

describe('preparePublishDecisions', () => {
  beforeEach(() => {
    createOperationMock.mockReset();
    createOperationMock.mockImplementation(async (input) =>
      makeOperation({
        publishJobId: input.publishJobId,
        publishBatchId: input.publishBatchId,
        operationGroupId: input.operationGroupId,
        sectionKey: input.sectionKey,
        fieldKey: input.fieldKey,
        direction: input.direction,
        beforeCoreHash: input.beforeCoreHash,
        beforeGbpHash: input.beforeGbpHash,
        googleUpdateMask: input.googleUpdateMask,
      }),
    );
    markIgnoredMock.mockReset();
    markIgnoredMock.mockResolvedValue(undefined);
  });

  it('rejects unknown fields without opening operation rows', async () => {
    const result = await preparePublishDecisions(
      makeInput({
        decisions: [
          {
            fieldKey: 'profile.unknown',
            sectionKey: 'profile',
            action: 'export_to_google',
            pinnedCoreHash: null,
            pinnedGbpHash: null,
          },
        ],
      }),
    );

    expect(result.prepared).toEqual([]);
    expect(result.failures).toEqual([
      {
        fieldKey: 'profile.unknown',
        failure: {
          code: 'INVALID_DECISION',
          message: 'Unknown field key profile.unknown.',
          retryable: false,
        },
      },
    ]);
    expect(createOperationMock).not.toHaveBeenCalled();
  });

  it('passes through preflight failures before operation creation', async () => {
    const decision = makeDecision();
    const result = await preparePublishDecisions(
      makeInput({
        decisions: [decision],
        preflightFailures: new Map([
          [
            decision.fieldKey,
            {
              code: 'GOOGLE_VALIDATION_FAILED',
              message: 'Preflight failed.',
              retryable: false,
            },
          ],
        ]),
      }),
    );

    expect(result.prepared).toEqual([]);
    expect(result.failures[0]).toMatchObject({
      fieldKey: 'profile.businessDescription',
      failure: { code: 'GOOGLE_VALIDATION_FAILED', message: 'Preflight failed.' },
    });
    expect(createOperationMock).not.toHaveBeenCalled();
  });

  it('rejects mismatched decision sections after hash validation', async () => {
    const result = await preparePublishDecisions(
      makeInput({
        decisions: [makeDecision({ sectionKey: 'operatingHours' })],
      }),
    );

    expect(result.prepared).toEqual([]);
    expect(result.failures[0]).toMatchObject({
      fieldKey: 'profile.businessDescription',
      failure: {
        code: 'INVALID_DECISION',
        message: 'Field profile.businessDescription belongs to profile, not operatingHours.',
      },
    });
  });

  it('blocks export decisions when export runtime controls are disabled', async () => {
    const result = await preparePublishDecisions(
      makeInput({
        runtimeControls: { ...runtimeControls, exportEnabled: false },
      }),
    );

    expect(result.prepared).toEqual([]);
    expect(result.failures[0]).toMatchObject({
      fieldKey: 'profile.businessDescription',
      failure: {
        code: 'UNSUPPORTED_FIELD',
        message: 'Google exports are disabled for this deployment.',
      },
    });
  });

  it('marks ignored decisions without creating operation rows', async () => {
    const decision = makeDecision({ action: 'ignore' });
    const result = await preparePublishDecisions(makeInput({ decisions: [decision] }));

    expect(result).toEqual({ prepared: [], failures: [] });
    expect(markIgnoredMock).toHaveBeenCalledWith({
      client,
      restaurantId: 'rest-1',
      sectionKey: 'profile',
      fieldKey: 'profile.businessDescription',
    });
    expect(createOperationMock).not.toHaveBeenCalled();
  });

  it('opens operation rows for validated write decisions', async () => {
    const result = await preparePublishDecisions(makeInput());

    expect(result.failures).toEqual([]);
    expect(result.prepared).toHaveLength(1);
    expect(createOperationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        client,
        restaurantId: 'rest-1',
        publishJobId: 'job-1',
        publishBatchId: 'batch-1',
        operationGroupId: 'group-profile',
        sectionKey: 'profile',
        fieldKey: 'profile.businessDescription',
        direction: 'export_to_google',
        googleUpdateMask: 'profile',
      }),
    );
    expect(result.prepared[0]).toMatchObject({
      direction: 'export_to_google',
      operationGroupId: 'group-profile',
      writeGroup: 'location.profile',
      googleUpdateMask: 'profile',
    });
  });
});
