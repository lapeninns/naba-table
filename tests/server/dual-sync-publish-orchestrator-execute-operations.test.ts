import { beforeEach, describe, expect, it, vi } from 'vitest';

const updateOperationStatusMock = vi.hoisted(() => vi.fn());
const updateOperationGroupStatusMock = vi.hoisted(() => vi.fn());
const createGoogleRequestLogMock = vi.hoisted(() => vi.fn());
const markInSyncMock = vi.hoisted(() => vi.fn());
const markFailedMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/dual-sync/publish/operations', () => ({
  updateOperationStatus: updateOperationStatusMock,
  updateOperationGroupStatus: updateOperationGroupStatusMock,
}));

vi.mock('@/server/dual-sync/publish/google-request-logs', () => ({
  createGoogleRequestLog: createGoogleRequestLogMock,
}));

vi.mock('@/server/dual-sync/state/write', () => ({
  markInSync: markInSyncMock,
  markFailed: markFailedMock,
}));

import { executePreparedPublishOperations } from '@/server/dual-sync/publish/orchestrator-execute-operations';

import type { PreparedPublishDecision } from '@/server/dual-sync/publish/orchestrator-prepare-decisions';
import type { DualSyncOrchestratorPorts } from '@/server/dual-sync/publish/ports';
import type { DualSyncCanonicalSnapshot } from '@/server/dual-sync/snapshots/types';
import type { DualSyncPublishOperation } from '@/server/dual-sync/types';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

const client = { from: vi.fn() } as unknown as SupabaseClient<Database>;
const snapshot = {} as DualSyncCanonicalSnapshot;

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
    direction: 'import_from_google',
    status: 'pending',
    attemptCount: 0,
    beforeCoreHash: 'core-before',
    beforeGbpHash: 'gbp-before',
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

function makePrepared(overrides: Partial<PreparedPublishDecision> = {}): PreparedPublishDecision {
  const action = overrides.decision?.action ?? 'import_from_google';
  const direction = action === 'export_to_google' ? 'export_to_google' : 'import_from_google';
  const operation = makeOperation({
    direction,
    ...(overrides.operation ?? {}),
  });
  return {
    decision: {
      fieldKey: 'profile.businessDescription',
      sectionKey: 'profile',
      action,
      pinnedCoreHash: 'core-before',
      pinnedGbpHash: 'gbp-before',
      ...overrides.decision,
    },
    beforeCoreHash: overrides.beforeCoreHash ?? 'core-before',
    beforeGbpHash: overrides.beforeGbpHash ?? 'gbp-before',
    direction,
    operation,
    operationGroupId: overrides.operationGroupId ?? 'group-1',
    writeGroup:
      overrides.writeGroup ?? (direction === 'export_to_google' ? 'location.profile' : null),
    googleUpdateMask:
      overrides.googleUpdateMask ?? (direction === 'export_to_google' ? 'profile' : null),
  };
}

function makePorts(overrides: Partial<DualSyncOrchestratorPorts> = {}): DualSyncOrchestratorPorts {
  return {
    applyImportToCore: vi.fn().mockResolvedValue({ status: 'succeeded' }),
    applyExportToGoogle: vi.fn().mockResolvedValue({ status: 'succeeded' }),
    ...overrides,
  };
}

function makeInput(
  overrides: Partial<Parameters<typeof executePreparedPublishOperations>[0]> = {},
): Parameters<typeof executePreparedPublishOperations>[0] {
  return {
    client,
    restaurantId: 'rest-1',
    publishJobId: 'job-1',
    publishBatchId: 'batch-1',
    actorUserId: 'user-1',
    prepared: [makePrepared()],
    prebuiltResults: new Map(),
    ports: makePorts(),
    coreSnapshot: snapshot,
    gbpSnapshot: snapshot,
    failures: [],
    ...overrides,
  };
}

