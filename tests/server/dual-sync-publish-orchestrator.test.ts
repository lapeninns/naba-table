import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const createOperationMock = vi.hoisted(() => vi.fn());
const updateOperationStatusMock = vi.hoisted(() => vi.fn());
const listOperationsForJobMock = vi.hoisted(() => vi.fn());
const createPublishBatchMock = vi.hoisted(() => vi.fn());
const findPublishBatchByClientRequestMock = vi.hoisted(() => vi.fn());
const updatePublishBatchStatusMock = vi.hoisted(() => vi.fn());
const createOperationGroupsForPlanMock = vi.hoisted(() => vi.fn());
const updateOperationGroupStatusMock = vi.hoisted(() => vi.fn());
const createGoogleRequestLogMock = vi.hoisted(() => vi.fn());
const ensureActiveFieldPolicyVersionMock = vi.hoisted(() => vi.fn());

const recomputeAllStatesMock = vi.hoisted(() => vi.fn());
const markInSyncMock = vi.hoisted(() => vi.fn());
const markFailedMock = vi.hoisted(() => vi.fn());
const markIgnoredMock = vi.hoisted(() => vi.fn());

const listOpenOutboundCandidatesMock = vi.hoisted(() => vi.fn());
const resolveOutboundCandidateMock = vi.hoisted(() => vi.fn());

const readNabatableSnapshotMock = vi.hoisted(() => vi.fn());
const readGoogleSnapshotMock = vi.hoisted(() => vi.fn());
const refreshFromGoogleWithoutLockMock = vi.hoisted(() => vi.fn());
const assertDualSyncRestaurantNotPausedMock = vi.hoisted(() => vi.fn());
const getDualSyncRestaurantControlMock = vi.hoisted(() => vi.fn());
const runWithDualSyncLockMock = vi.hoisted(() =>
  vi.fn(async (_input, work) =>
    work({
      id: 'lock-1',
      restaurantId: 'rest-1',
      jobKind: 'publish_batch',
      holderId: 'holder-1',
      acquiredAt: '2026-05-09T00:00:00.000Z',
      expiresAt: '2026-05-09T00:05:00.000Z',
    }),
  ),
);

vi.mock('@/server/dual-sync/publish/operations', () => ({
  createOperation: createOperationMock,
  updateOperationStatus: updateOperationStatusMock,
  listOperationsForJob: listOperationsForJobMock,
  createPublishBatch: createPublishBatchMock,
  findPublishBatchByClientRequest: findPublishBatchByClientRequestMock,
  updatePublishBatchStatus: updatePublishBatchStatusMock,
  createOperationGroupsForPlan: createOperationGroupsForPlanMock,
  updateOperationGroupStatus: updateOperationGroupStatusMock,
}));

vi.mock('@/server/dual-sync/publish/google-request-logs', () => ({
  createGoogleRequestLog: createGoogleRequestLogMock,
}));

vi.mock('@/server/dual-sync/registry/field-policy-versions', () => ({
  ensureActiveFieldPolicyVersion: ensureActiveFieldPolicyVersionMock,
}));

vi.mock('@/server/dual-sync/state/recompute', () => ({
  recomputeAllStates: recomputeAllStatesMock,
}));

vi.mock('@/server/dual-sync/state/write', () => ({
  markInSync: markInSyncMock,
  markFailed: markFailedMock,
  markIgnored: markIgnoredMock,
}));

vi.mock('@/server/dual-sync/outbound/candidates', () => ({
  listOpenOutboundCandidates: listOpenOutboundCandidatesMock,
  resolveOutboundCandidate: resolveOutboundCandidateMock,
}));

vi.mock('@/server/dual-sync/snapshots/nabatable', () => ({
  readNabatableSnapshot: readNabatableSnapshotMock,
}));

vi.mock('@/server/dual-sync/snapshots/google', () => ({
  readGoogleSnapshot: readGoogleSnapshotMock,
}));

vi.mock('@/server/dual-sync/refresh/service', () => ({
  refreshFromGoogleWithoutLock: refreshFromGoogleWithoutLockMock,
}));

vi.mock('@/server/dual-sync/locks', () => ({
  runWithDualSyncLock: runWithDualSyncLockMock,
}));

vi.mock('@/server/dual-sync/controls', () => ({
  assertDualSyncRestaurantNotPaused: assertDualSyncRestaurantNotPausedMock,
  getDualSyncRestaurantControl: getDualSyncRestaurantControlMock,
}));

import { hashCanonicalJson } from '@/server/dual-sync/hashing';
import { runPublish } from '@/server/dual-sync/publish/orchestrator';
import { buildRegistry, findFieldConfig } from '@/server/dual-sync/registry';

import type { DualSyncOrchestratorPorts } from '@/server/dual-sync/publish/ports';
import type { DualSyncPublishDecision } from '@/server/dual-sync/publish/types';
import type { DualSyncCanonicalSnapshot } from '@/server/dual-sync/snapshots/types';
import type { DualSyncSectionKey } from '@/server/dual-sync/types';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

const RESTAURANT_ID = 'rest-1';
const client = { from: vi.fn() } as unknown as SupabaseClient<Database>;

afterEach(() => {
  delete process.env.GBP_EXPORT_ENABLED;
  delete process.env.GBP_IMPORT_ENABLED;
  delete process.env.GBP_HIGH_RISK_EXPORTS_ENABLED;
});

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

function readSectionValue(
  snapshot: DualSyncCanonicalSnapshot,
  sectionKey: DualSyncSectionKey | 'core_only',
): unknown {
  switch (sectionKey) {
    case 'profile':
      return snapshot.profile;
    case 'operatingHours':
      return snapshot.operatingHours;
    case 'servicePeriods':
      return snapshot.servicePeriods;
    case 'businessContext.categories':
      return snapshot.businessContext.categories;
    case 'businessContext.serviceAreas':
      return snapshot.businessContext.serviceAreas;
    case 'businessContext.attributes':
      return snapshot.businessContext.attributes;
    case 'businessContext.serviceItems':
      return snapshot.businessContext.serviceItems;
    case 'foodMenus':
      return snapshot.foodMenus ?? { items: [] };
    case 'core_only':
      return null;
    default:
      return null;
  }
}

