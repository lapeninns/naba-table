import { beforeEach, describe, expect, it, vi } from 'vitest';

const runRequiredExportPreflightsMock = vi.hoisted(() => vi.fn());
const updatePublishBatchStatusMock = vi.hoisted(() => vi.fn());
const preparePublishDecisionsMock = vi.hoisted(() => vi.fn());
const runBatchExportPortsMock = vi.hoisted(() => vi.fn());
const executePreparedPublishOperationsMock = vi.hoisted(() => vi.fn());
const finalizePublishMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/dual-sync/publish/orchestrator-preflight', () => ({
  runRequiredExportPreflights: runRequiredExportPreflightsMock,
}));

vi.mock('@/server/dual-sync/publish/operations', () => ({
  updatePublishBatchStatus: updatePublishBatchStatusMock,
}));

vi.mock('@/server/dual-sync/publish/orchestrator-prepare-decisions', () => ({
  preparePublishDecisions: preparePublishDecisionsMock,
}));

vi.mock('@/server/dual-sync/publish/orchestrator-batch-export', () => ({
  runBatchExportPorts: runBatchExportPortsMock,
}));

vi.mock('@/server/dual-sync/publish/orchestrator-execute-operations', () => ({
  executePreparedPublishOperations: executePreparedPublishOperationsMock,
}));

vi.mock('@/server/dual-sync/publish/orchestrator-finalize', () => ({
  finalizePublish: finalizePublishMock,
}));

import { runPublishExecutionPhase } from '@/server/dual-sync/publish/orchestrator-execution-phase';

import type { DualSyncRuntimeControls } from '@/server/dual-sync/runtime-controls';
import type { PreparedPublishDecision } from '@/server/dual-sync/publish/orchestrator-prepare-decisions';
import type { DualSyncOrchestratorPorts } from '@/server/dual-sync/publish/ports';
import type {
  DualSyncOperationFailure,
  DualSyncPublishDecision,
  DualSyncPublishPlan,
  DualSyncRunPublishInput,
} from '@/server/dual-sync/publish/types';
import type { DualSyncFieldConfig } from '@/server/dual-sync/registry';
import type { DualSyncCanonicalSnapshot } from '@/server/dual-sync/snapshots/types';
import type {
  DualSyncPublishBatch,
  DualSyncPublishOperation,
  DualSyncPublishOperationGroup,
} from '@/server/dual-sync/types';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

const client = { from: vi.fn() } as unknown as SupabaseClient<Database>;
const registry = [
  { fieldKey: 'profile.businessDescription' },
] as unknown as ReadonlyArray<DualSyncFieldConfig>;
const runtimeControls: DualSyncRuntimeControls = {
  importEnabled: true,
  exportEnabled: true,
  autoCandidatesEnabled: true,
  highRiskExportsEnabled: true,
  menuSyncEnabled: true,
  attributesSyncEnabled: true,
  scheduledRefreshEnabled: true,
};
const ports = {
  applyImportToCore: vi.fn(),
  applyExportToGoogle: vi.fn(),
} as unknown as DualSyncOrchestratorPorts;

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

function publishInput(overrides: Partial<DualSyncRunPublishInput> = {}): DualSyncRunPublishInput {
  return {
    restaurantId: 'rest-1',
    actorUserId: 'user-1',
    clientRequestId: 'client-1',
    decisions: [decision(), decision({ fieldKey: 'operatingHours.weekly.1' })],
    ...overrides,
  };
}