describe('executePreparedPublishOperations', () => {
  beforeEach(() => {
    updateOperationStatusMock.mockReset();
    updateOperationStatusMock.mockResolvedValue(null);
    updateOperationGroupStatusMock.mockReset();
    updateOperationGroupStatusMock.mockResolvedValue(null);
    createGoogleRequestLogMock.mockReset();
    createGoogleRequestLogMock.mockResolvedValue(null);
    markInSyncMock.mockReset();
    markInSyncMock.mockResolvedValue(undefined);
    markFailedMock.mockReset();
    markFailedMock.mockResolvedValue(undefined);
  });

  it('runs import ports and marks successful imports in sync with the Google hash', async () => {
    const ports = makePorts({
      applyImportToCore: vi.fn().mockResolvedValue({ status: 'succeeded' }),
    });

    const result = await executePreparedPublishOperations(makeInput({ ports }));

    expect(result.failures).toEqual([]);
    expect(ports.applyImportToCore).toHaveBeenCalledWith(
      expect.objectContaining({
        client,
        restaurantId: 'rest-1',
        publishJobId: 'job-1',
        actorUserId: 'user-1',
      }),
    );
    expect(updateOperationGroupStatusMock).toHaveBeenCalledWith(
      expect.objectContaining({ operationGroupId: 'group-1', status: 'running' }),
    );
    expect(updateOperationStatusMock).toHaveBeenCalledWith(
      expect.objectContaining({ operationId: 'op-1', status: 'running', attemptCount: 1 }),
    );
    expect(updateOperationStatusMock).toHaveBeenCalledWith(
      expect.objectContaining({ operationId: 'op-1', status: 'succeeded' }),
    );
    expect(markInSyncMock).toHaveBeenCalledWith({
      client,
      restaurantId: 'rest-1',
      sectionKey: 'profile',
      fieldKey: 'profile.businessDescription',
      inSyncHash: 'gbp-before',
    });
  });

  it('reuses prebuilt export results and skips per-field export ports', async () => {
    const prepared = makePrepared({
      decision: { action: 'export_to_google' },
    });
    const ports = makePorts({
      applyExportToGoogle: vi.fn(),
    });

    const result = await executePreparedPublishOperations(
      makeInput({
        prepared: [prepared],
        ports,
        prebuiltResults: new Map([
          [
            'profile.businessDescription',
            {
              status: 'succeeded',
              externalResponse: { providerBody: 'private-provider-body' },
            },
          ],
        ]),
      }),
    );

    expect(result.failures).toEqual([]);
    expect(ports.applyExportToGoogle).not.toHaveBeenCalled();
    expect(createGoogleRequestLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        publishOperationId: 'op-1',
        phase: 'provider_write',
        status: 'succeeded',
        googleMethod: 'location.profile',
        googleUpdateMasks: ['profile'],
        responseSummary: { responseHash: expect.stringMatching(/^[a-f0-9]{64}$/) },
      }),
    );
    expect(JSON.stringify(createGoogleRequestLogMock.mock.calls)).not.toContain(
      'private-provider-body',
    );
    expect(markInSyncMock).toHaveBeenCalledWith(
      expect.objectContaining({ inSyncHash: 'core-before' }),
    );
  });

  it('records export throttle failures without calling the export port', async () => {
    const prepared = makePrepared({ decision: { action: 'export_to_google' } });
    const ports = makePorts({ applyExportToGoogle: vi.fn() });

    const result = await executePreparedPublishOperations(
      makeInput({
        prepared: [prepared],
        ports,
        googleEditThrottle: {
          reserve: vi.fn().mockResolvedValue({
            allowed: false,
            retryAfterMs: 60000,
            remaining: 0,
          }),
        },
      }),
    );

    expect(ports.applyExportToGoogle).not.toHaveBeenCalled();
    expect(result.failures).toEqual([
      {
        fieldKey: 'profile.businessDescription',
        failure: expect.objectContaining({ code: 'QUOTA_LIMITED', retryable: true }),
      },
    ]);
    expect(updateOperationStatusMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed', errorCode: 'QUOTA_LIMITED' }),
    );
    expect(markFailedMock).toHaveBeenCalledWith(
      expect.objectContaining({ fieldKey: 'profile.businessDescription', direction: 'export' }),
    );
  });

  it('maps thrown port errors and marks failed imports', async () => {
    const ports = makePorts({
      applyImportToCore: vi.fn().mockRejectedValue(new Error('core write failed')),
    });

    const result = await executePreparedPublishOperations(makeInput({ ports }));

    expect(result.failures).toEqual([
      {
        fieldKey: 'profile.businessDescription',
        failure: expect.objectContaining({
          code: 'EXTERNAL_API_ERROR',
          message: 'core write failed',
          retryable: true,
        }),
      },
    ]);
    expect(markFailedMock).toHaveBeenCalledWith(
      expect.objectContaining({ fieldKey: 'profile.businessDescription', direction: 'import' }),
    );
  });
});