function valueForField(
  snapshot: DualSyncCanonicalSnapshot,
  config: NonNullable<ReturnType<typeof findFieldConfig>>,
  side: 'core' | 'gbp',
): unknown {
  const sectionValue = readSectionValue(snapshot, config.sectionKey);
  if (sectionValue === null || sectionValue === undefined) return null;
  if (config.kind === 'profile') {
    const profileKey = config.fieldKey.split('.')[1];
    if (!profileKey) return null;
    return (sectionValue as Record<string, unknown>)[profileKey] ?? null;
  }
  if (config.kind === 'core_only') {
    return side === 'core' ? sectionValue : null;
  }
  return sectionValue;
}

function defaultPinsFor(
  fieldKey: string,
): Pick<DualSyncPublishDecision, 'pinnedCoreHash' | 'pinnedGbpHash'> {
  const coreSnapshot = makeSnapshot();
  const gbpSnapshot = makeSnapshot();
  const registry = buildRegistry({ coreSnapshot, gbpSnapshot, includeCoreOnly: false });
  const config = findFieldConfig(registry, fieldKey);
  if (!config) return { pinnedCoreHash: null, pinnedGbpHash: null };
  const coreValue = valueForField(coreSnapshot, config, 'core');
  const gbpValue = valueForField(gbpSnapshot, config, 'gbp');
  return {
    pinnedCoreHash: hashCanonicalJson(config.canonicalizeCoreValue(coreValue)),
    pinnedGbpHash: hashCanonicalJson(config.canonicalizeGbpValue(gbpValue)),
  };
}

function makeDecision(over: Partial<DualSyncPublishDecision> = {}): DualSyncPublishDecision {
  const base = {
    fieldKey: over.fieldKey ?? 'profile.businessDescription',
    sectionKey: over.sectionKey ?? 'profile',
    action: over.action ?? 'import_from_google',
  } satisfies Omit<DualSyncPublishDecision, 'pinnedCoreHash' | 'pinnedGbpHash'>;
  return {
    ...base,
    ...defaultPinsFor(base.fieldKey),
    ...over,
  };
}

function noopOperation(over: Record<string, unknown> = {}) {
  return {
    id: 'op-1',
    restaurantId: RESTAURANT_ID,
    publishJobId: 'job-1',
    sectionKey: 'profile',
    fieldKey: 'profile.businessDescription',
    direction: 'import_from_google',
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
    createdAt: '2026-04-29T00:00:00.000Z',
    updatedAt: '2026-04-29T00:00:00.000Z',
    ...over,
  };
}

