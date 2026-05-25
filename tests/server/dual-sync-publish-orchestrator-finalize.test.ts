import { beforeEach, describe, expect, it, vi } from 'vitest';

const listOperationsForJobMock = vi.hoisted(() => vi.fn());
const updateOperationGroupStatusMock = vi.hoisted(() => vi.fn());
const updatePublishBatchStatusMock = vi.hoisted(() => vi.fn());
const listOpenOutboundCandidatesMock = vi.hoisted(() => vi.fn());
const resolveOutboundCandidateMock = vi.hoisted(() => vi.fn());
const recomputeAllStatesMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/dual-sync/publish/operations', () => ({
  listOperationsForJob: listOperationsForJobMock,
  updateOperationGroupStatus: updateOperationGroupStatusMock,
  updatePublishBatchStatus: updatePublishBatchStatusMock,
}));

vi.mock('@/server/dual-sync/outbound/candidates', () => ({
  listOpenOutboundCandidates: listOpenOutboundCandidatesMock,
  resolveOutboundCandidate: resolveOutboundCandidateMock,
}));

vi.mock('@/server/dual-sync/state/recompute', () => ({
  recomputeAllStates: recomputeAllStatesMock,
}));

import { finalizePublish } from '@/server/dual-sync/publish/orchestrator-finalize';

import type { DualSyncCanonicalSnapshot } from '@/server/dual-sync/snapshots/types';
import type {
  DualSyncPublishOperation,
  DualSyncPublishOperationGroup,
} from '@/server/dual-sync/types';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

const client = { from: vi.fn() } as unknown as SupabaseClient<Database>;
const coreSnapshot = { profile: { name: 'Core' } } as unknown as DualSyncCanonicalSnapshot;
const gbpSnapshot = { profile: { name: 'Google' } } as unknown as DualSyncCanonicalSnapshot;

function makeOperation(
  overrides: Partial<DualSyncPublishOperation> = {},
): DualSyncPublishOperation {
  return {
    id: 'op-1',
    restaurantId: 'rest-1',
    publishJobId: 'job-1',
    publishBatchId: 'batch-1',
    operationGroupId: 'group-1',
    sectionKey: 'profile',
    fieldKey: 'profile.businessDescription',
    direction: 'export_to_google',
    status: 'succeeded',
    attemptCount: 1,
    beforeCoreHash: 'core-before',
    beforeGbpHash: 'gbp-before',
    afterCoreHash: 'core-after',
    afterGbpHash: 'gbp-after',
    googleUpdateMask: 'profile',
    errorCode: null,
    errorMessage: null,
    externalResponse: null,
    startedAt: '2026-05-22T00:00:00.000Z',
    finishedAt: '2026-05-22T00:00:01.000Z',
    createdAt: '2026-05-22T00:00:00.000Z',
    updatedAt: '2026-05-22T00:00:01.000Z',
    ...overrides,
  };
}

function makeGroup(
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
    status: 'running',
    riskLevel: 'medium',
    requiresPreflight: false,
    requiresManualConfirmation: false,
    destructiveWritePossible: false,
    googleUpdateMasks: ['profile'],
    decisionCount: 1,
    preflightStatus: null,
    preflightResult: null,
    requestSummary: null,
    responseSummary: null,
    errorCode: null,
    errorMessage: null,
    startedAt: '2026-05-22T00:00:00.000Z',
    finishedAt: null,
    createdAt: '2026-05-22T00:00:00.000Z',
    updatedAt: '2026-05-22T00:00:00.000Z',
    ...overrides,
  };
}

function makeInput(
  overrides: Partial<Parameters<typeof finalizePublish>[0]> = {},
): Parameters<typeof finalizePublish>[0] {
  return {
    client,
    restaurantId: 'rest-1',
    publishJobId: 'job-1',
    publishBatchId: 'batch-1',
    input: {
      restaurantId: 'rest-1',
      decisions: [
        {
          fieldKey: 'profile.businessDescription',
          sectionKey: 'profile',
          action: 'export_to_google',
          pinnedCoreHash: 'core-before',
          pinnedGbpHash: 'gbp-before',
        },
      ],
      actorUserId: 'user-1',
    },
    operationGroups: [makeGroup()],
    failures: [],
    readCoreSnapshot: vi.fn().mockResolvedValue(coreSnapshot),
    readGbpSnapshot: vi.fn().mockResolvedValue(gbpSnapshot),
    ...overrides,
  };
}

