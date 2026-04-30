import { beforeEach, describe, expect, it, vi } from 'vitest';

const createOperationMock = vi.hoisted(() => vi.fn());
const updateOperationStatusMock = vi.hoisted(() => vi.fn());
const listOperationsForJobMock = vi.hoisted(() => vi.fn());

const recomputeAllStatesMock = vi.hoisted(() => vi.fn());
const markInSyncMock = vi.hoisted(() => vi.fn());
const markFailedMock = vi.hoisted(() => vi.fn());
const markIgnoredMock = vi.hoisted(() => vi.fn());

const listOpenOutboundCandidatesMock = vi.hoisted(() => vi.fn());
const resolveOutboundCandidateMock = vi.hoisted(() => vi.fn());

const readNabatableSnapshotMock = vi.hoisted(() => vi.fn());
const readGoogleSnapshotMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/dual-sync/publish/operations', () => ({
  createOperation: createOperationMock,
  updateOperationStatus: updateOperationStatusMock,
  listOperationsForJob: listOperationsForJobMock,
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

import { runPublish } from '@/server/dual-sync/publish/orchestrator';

import type { DualSyncOrchestratorPorts } from '@/server/dual-sync/publish/ports';
import type { DualSyncPublishDecision } from '@/server/dual-sync/publish/types';
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

function makeDecision(
  over: Partial<DualSyncPublishDecision> = {},
): DualSyncPublishDecision {
  return {
    fieldKey: 'profile.businessDescription',
    sectionKey: 'profile',
    action: 'import_from_google',
    pinnedCoreHash: null,
    pinnedGbpHash: null,
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
    recomputeAllStatesMock.mockReset();
    markInSyncMock.mockReset();
    markFailedMock.mockReset();
    markIgnoredMock.mockReset();
    listOpenOutboundCandidatesMock.mockReset();
    resolveOutboundCandidateMock.mockReset();
    readNabatableSnapshotMock.mockReset();
    readGoogleSnapshotMock.mockReset();

    readNabatableSnapshotMock.mockResolvedValue(makeSnapshot());
    readGoogleSnapshotMock.mockResolvedValue(makeSnapshot());

    createOperationMock.mockImplementation(async () => noopOperation());
    updateOperationStatusMock.mockImplementation(async () => noopOperation());
    listOperationsForJobMock.mockResolvedValue([]);
    recomputeAllStatesMock.mockResolvedValue({
      evaluatedFieldKeys: [],
      transitions: [],
    });
    listOpenOutboundCandidatesMock.mockResolvedValue([]);
  });

  it('calls applyImportToCore for an import decision and stamps in_sync on success', async () => {
    listOperationsForJobMock.mockResolvedValue([
      noopOperation({ status: 'succeeded' }),
    ]);

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
    listOperationsForJobMock.mockResolvedValue([
      noopOperation({ status: 'succeeded' }),
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
        actorUserId: null,
      },
      { ports },
    );

    expect(ports.applyExportToGoogle).toHaveBeenCalledTimes(1);
    expect(ports.applyImportToCore).not.toHaveBeenCalled();
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
        actorUserId: null,
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
        actorUserId: null,
      },
      { ports },
    );

    expect(createOperationMock).not.toHaveBeenCalled();
    expect(ports.applyImportToCore).not.toHaveBeenCalled();
    expect(result.summary.failures).toHaveLength(1);
    expect(result.summary.failures[0]?.failure.code).toBe('CORE_DRIFT');
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
        actorUserId: null,
      },
      { ports },
    );

    expect(markFailedMock).toHaveBeenCalledWith(
      expect.objectContaining({ direction: 'import' }),
    );
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
        actorUserId: null,
      },
      { ports },
    );

    expect(createOperationMock).not.toHaveBeenCalled();
    expect(result.summary.failures[0]?.failure.code).toBe('INVALID_DECISION');
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
        actorUserId: null,
      },
      { ports },
    );

    expect(ports.applyExportBatchToGoogle).toHaveBeenCalledTimes(1);
    expect(ports.applyExportToGoogle).not.toHaveBeenCalled();
    expect(createOperationMock).toHaveBeenCalledTimes(2);
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
        actorUserId: null,
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
        actorUserId: null,
      },
      { ports },
    );

    expect(ports.applyExportBatchToGoogle).toHaveBeenCalledTimes(1);
    expect(ports.applyExportToGoogle).toHaveBeenCalledTimes(2);
  });

  it('routes every decision in the group to PORT_FAILURE when the batch port throws', async () => {
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
        actorUserId: null,
      },
      { ports },
    );

    expect(ports.applyExportToGoogle).not.toHaveBeenCalled();
    expect(result.summary.failures).toHaveLength(2);
    expect(result.summary.failures.every((f) => f.failure.code === 'PORT_FAILURE')).toBe(
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