describe('dual-sync runPublish', () => {
  beforeEach(() => {
    createOperationMock.mockReset();
    updateOperationStatusMock.mockReset();
    listOperationsForJobMock.mockReset();
    createPublishBatchMock.mockReset();
    findPublishBatchByClientRequestMock.mockReset();
    updatePublishBatchStatusMock.mockReset();
    createOperationGroupsForPlanMock.mockReset();
    updateOperationGroupStatusMock.mockReset();
    createGoogleRequestLogMock.mockReset();
    ensureActiveFieldPolicyVersionMock.mockReset();
    recomputeAllStatesMock.mockReset();
    markInSyncMock.mockReset();
    markFailedMock.mockReset();
    markIgnoredMock.mockReset();
    listOpenOutboundCandidatesMock.mockReset();
    resolveOutboundCandidateMock.mockReset();
    readNabatableSnapshotMock.mockReset();
    readGoogleSnapshotMock.mockReset();
    refreshFromGoogleWithoutLockMock.mockReset();
    assertDualSyncRestaurantNotPausedMock.mockReset();
    getDualSyncRestaurantControlMock.mockReset();
    runWithDualSyncLockMock.mockClear();

    readNabatableSnapshotMock.mockResolvedValue(makeSnapshot());
    readGoogleSnapshotMock.mockResolvedValue(makeSnapshot());
    refreshFromGoogleWithoutLockMock.mockResolvedValue({
      snapshotRun: { id: 'run-1' },
      coreSnapshot: makeSnapshot(),
      gbpSnapshot: makeSnapshot(),
      foodMenusRefresh: {
        status: 'skipped',
        reason: 'skip_pull',
        message: 'test',
      },
      recompute: { evaluatedFieldKeys: [], transitions: [] },
    });
    assertDualSyncRestaurantNotPausedMock.mockResolvedValue(undefined);
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

    createOperationMock.mockImplementation(async () => noopOperation());
    updateOperationStatusMock.mockImplementation(async () => noopOperation());
    listOperationsForJobMock.mockResolvedValue([]);
    findPublishBatchByClientRequestMock.mockResolvedValue(null);
    createPublishBatchMock.mockResolvedValue({
      id: 'job-1',
      restaurantId: RESTAURANT_ID,
      provider: 'google_business_profile',
      clientRequestId: null,
      actorUserId: 'user-1',
      status: 'pending',
      decisionHash: 'decision-hash',
      pinnedCoreSnapshotHash: null,
      pinnedGbpSnapshotHash: null,
      coreSnapshotHash: null,
      gbpSnapshotHash: null,
      fieldPolicyVersionId: 'policy-version-1',
      fieldPolicyHash: 'policy-hash-1',
      acceptedCount: 0,
      rejectedCount: 0,
      ignoredCount: 0,
      planSummary: {},
      errorCode: null,
      errorMessage: null,
      startedAt: null,
      finishedAt: null,
      createdAt: '2026-05-09T00:00:00.000Z',
      updatedAt: '2026-05-09T00:00:00.000Z',
    });
    updatePublishBatchStatusMock.mockResolvedValue({
      id: 'job-1',
      status: 'running',
    });
    createOperationGroupsForPlanMock.mockResolvedValue([]);
    updateOperationGroupStatusMock.mockResolvedValue(null);
    createGoogleRequestLogMock.mockResolvedValue(null);
    ensureActiveFieldPolicyVersionMock.mockResolvedValue({
      id: 'policy-version-1',
      restaurantId: RESTAURANT_ID,
      provider: 'google_business_profile',
      versionLabel: 'registry-policy',
      policyHash: 'policy-hash-1',
      policySnapshot: { fieldCount: 1 },
      fieldCount: 1,
      active: true,
      createdByUserId: 'user-1',
      activatedAt: '2026-05-10T00:00:00.000Z',
      createdAt: '2026-05-10T00:00:00.000Z',
    });
    recomputeAllStatesMock.mockResolvedValue({
      evaluatedFieldKeys: [],
      transitions: [],
    });
    listOpenOutboundCandidatesMock.mockResolvedValue([]);
  });

  it('calls applyImportToCore for an import decision and stamps in_sync on success', async () => {
    listOperationsForJobMock.mockResolvedValue([noopOperation({ status: 'succeeded' })]);

    const ports: DualSyncOrchestratorPorts = {
      applyImportToCore: vi.fn().mockResolvedValue({ status: 'succeeded' }),
      applyExportToGoogle: vi.fn(),
    };

    const result = await runPublish(
      client,
      {
        restaurantId: RESTAURANT_ID,
        decisions: [makeDecision()],
        actorUserId: 'user-1',
      },
      { ports },
    );

    expect(ports.applyImportToCore).toHaveBeenCalledTimes(1);
    expect(ports.applyExportToGoogle).not.toHaveBeenCalled();
    expect(markInSyncMock).toHaveBeenCalledTimes(1);
    expect(result.summary.succeededCount).toBe(1);
    expect(result.summary.failedCount).toBe(0);
    expect(recomputeAllStatesMock).toHaveBeenCalledTimes(1);
    expect(runWithDualSyncLockMock).toHaveBeenCalledWith(
      expect.objectContaining({
        client,
        restaurantId: RESTAURANT_ID,
        jobKind: 'publish_batch',
      }),
      expect.any(Function),
    );
  });

  it('fails before provider refresh or port calls when restaurant sync is paused', async () => {
    assertDualSyncRestaurantNotPausedMock.mockRejectedValueOnce(
      Object.assign(new Error('Maintenance window.'), {
        code: 'DUAL_SYNC_RESTAURANT_PAUSED',
      }),
    );
    const ports: DualSyncOrchestratorPorts = {
      applyImportToCore: vi.fn(),
      applyExportToGoogle: vi.fn(),
    };

    await expect(
      runPublish(
        client,
        {
          restaurantId: RESTAURANT_ID,
          decisions: [makeDecision()],
          actorUserId: 'user-1',
        },
        { ports, refreshGoogleBeforePublish: true },
      ),
    ).rejects.toMatchObject({
      code: 'DUAL_SYNC_RESTAURANT_PAUSED',
      message: 'Maintenance window.',
    });

    expect(refreshFromGoogleWithoutLockMock).not.toHaveBeenCalled();
    expect(readNabatableSnapshotMock).not.toHaveBeenCalled();
    expect(readGoogleSnapshotMock).not.toHaveBeenCalled();
    expect(ports.applyImportToCore).not.toHaveBeenCalled();
    expect(ports.applyExportToGoogle).not.toHaveBeenCalled();
  });

  it('can refresh the Google mirror inside the publish lock before evaluating pins', async () => {
    listOperationsForJobMock.mockResolvedValue([noopOperation({ status: 'succeeded' })]);
    const ports: DualSyncOrchestratorPorts = {
      applyImportToCore: vi.fn().mockResolvedValue({ status: 'succeeded' }),
      applyExportToGoogle: vi.fn(),
    };

    await runPublish(
      client,
      {
        restaurantId: RESTAURANT_ID,
        decisions: [makeDecision()],
        actorUserId: 'user-1',
      },
      {
        ports,
        refreshGoogleBeforePublish: true,
      },
    );

    expect(refreshFromGoogleWithoutLockMock).toHaveBeenCalledWith({
      client,
      restaurantId: RESTAURANT_ID,
      runKind: 'preflight',
      skipPull: false,
    });
    expect(readNabatableSnapshotMock).toHaveBeenCalled();
    expect(readGoogleSnapshotMock).toHaveBeenCalled();
  });

  it('replays an existing client_request_id batch without invoking write ports again', async () => {
    const decisions = [makeDecision()];
    const decisionHash = hashCanonicalJson({
      restaurantId: RESTAURANT_ID,
      fieldPolicyHash: 'policy-hash-1',
      decisions: decisions.map((decision) => ({
        fieldKey: decision.fieldKey,
        sectionKey: decision.sectionKey,
        action: decision.action,
        pinnedCoreHash: decision.pinnedCoreHash,
        pinnedGbpHash: decision.pinnedGbpHash,
      })),
      pinnedCoreSnapshotHash: null,
      pinnedGbpSnapshotHash: null,
    });
    findPublishBatchByClientRequestMock.mockResolvedValueOnce({
      id: 'existing-job-1',
      decisionHash,
    });
    listOperationsForJobMock.mockResolvedValueOnce([
      noopOperation({
        id: 'op-existing',
        publishJobId: 'existing-job-1',
        status: 'succeeded',
      }),
    ]);

    const ports: DualSyncOrchestratorPorts = {
      applyImportToCore: vi.fn(),
      applyExportToGoogle: vi.fn(),
    };

    const result = await runPublish(
      client,
      {
        restaurantId: RESTAURANT_ID,
        decisions,
        actorUserId: 'user-1',
        clientRequestId: 'request-1',
      },
      { ports },
    );

    expect(findPublishBatchByClientRequestMock).toHaveBeenCalledWith({
      client,
      restaurantId: RESTAURANT_ID,
      clientRequestId: 'request-1',
    });
    expect(createPublishBatchMock).not.toHaveBeenCalled();
    expect(createOperationMock).not.toHaveBeenCalled();
    expect(ports.applyImportToCore).not.toHaveBeenCalled();
    expect(result.summary.publishJobId).toBe('existing-job-1');
    expect(result.summary.succeededCount).toBe(1);
  });

  it('creates section operation groups and attaches child operation rows', async () => {
    createOperationGroupsForPlanMock.mockResolvedValueOnce([
      {
        id: 'group-profile',
        groupKey: 'export_to_google:profile:location.profile',
        sectionKey: 'profile',
      },
    ]);
    createOperationMock.mockImplementation(async (input) =>
      noopOperation({
        id: 'op-1',
        publishBatchId: input.publishBatchId,
        operationGroupId: input.operationGroupId,
        direction: 'export_to_google',
        status: 'pending',
      }),
    );
    listOperationsForJobMock.mockResolvedValueOnce([
      noopOperation({
        id: 'op-1',
        status: 'succeeded',
        direction: 'export_to_google',
        publishBatchId: 'job-1',
        operationGroupId: 'group-profile',
      }),
    ]);

    const ports: DualSyncOrchestratorPorts = {
      applyImportToCore: vi.fn(),
      applyExportToGoogle: vi.fn().mockResolvedValue({ status: 'succeeded' }),
    };

    await runPublish(
      client,
      {
        restaurantId: RESTAURANT_ID,
        decisions: [makeDecision({ action: 'export_to_google' })],
        actorUserId: 'user-1',
      },
      { ports },
    );

    expect(createPublishBatchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        restaurantId: RESTAURANT_ID,
        actorUserId: 'user-1',
        fieldPolicyVersionId: 'policy-version-1',
        fieldPolicyHash: 'policy-hash-1',
        acceptedCount: 1,
        rejectedCount: 0,
      }),
    );
    expect(createOperationGroupsForPlanMock).toHaveBeenCalledWith(
      expect.objectContaining({
        publishBatchId: 'job-1',
        groups: [
          expect.objectContaining({
            groupId: 'export_to_google:profile:location.profile',
            writeGroup: 'location.profile',
          }),
        ],
      }),
    );
    expect(createOperationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        publishBatchId: 'job-1',
        operationGroupId: 'group-profile',
      }),
    );
    expect(updateOperationGroupStatusMock).toHaveBeenCalledWith(
      expect.objectContaining({
        operationGroupId: 'group-profile',
        status: 'running',
      }),
    );
    expect(updateOperationGroupStatusMock).toHaveBeenCalledWith(
      expect.objectContaining({
        operationGroupId: 'group-profile',
        status: 'succeeded',
        responseSummary: expect.objectContaining({
          operationIds: ['op-1'],
          fieldKeys: ['profile.businessDescription'],
          counts: expect.objectContaining({
            total: 1,
            succeeded: 1,
            failed: 0,
          }),
        }),
      }),
    );
    expect(updatePublishBatchStatusMock).toHaveBeenCalledWith(
      expect.objectContaining({
        publishBatchId: 'job-1',
        status: 'succeeded',
      }),
    );
  });

  it('fails export operations as retryable when Google edit budget is exhausted', async () => {
    listOperationsForJobMock.mockResolvedValueOnce([
      noopOperation({
        id: 'op-1',
        status: 'failed',
        direction: 'export_to_google',
        errorCode: 'QUOTA_LIMITED',
        errorMessage: 'Google edit budget is exhausted for this location.',
      }),
    ]);
    const ports: DualSyncOrchestratorPorts = {
      applyImportToCore: vi.fn(),
      applyExportToGoogle: vi.fn(),
    };

    const result = await runPublish(
      client,
      {
        restaurantId: RESTAURANT_ID,
        decisions: [makeDecision({ action: 'export_to_google' })],
        actorUserId: 'user-1',
      },
      {
        ports,
        googleEditThrottle: {
          reserve: vi.fn(async () => ({
            allowed: false,
            retryAfterMs: 60_000,
            remaining: 0,
          })),
        },
      },
    );

    expect(ports.applyExportToGoogle).not.toHaveBeenCalled();
    expect(updateOperationStatusMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'failed',
        errorCode: 'QUOTA_LIMITED',
      }),
    );
    expect(result.summary.failedCount).toBe(1);
    expect(result.summary.failures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fieldKey: 'profile.businessDescription',
          failure: expect.objectContaining({ code: 'QUOTA_LIMITED', retryable: true }),
        }),
      ]),
    );
  });

  it('blocks required export groups when preflight fails before operation rows or port calls', async () => {
    createOperationGroupsForPlanMock.mockResolvedValueOnce([
      {
        id: 'group-hours',
        groupKey: 'export_to_google:operatingHours:location.regularHours',
        sectionKey: 'operatingHours',
      },
    ]);
    listOperationsForJobMock.mockResolvedValue([]);

    const ports: DualSyncOrchestratorPorts = {
      applyImportToCore: vi.fn(),
      applyExportToGoogle: vi.fn(),
      applyExportBatchToGoogle: vi.fn(),
    };
    const exportPreflight = vi.fn().mockResolvedValue({
      status: 'failed',
      failure: {
        code: 'GOOGLE_VALIDATION_FAILED',
        message: 'Google rejected the regular hours payload.',
        retryable: false,
      },
      result: { validateOnly: false },
    });

    const result = await runPublish(
      client,
      {
        restaurantId: RESTAURANT_ID,
        decisions: [
          makeDecision({
            fieldKey: 'operatingHours.weekly.1',
            sectionKey: 'operatingHours',
            action: 'export_to_google',
          }),
        ],
        actorUserId: 'user-1',
      },
      { ports, exportPreflight },
    );

    expect(exportPreflight).toHaveBeenCalledWith(
      expect.objectContaining({
        restaurantId: RESTAURANT_ID,
        publishBatchId: 'job-1',
        group: expect.objectContaining({
          groupId: 'export_to_google:operatingHours:location.regularHours',
          requiresPreflight: true,
        }),
      }),
    );
    expect(createOperationMock).not.toHaveBeenCalled();
    expect(ports.applyExportBatchToGoogle).not.toHaveBeenCalled();
    expect(ports.applyExportToGoogle).not.toHaveBeenCalled();
    expect(updateOperationGroupStatusMock).toHaveBeenCalledWith(
      expect.objectContaining({
        operationGroupId: 'group-hours',
        status: 'running',
        preflightStatus: 'running',
      }),
    );
    expect(updateOperationGroupStatusMock).toHaveBeenCalledWith(
      expect.objectContaining({
        operationGroupId: 'group-hours',
        status: 'failed',
        preflightStatus: 'failed',
        errorCode: 'GOOGLE_VALIDATION_FAILED',
      }),
    );
    expect(createGoogleRequestLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        restaurantId: RESTAURANT_ID,
        publishBatchId: 'job-1',
        operationGroupId: 'group-hours',
        sectionKey: 'operatingHours',
        direction: 'export_to_google',
        writeGroup: 'location.regularHours',
        phase: 'preflight',
        status: 'failed',
        googleMethod: 'location.regularHours',
        googleUpdateMasks: ['regularHours'],
        requestSummary: expect.objectContaining({
          groupId: 'export_to_google:operatingHours:location.regularHours',
          fieldKeys: ['operatingHours.weekly.1'],
        }),
        responseSummary: { validateOnly: false },
        errorCode: 'GOOGLE_VALIDATION_FAILED',
      }),
    );
    expect(result.summary.failures).toEqual([
      expect.objectContaining({
        fieldKey: 'operatingHours.weekly.1',
        failure: expect.objectContaining({
          code: 'GOOGLE_VALIDATION_FAILED',
          message: 'Google rejected the regular hours payload.',
        }),
      }),
    ]);
  });

  it('normalizes thrown Google provider errors into actionable failure codes', async () => {
    listOperationsForJobMock.mockResolvedValueOnce([
      noopOperation({
        id: 'op-1',
        status: 'failed',
        direction: 'export_to_google',
        errorCode: 'LOCATION_ACCESS_LOST',
        errorMessage: 'Permission denied',
      }),
    ]);
    const ports: DualSyncOrchestratorPorts = {
      applyImportToCore: vi.fn(),
      applyExportToGoogle: vi.fn().mockRejectedValue({
        status: 403,
        message: 'Permission denied for access_token=secret-token',
      }),
    };

    const result = await runPublish(
      client,
      {
        restaurantId: RESTAURANT_ID,
        decisions: [makeDecision({ action: 'export_to_google' })],
        actorUserId: 'user-1',
      },
      { ports },
    );

    expect(updateOperationStatusMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'failed',
        errorCode: 'LOCATION_ACCESS_LOST',
        errorMessage: 'Permission denied for access_token=[redacted]',
      }),
    );
    expect(result.summary.failures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          failure: expect.objectContaining({
            code: 'LOCATION_ACCESS_LOST',
            retryable: false,
          }),
        }),
      ]),
    );
  });

  it('recomputes final state from post-import snapshots', async () => {
    const initialCore = makeSnapshot({
      profile: {
        ...makeSnapshot().profile,
        businessDescription: 'Old Core value',
      },
    });
    const googleSnapshot = makeSnapshot({
      profile: {
        ...makeSnapshot().profile,
        businessDescription: 'Fresh Google value',
      },
    });
    const postImportCore = makeSnapshot({
      profile: {
        ...makeSnapshot().profile,
        businessDescription: 'Fresh Google value',
      },
    });

    readNabatableSnapshotMock
      .mockResolvedValueOnce(initialCore)
      .mockResolvedValueOnce(postImportCore);
    readGoogleSnapshotMock
      .mockResolvedValueOnce(googleSnapshot)
      .mockResolvedValueOnce(googleSnapshot);
    listOperationsForJobMock.mockResolvedValue([noopOperation({ status: 'succeeded' })]);

    const ports: DualSyncOrchestratorPorts = {
      applyImportToCore: vi.fn().mockResolvedValue({ status: 'succeeded' }),
      applyExportToGoogle: vi.fn(),
    };

    await runPublish(
      client,
      {
        restaurantId: RESTAURANT_ID,
        decisions: [makeDecision()],
        actorUserId: 'user-1',
      },
      { ports },
    );

    expect(readNabatableSnapshotMock).toHaveBeenCalledTimes(2);
    expect(readGoogleSnapshotMock).toHaveBeenCalledTimes(2);
    expect(recomputeAllStatesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        coreSnapshot: postImportCore,
        gbpSnapshot: googleSnapshot,
      }),
    );
  });

  it('calls applyExportToGoogle for an export decision', async () => {
    listOperationsForJobMock.mockResolvedValue([
      noopOperation({ status: 'succeeded', direction: 'export_to_google' }),
    ]);

    const ports: DualSyncOrchestratorPorts = {
      applyImportToCore: vi.fn(),
      applyExportToGoogle: vi.fn().mockResolvedValue({ status: 'succeeded' }),
    };

    await runPublish(
      client,
      {
        restaurantId: RESTAURANT_ID,
        decisions: [makeDecision({ action: 'export_to_google' })],
        actorUserId: 'user-1',
      },
      { ports },
    );

    expect(ports.applyExportToGoogle).toHaveBeenCalledTimes(1);
    expect(ports.applyImportToCore).not.toHaveBeenCalled();
    expect(createGoogleRequestLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        restaurantId: RESTAURANT_ID,
        publishBatchId: 'job-1',
        publishOperationId: 'op-1',
        publishJobId: expect.any(String),
        sectionKey: 'profile',
        fieldKey: 'profile.businessDescription',
        direction: 'export_to_google',
        writeGroup: 'location.profile',
        phase: 'provider_write',
        status: 'succeeded',
        googleUpdateMasks: ['profile'],
      }),
    );
  });

  it('marks ignored decisions without creating an operation', async () => {
    listOperationsForJobMock.mockResolvedValue([]);

    const ports: DualSyncOrchestratorPorts = {
      applyImportToCore: vi.fn(),
      applyExportToGoogle: vi.fn(),
    };

    const result = await runPublish(
      client,
      {
        restaurantId: RESTAURANT_ID,
        decisions: [makeDecision({ action: 'ignore' })],
        actorUserId: 'user-1',
      },
      { ports },
    );

    expect(createOperationMock).not.toHaveBeenCalled();
    expect(markIgnoredMock).toHaveBeenCalledTimes(1);
    expect(result.summary.totalDecisions).toBe(1);
  });

  it('rejects decisions whose pinned core hash drifted', async () => {
    listOperationsForJobMock.mockResolvedValue([]);

    const ports: DualSyncOrchestratorPorts = {
      applyImportToCore: vi.fn(),
      applyExportToGoogle: vi.fn(),
    };

    const result = await runPublish(
      client,
      {
        restaurantId: RESTAURANT_ID,
        decisions: [makeDecision({ pinnedCoreHash: 'stale-hash' })],
        actorUserId: 'user-1',
      },
      { ports },
    );

    expect(createOperationMock).not.toHaveBeenCalled();
    expect(ports.applyImportToCore).not.toHaveBeenCalled();
    expect(result.summary.failures).toHaveLength(1);
    expect(result.summary.failures[0]?.failure.code).toBe('CORE_DRIFT');
  });

  it('treats a null pinned core hash as an expected absent value before batch exports', async () => {
    listOperationsForJobMock.mockResolvedValue([]);

    const ports: DualSyncOrchestratorPorts = {
      applyImportToCore: vi.fn(),
      applyExportToGoogle: vi.fn(),
      applyExportBatchToGoogle: vi.fn(),
    };

    const result = await runPublish(
      client,
      {
        restaurantId: RESTAURANT_ID,
        decisions: [
          makeDecision({
            action: 'export_to_google',
            pinnedCoreHash: null,
            pinnedGbpHash: hashCanonicalJson('Tasty'),
          }),
          makeDecision({
            fieldKey: 'profile.name',
            action: 'export_to_google',
            pinnedCoreHash: null,
            pinnedGbpHash: hashCanonicalJson('acme'),
          }),
        ],
        actorUserId: 'user-1',
      },
      { ports },
    );

    expect(createOperationMock).not.toHaveBeenCalled();
    expect(ports.applyExportBatchToGoogle).not.toHaveBeenCalled();
    expect(ports.applyExportToGoogle).not.toHaveBeenCalled();
    expect(result.summary.failures).toHaveLength(2);
    expect(result.summary.failures.every((failure) => failure.failure.code === 'CORE_DRIFT')).toBe(
      true,
    );
  });

  it('does not treat null pins as drift when the current canonical value is still absent', async () => {
    const absentSnapshot = makeSnapshot({
      profile: {
        ...makeSnapshot().profile,
        businessDescription: null,
      },
    });
    readNabatableSnapshotMock.mockResolvedValue(absentSnapshot);
    readGoogleSnapshotMock.mockResolvedValue(absentSnapshot);
    listOperationsForJobMock.mockResolvedValue([noopOperation({ status: 'succeeded' })]);

    const ports: DualSyncOrchestratorPorts = {
      applyImportToCore: vi.fn().mockResolvedValue({ status: 'succeeded' }),
      applyExportToGoogle: vi.fn(),
    };

    const result = await runPublish(
      client,
      {
        restaurantId: RESTAURANT_ID,
        decisions: [makeDecision({ action: 'ignore', pinnedCoreHash: null, pinnedGbpHash: null })],
        actorUserId: 'user-1',
      },
      { ports },
    );

    expect(createOperationMock).not.toHaveBeenCalled();
    expect(markIgnoredMock).toHaveBeenCalledTimes(1);
    expect(ports.applyImportToCore).not.toHaveBeenCalled();
    expect(result.summary.failures).toEqual([]);
  });

  it('rejects stale snapshot pins before creating operations or calling batch exports', async () => {
    listOperationsForJobMock.mockResolvedValue([]);

    const ports: DualSyncOrchestratorPorts = {
      applyImportToCore: vi.fn(),
      applyExportToGoogle: vi.fn(),
      applyExportBatchToGoogle: vi.fn(),
    };

    const result = await runPublish(
      client,
      {
        restaurantId: RESTAURANT_ID,
        decisions: [
          makeDecision({
            fieldKey: 'operatingHours.weekly.1',
            sectionKey: 'operatingHours',
            action: 'export_to_google',
          }),
          makeDecision({
            fieldKey: 'operatingHours.weekly.2',
            sectionKey: 'operatingHours',
            action: 'export_to_google',
          }),
        ],
        actorUserId: 'user-1',
        pinnedGbpSnapshotHash: 'stale-snapshot',
      },
      { ports },
    );

    expect(createOperationMock).not.toHaveBeenCalled();
    expect(ports.applyExportBatchToGoogle).not.toHaveBeenCalled();
    expect(ports.applyExportToGoogle).not.toHaveBeenCalled();
    expect(result.summary.failures).toHaveLength(2);
    expect(result.summary.failures.every((f) => f.failure.code === 'GBP_DRIFT')).toBe(true);
  });

  it('captures port failures in the summary and marks the field failed', async () => {
    listOperationsForJobMock.mockResolvedValue([noopOperation({ status: 'failed' })]);

    const ports: DualSyncOrchestratorPorts = {
      applyImportToCore: vi.fn().mockResolvedValue({
        status: 'failed',
        failure: { code: 'PORT_FAILURE', message: 'boom', retryable: true },
      }),
      applyExportToGoogle: vi.fn(),
    };

    const result = await runPublish(
      client,
      {
        restaurantId: RESTAURANT_ID,
        decisions: [makeDecision()],
        actorUserId: 'user-1',
      },
      { ports },
    );

    expect(markFailedMock).toHaveBeenCalledWith(expect.objectContaining({ direction: 'import' }));
    expect(result.summary.failures).toEqual([
      expect.objectContaining({
        fieldKey: 'profile.businessDescription',
        failure: expect.objectContaining({ code: 'PORT_FAILURE', retryable: true }),
      }),
    ]);
    expect(result.summary.failedCount).toBe(1);
  });

  it('rejects unknown field keys with INVALID_DECISION', async () => {
    listOperationsForJobMock.mockResolvedValue([]);

    const ports: DualSyncOrchestratorPorts = {
      applyImportToCore: vi.fn(),
      applyExportToGoogle: vi.fn(),
    };

    const result = await runPublish(
      client,
      {
        restaurantId: RESTAURANT_ID,
        decisions: [makeDecision({ fieldKey: 'profile.doesNotExist' })],
        actorUserId: 'user-1',
      },
      { ports },
    );

    expect(createOperationMock).not.toHaveBeenCalled();
    expect(result.summary.failures[0]?.failure.code).toBe('INVALID_DECISION');
  });

  it('rejects exports for Google-owned read-only policy fields before operation creation', async () => {
    listOperationsForJobMock.mockResolvedValue([]);

    const ports: DualSyncOrchestratorPorts = {
      applyImportToCore: vi.fn(),
      applyExportToGoogle: vi.fn(),
    };

    const result = await runPublish(
      client,
      {
        restaurantId: RESTAURANT_ID,
        decisions: [
          makeDecision({
            fieldKey: 'profile.googleMapUrl',
            sectionKey: 'profile',
            action: 'export_to_google',
          }),
        ],
        actorUserId: 'user-1',
      },
      { ports },
    );

    expect(createOperationMock).not.toHaveBeenCalled();
    expect(ports.applyExportToGoogle).not.toHaveBeenCalled();
    expect(result.summary.failures).toEqual([
      expect.objectContaining({
        fieldKey: 'profile.googleMapUrl',
        failure: expect.objectContaining({
          code: 'UNSUPPORTED_FIELD',
          message: 'Google Maps URL is Google-owned metadata and is not directly writable.',
        }),
      }),
    ]);
  });

  it('rejects automated exports for manual-review policy fields', async () => {
    listOperationsForJobMock.mockResolvedValue([]);

    const ports: DualSyncOrchestratorPorts = {
      applyImportToCore: vi.fn(),
      applyExportToGoogle: vi.fn(),
    };

    const result = await runPublish(
      client,
      {
        restaurantId: RESTAURANT_ID,
        decisions: [
          makeDecision({
            fieldKey: 'profile.name',
            sectionKey: 'profile',
            action: 'export_to_google',
          }),
        ],
        actorUserId: null,
      },
      { ports },
    );

    expect(createOperationMock).not.toHaveBeenCalled();
    expect(ports.applyExportToGoogle).not.toHaveBeenCalled();
    expect(result.summary.failures[0]?.failure).toMatchObject({
      code: 'UNSUPPORTED_FIELD',
      message: 'Field requires manual review before it can be exported.',
    });
  });

  it('rejects disabled export decisions before creating operation rows or calling ports', async () => {
    process.env.GBP_EXPORT_ENABLED = 'false';
    listOperationsForJobMock.mockResolvedValue([]);

    const ports: DualSyncOrchestratorPorts = {
      applyImportToCore: vi.fn(),
      applyExportToGoogle: vi.fn(),
    };

    const result = await runPublish(
      client,
      {
        restaurantId: RESTAURANT_ID,
        decisions: [
          makeDecision({
            fieldKey: 'profile.businessDescription',
            sectionKey: 'profile',
            action: 'export_to_google',
          }),
        ],
        actorUserId: 'user-1',
      },
      { ports },
    );

    expect(createOperationMock).not.toHaveBeenCalled();
    expect(ports.applyExportToGoogle).not.toHaveBeenCalled();
    expect(result.summary.failures[0]?.failure).toMatchObject({
      code: 'UNSUPPORTED_FIELD',
      message: 'Google exports are disabled for this deployment.',
    });
  });

  it('routes a 2+ same-section export group through applyExportBatchToGoogle and skips per-field calls', async () => {
    listOperationsForJobMock.mockResolvedValue([
      noopOperation({
        fieldKey: 'operatingHours.weekly.1',
        sectionKey: 'operatingHours',
        direction: 'export_to_google',
        status: 'succeeded',
      }),
      noopOperation({
        id: 'op-2',
        fieldKey: 'operatingHours.weekly.2',
        sectionKey: 'operatingHours',
        direction: 'export_to_google',
        status: 'succeeded',
      }),
    ]);

    const ports: DualSyncOrchestratorPorts = {
      applyImportToCore: vi.fn(),
      applyExportToGoogle: vi.fn(),
      applyExportBatchToGoogle: vi.fn().mockResolvedValue({
        supported: true,
        perField: {
          'operatingHours.weekly.1': { status: 'succeeded' },
          'operatingHours.weekly.2': { status: 'succeeded' },
        },
      }),
    };

    const result = await runPublish(
      client,
      {
        restaurantId: RESTAURANT_ID,
        decisions: [
          makeDecision({
            fieldKey: 'operatingHours.weekly.1',
            sectionKey: 'operatingHours',
            action: 'export_to_google',
          }),
          makeDecision({
            fieldKey: 'operatingHours.weekly.2',
            sectionKey: 'operatingHours',
            action: 'export_to_google',
          }),
        ],
        actorUserId: 'user-1',
      },
      { ports },
    );

    expect(result.summary.failures).toEqual([]);
    expect(ports.applyExportBatchToGoogle).toHaveBeenCalledTimes(1);
    expect(ports.applyExportToGoogle).not.toHaveBeenCalled();
    expect(createOperationMock).toHaveBeenCalledTimes(2);
    expect(createOperationMock.mock.invocationCallOrder[1]).toBeLessThan(
      vi.mocked(ports.applyExportBatchToGoogle).mock.invocationCallOrder[0]!,
    );
    expect(markInSyncMock).toHaveBeenCalledTimes(2);
    expect(result.summary.succeededCount).toBe(2);
  });

  it('does NOT call the batch port for a single-decision export group (short-circuit)', async () => {
    listOperationsForJobMock.mockResolvedValue([
      noopOperation({
        fieldKey: 'operatingHours.weekly.1',
        sectionKey: 'operatingHours',
        direction: 'export_to_google',
        status: 'succeeded',
      }),
    ]);

    const ports: DualSyncOrchestratorPorts = {
      applyImportToCore: vi.fn(),
      applyExportToGoogle: vi.fn().mockResolvedValue({ status: 'succeeded' }),
      applyExportBatchToGoogle: vi.fn(),
    };

    await runPublish(
      client,
      {
        restaurantId: RESTAURANT_ID,
        decisions: [
          makeDecision({
            fieldKey: 'operatingHours.weekly.1',
            sectionKey: 'operatingHours',
            action: 'export_to_google',
          }),
        ],
        actorUserId: 'user-1',
      },
      { ports },
    );

    expect(ports.applyExportBatchToGoogle).not.toHaveBeenCalled();
    expect(ports.applyExportToGoogle).toHaveBeenCalledTimes(1);
  });

  it('falls back to per-field dispatch when the batch port returns supported:false', async () => {
    listOperationsForJobMock.mockResolvedValue([
      noopOperation({
        fieldKey: 'operatingHours.weekly.1',
        sectionKey: 'operatingHours',
        direction: 'export_to_google',
        status: 'succeeded',
      }),
      noopOperation({
        id: 'op-2',
        fieldKey: 'operatingHours.weekly.2',
        sectionKey: 'operatingHours',
        direction: 'export_to_google',
        status: 'succeeded',
      }),
    ]);

    const ports: DualSyncOrchestratorPorts = {
      applyImportToCore: vi.fn(),
      applyExportToGoogle: vi.fn().mockResolvedValue({ status: 'succeeded' }),
      applyExportBatchToGoogle: vi.fn().mockResolvedValue({ supported: false }),
    };

    await runPublish(
      client,
      {
        restaurantId: RESTAURANT_ID,
        decisions: [
          makeDecision({
            fieldKey: 'operatingHours.weekly.1',
            sectionKey: 'operatingHours',
            action: 'export_to_google',
          }),
          makeDecision({
            fieldKey: 'operatingHours.weekly.2',
            sectionKey: 'operatingHours',
            action: 'export_to_google',
          }),
        ],
        actorUserId: 'user-1',
      },
      { ports },
    );

    expect(ports.applyExportBatchToGoogle).toHaveBeenCalledTimes(1);
    expect(ports.applyExportToGoogle).toHaveBeenCalledTimes(2);
  });

  it('routes every decision in the group to an external API failure when the batch port throws', async () => {
    listOperationsForJobMock.mockResolvedValue([
      noopOperation({
        fieldKey: 'operatingHours.weekly.1',
        sectionKey: 'operatingHours',
        direction: 'export_to_google',
        status: 'failed',
      }),
      noopOperation({
        id: 'op-2',
        fieldKey: 'operatingHours.weekly.2',
        sectionKey: 'operatingHours',
        direction: 'export_to_google',
        status: 'failed',
      }),
    ]);

    const ports: DualSyncOrchestratorPorts = {
      applyImportToCore: vi.fn(),
      applyExportToGoogle: vi.fn(),
      applyExportBatchToGoogle: vi.fn().mockRejectedValue(new Error('upstream broke')),
    };

    const result = await runPublish(
      client,
      {
        restaurantId: RESTAURANT_ID,
        decisions: [
          makeDecision({
            fieldKey: 'operatingHours.weekly.1',
            sectionKey: 'operatingHours',
            action: 'export_to_google',
          }),
          makeDecision({
            fieldKey: 'operatingHours.weekly.2',
            sectionKey: 'operatingHours',
            action: 'export_to_google',
          }),
        ],
        actorUserId: 'user-1',
      },
      { ports },
    );

    expect(ports.applyExportToGoogle).not.toHaveBeenCalled();
    expect(result.summary.failures).toHaveLength(2);
    expect(result.summary.failures.every((f) => f.failure.code === 'EXTERNAL_API_ERROR')).toBe(
      true,
    );
  });

  it('resolves open outbound candidates for fields whose operations succeeded', async () => {
    listOperationsForJobMock.mockResolvedValue([
      noopOperation({
        fieldKey: 'profile.businessDescription',
        status: 'succeeded',
      }),
    ]);
    listOpenOutboundCandidatesMock.mockResolvedValue([
      {
        id: 'cand-1',
        restaurantId: RESTAURANT_ID,
        provider: 'google_business_profile',
        sectionKey: 'profile',
        fieldKey: 'profile.businessDescription',
        proposedValue: null,
        proposedValueHash: null,
        baselineGbpHash: null,
        status: 'open',
        source: 'core_write',
        createdByUserId: null,
        resolvedAt: null,
        createdAt: '2026-04-29T00:00:00.000Z',
        updatedAt: '2026-04-29T00:00:00.000Z',
      },
    ]);

    const ports: DualSyncOrchestratorPorts = {
      applyImportToCore: vi.fn().mockResolvedValue({ status: 'succeeded' }),
      applyExportToGoogle: vi.fn(),
    };

    await runPublish(
      client,
      {
        restaurantId: RESTAURANT_ID,
        decisions: [makeDecision()],
        actorUserId: null,
      },
      { ports },
    );

    expect(resolveOutboundCandidateMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'cand-1', nextStatus: 'resolved' }),
    );
  });
});