function plan(overrides: Partial<DualSyncPublishPlan> = {}): DualSyncPublishPlan {
  return {
    restaurantId: 'rest-1',
    coreSnapshotHash: 'core-snapshot',
    gbpSnapshotHash: 'gbp-snapshot',
    groups: [
      {
        groupId: 'export_to_google:profile:location.profile',
        direction: 'export_to_google',
        sectionKey: 'profile',
        writeGroup: 'location.profile',
        fields: [decision()],
        riskLevel: 'medium',
        requiresPreflight: true,
        requiresManualConfirmation: false,
        destructiveWritePossible: false,
        googleUpdateMasks: ['profile.description'],
      },
    ],
    rejected: [],
    warnings: [],
    acceptedCount: 1,
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
    pinnedCoreSnapshotHash: null,
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

function operation(overrides: Partial<DualSyncPublishOperation> = {}): DualSyncPublishOperation {
  return {
    id: 'op-1',
    restaurantId: 'rest-1',
    publishJobId: 'batch-1',
    publishBatchId: 'batch-1',
    operationGroupId: 'group-1',
    sectionKey: 'profile',
    fieldKey: 'profile.businessDescription',
    direction: 'export_to_google',
    status: 'pending',
    attemptCount: 0,
    beforeCoreHash: 'core-before',
    beforeGbpHash: 'gbp-before',
    afterCoreHash: null,
    afterGbpHash: null,
    googleUpdateMask: 'profile.description',
    errorCode: null,
    errorMessage: null,
    externalResponse: null,
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
    requiresPreflight: true,
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

function preparedDecision(
  overrides: Partial<PreparedPublishDecision> = {},
): PreparedPublishDecision {
  return {
    decision: decision(),
    beforeCoreHash: 'core-before',
    beforeGbpHash: 'gbp-before',
    direction: 'export_to_google',
    operation: operation(),
    operationGroupId: 'group-1',
    writeGroup: 'location.profile',
    googleUpdateMask: 'profile.description',
    ...overrides,
  };
}

function failure(overrides: Partial<DualSyncOperationFailure> = {}): DualSyncOperationFailure {
  return {
    code: 'GOOGLE_VALIDATION_FAILED',
    message: 'Google rejected the write.',
    retryable: false,
    ...overrides,
  };
}

function input(overrides: Partial<Parameters<typeof runPublishExecutionPhase>[0]> = {}) {
  const coreSnapshot = snapshot();
  const gbpSnapshot = snapshot({
    profile: { ...snapshot().profile, businessDescription: 'Google description' },
  });
  const readCoreSnapshot = vi.fn().mockResolvedValue(coreSnapshot);
  const readGbpSnapshot = vi.fn().mockResolvedValue(gbpSnapshot);
  const groups = [operationGroup()];
  return {
    client,
    restaurantId: 'rest-1',
    publishBatch: batch(),
    publishJobId: 'batch-1',
    input: publishInput(),
    plan: plan(),
    operationGroups: groups,
    operationGroupIdByKey: new Map(groups.map((group) => [group.groupKey, group.id] as const)),
    coreSnapshot,
    gbpSnapshot,
    registry,
    runtimeControls,
    ports,
    exportPreflight: vi.fn(),
    googleEditThrottle: { reserve: vi.fn() },
    readCoreSnapshot,
    readGbpSnapshot,
    ...overrides,
  };
}

describe('runPublishExecutionPhase', () => {
  beforeEach(() => {
    runRequiredExportPreflightsMock.mockReset();
    runRequiredExportPreflightsMock.mockResolvedValue(
      new Map([['operatingHours.weekly.1', failure()]]),
    );
    updatePublishBatchStatusMock.mockReset();
    updatePublishBatchStatusMock.mockResolvedValue(batch({ status: 'running' }));
    preparePublishDecisionsMock.mockReset();
    preparePublishDecisionsMock.mockResolvedValue({
      prepared: [preparedDecision()],
      failures: [{ fieldKey: 'operatingHours.weekly.1', failure: failure() }],
    });
    runBatchExportPortsMock.mockReset();
    runBatchExportPortsMock.mockResolvedValue(
      new Map([['profile.businessDescription', { status: 'succeeded' }]]),
    );
    executePreparedPublishOperationsMock.mockReset();
    executePreparedPublishOperationsMock.mockResolvedValue({
      failures: [{ fieldKey: 'operatingHours.weekly.1', failure: failure() }],
    });
    finalizePublishMock.mockReset();
    finalizePublishMock.mockResolvedValue({
      summary: {
        publishJobId: 'batch-1',
        restaurantId: 'rest-1',
        totalDecisions: 2,
        succeededCount: 1,
        failedCount: 0,
        skippedCount: 0,
        operations: [operation({ status: 'succeeded' })],
        failures: [{ fieldKey: 'operatingHours.weekly.1', failure: failure() }],
      },
    });
  });

  it('runs preflight, status update, preparation, batch export, execution, and finalization in order', async () => {
    const order: string[] = [];
    runRequiredExportPreflightsMock.mockImplementation(async () => {
      order.push('preflight');
      return new Map([['operatingHours.weekly.1', failure()]]);
    });
    updatePublishBatchStatusMock.mockImplementation(async () => {
      order.push('running');
      return batch({ status: 'running' });
    });
    preparePublishDecisionsMock.mockImplementation(async () => {
      order.push('prepare');
      return {
        prepared: [preparedDecision()],
        failures: [{ fieldKey: 'operatingHours.weekly.1', failure: failure() }],
      };
    });
    runBatchExportPortsMock.mockImplementation(async () => {
      order.push('batch-export');
      return new Map([['profile.businessDescription', { status: 'succeeded' }]]);
    });
    executePreparedPublishOperationsMock.mockImplementation(async () => {
      order.push('execute');
      return { failures: [{ fieldKey: 'operatingHours.weekly.1', failure: failure() }] };
    });
    finalizePublishMock.mockImplementation(async () => {
      order.push('finalize');
      return { summary: expect.objectContaining({ publishJobId: 'batch-1' }) };
    });

    await runPublishExecutionPhase(input());

    expect(order).toEqual([
      'preflight',
      'running',
      'prepare',
      'batch-export',
      'execute',
      'finalize',
    ]);
  });

  it('passes the expected context through every post-batch helper', async () => {
    const phaseInput = input();

    const result = await runPublishExecutionPhase(phaseInput);

    expect(runRequiredExportPreflightsMock).toHaveBeenCalledWith({
      client,
      restaurantId: 'rest-1',
      publishBatchId: 'batch-1',
      actorUserId: 'user-1',
      planGroups: phaseInput.plan.groups,
      operationGroupIdByKey: phaseInput.operationGroupIdByKey,
      coreSnapshot: phaseInput.coreSnapshot,
      gbpSnapshot: phaseInput.gbpSnapshot,
      exportPreflight: phaseInput.exportPreflight,
    });
    expect(updatePublishBatchStatusMock).toHaveBeenCalledWith({
      client,
      publishBatchId: 'batch-1',
      status: 'running',
      startedAt: expect.any(String),
    });
    expect(preparePublishDecisionsMock).toHaveBeenCalledWith({
      client,
      restaurantId: 'rest-1',
      publishJobId: 'batch-1',
      publishBatchId: 'batch-1',
      decisions: phaseInput.input.decisions,
      registry,
      coreSnapshot: phaseInput.coreSnapshot,
      gbpSnapshot: phaseInput.gbpSnapshot,
      preflightFailures: expect.any(Map),
      operationGroupIdByKey: phaseInput.operationGroupIdByKey,
      runtimeControls,
      actorUserId: 'user-1',
    });
    expect(runBatchExportPortsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        ports,
        decisions: [phaseInput.input.decisions[0]],
        coreSnapshot: phaseInput.coreSnapshot,
        gbpSnapshot: phaseInput.gbpSnapshot,
        registry,
        client,
        publishJobId: 'batch-1',
        restaurantId: 'rest-1',
        actorUserId: 'user-1',
        googleEditThrottle: phaseInput.googleEditThrottle,
      }),
    );
    expect(executePreparedPublishOperationsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        client,
        restaurantId: 'rest-1',
        publishJobId: 'batch-1',
        publishBatchId: 'batch-1',
        actorUserId: 'user-1',
        prepared: [expect.objectContaining({ direction: 'export_to_google' })],
        prebuiltResults: expect.any(Map),
        ports,
        coreSnapshot: phaseInput.coreSnapshot,
        gbpSnapshot: phaseInput.gbpSnapshot,
        googleEditThrottle: phaseInput.googleEditThrottle,
        failures: [{ fieldKey: 'operatingHours.weekly.1', failure: failure() }],
      }),
    );
    expect(finalizePublishMock).toHaveBeenCalledWith({
      client,
      restaurantId: 'rest-1',
      publishJobId: 'batch-1',
      publishBatchId: 'batch-1',
      input: phaseInput.input,
      operationGroups: phaseInput.operationGroups,
      failures: [{ fieldKey: 'operatingHours.weekly.1', failure: failure() }],
      readCoreSnapshot: phaseInput.readCoreSnapshot,
      readGbpSnapshot: phaseInput.readGbpSnapshot,
    });
    expect(result.summary).toMatchObject({
      publishJobId: 'batch-1',
      restaurantId: 'rest-1',
      totalDecisions: 2,
    });
  });
});