describe('finalizePublish', () => {
  beforeEach(() => {
    listOperationsForJobMock.mockReset();
    listOperationsForJobMock.mockResolvedValue([makeOperation()]);
    updateOperationGroupStatusMock.mockReset();
    updateOperationGroupStatusMock.mockResolvedValue(null);
    updatePublishBatchStatusMock.mockReset();
    updatePublishBatchStatusMock.mockResolvedValue(null);
    listOpenOutboundCandidatesMock.mockReset();
    listOpenOutboundCandidatesMock.mockResolvedValue([]);
    resolveOutboundCandidateMock.mockReset();
    resolveOutboundCandidateMock.mockResolvedValue(null);
    recomputeAllStatesMock.mockReset();
    recomputeAllStatesMock.mockResolvedValue({ evaluatedFieldKeys: [], transitions: [] });
  });

  it('updates operation group summaries from final operations', async () => {
    await finalizePublish(makeInput());

    expect(listOperationsForJobMock).toHaveBeenCalledWith({ client, publishJobId: 'job-1' });
    expect(updateOperationGroupStatusMock).toHaveBeenCalledWith(
      expect.objectContaining({
        client,
        operationGroupId: 'group-1',
        status: 'succeeded',
        responseSummary: expect.objectContaining({
          operationIds: ['op-1'],
          fieldKeys: ['profile.businessDescription'],
          counts: expect.objectContaining({ total: 1, succeeded: 1 }),
        }),
        errorCode: null,
        errorMessage: null,
      }),
    );
  });

  it('resolves only open outbound candidates whose field succeeded', async () => {
    listOperationsForJobMock.mockResolvedValue([
      makeOperation({ fieldKey: 'profile.businessDescription', status: 'succeeded' }),
      makeOperation({
        id: 'op-2',
        fieldKey: 'profile.name',
        status: 'failed',
        errorCode: 'GOOGLE_VALIDATION_FAILED',
      }),
    ]);
    listOpenOutboundCandidatesMock.mockResolvedValue([
      { id: 'cand-1', fieldKey: 'profile.businessDescription' },
      { id: 'cand-2', fieldKey: 'profile.name' },
    ]);

    await finalizePublish(makeInput());

    expect(resolveOutboundCandidateMock).toHaveBeenCalledTimes(1);
    expect(resolveOutboundCandidateMock).toHaveBeenCalledWith({
      client,
      id: 'cand-1',
      nextStatus: 'resolved',
    });
  });

  it('recomputes with freshly read snapshots and updates the batch status', async () => {
    const readCoreSnapshot = vi.fn().mockResolvedValue(coreSnapshot);
    const readGbpSnapshot = vi.fn().mockResolvedValue(gbpSnapshot);

    await finalizePublish(makeInput({ readCoreSnapshot, readGbpSnapshot }));

    expect(readCoreSnapshot).toHaveBeenCalledWith({ client, restaurantId: 'rest-1' });
    expect(readGbpSnapshot).toHaveBeenCalledWith({ client, restaurantId: 'rest-1' });
    expect(recomputeAllStatesMock).toHaveBeenCalledWith({
      client,
      restaurantId: 'rest-1',
      coreSnapshot,
      gbpSnapshot,
    });
    expect(updatePublishBatchStatusMock).toHaveBeenCalledWith(
      expect.objectContaining({
        client,
        publishBatchId: 'batch-1',
        status: 'succeeded',
      }),
    );
  });

  it('includes accumulated failures in final status and summary', async () => {
    listOperationsForJobMock.mockResolvedValue([
      makeOperation({
        status: 'failed',
        errorCode: 'GOOGLE_VALIDATION_FAILED',
        errorMessage: 'Invalid.',
      }),
    ]);

    const result = await finalizePublish(
      makeInput({
        failures: [
          {
            fieldKey: 'profile.businessDescription',
            failure: {
              code: 'GOOGLE_VALIDATION_FAILED',
              message: 'Invalid.',
              retryable: false,
            },
          },
        ],
      }),
    );

    expect(updatePublishBatchStatusMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed' }),
    );
    expect(result.summary).toMatchObject({
      publishJobId: 'job-1',
      restaurantId: 'rest-1',
      totalDecisions: 1,
      failedCount: 1,
      failures: [
        {
          fieldKey: 'profile.businessDescription',
          failure: { code: 'GOOGLE_VALIDATION_FAILED', message: 'Invalid.' },
        },
      ],
    });
  });
});
