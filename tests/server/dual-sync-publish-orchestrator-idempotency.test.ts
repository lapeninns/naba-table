import { beforeEach, describe, expect, it, vi } from 'vitest';

const findPublishBatchByClientRequestMock = vi.hoisted(() => vi.fn());
const listOperationsForJobMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/dual-sync/publish/operations', () => ({
  findPublishBatchByClientRequest: findPublishBatchByClientRequestMock,
  listOperationsForJob: listOperationsForJobMock,
}));

import { resolveClientRequestReplay } from '@/server/dual-sync/publish/orchestrator-idempotency';

import type { DualSyncPublishDecision } from '@/server/dual-sync/publish/types';
import type { DualSyncPublishOperation } from '@/server/dual-sync/types';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

const client = { from: vi.fn() } as unknown as SupabaseClient<Database>;

function decision(overrides: Partial<DualSyncPublishDecision> = {}): DualSyncPublishDecision {
  return {
    fieldKey: 'profile.businessDescription',
    sectionKey: 'profile',
    action: 'export_to_google',
    pinnedCoreHash: 'core-field-hash',
    pinnedGbpHash: 'gbp-field-hash',
    ...overrides,
  };
}

function operation(overrides: Partial<DualSyncPublishOperation> = {}): DualSyncPublishOperation {
  return {
    id: 'op-1',
    restaurantId: 'rest-1',
    publishJobId: 'batch-1',
    publishBatchId: 'batch-1',
    operationGroupId: null,
    sectionKey: 'profile',
    fieldKey: 'profile.businessDescription',
    direction: 'export_to_google',
    status: 'succeeded',
    attemptCount: 1,
    beforeCoreHash: 'core-before',
    beforeGbpHash: 'gbp-before',
    afterCoreHash: 'core-after',
    afterGbpHash: 'gbp-after',
    googleUpdateMask: null,
    errorCode: null,
    errorMessage: null,
    externalResponse: null,
    startedAt: '2026-05-22T08:00:00.000Z',
    finishedAt: '2026-05-22T08:00:01.000Z',
    createdAt: '2026-05-22T08:00:00.000Z',
    updatedAt: '2026-05-22T08:00:01.000Z',
    ...overrides,
  };
}

function input(
  overrides: Partial<Parameters<typeof resolveClientRequestReplay>[0]> = {},
): Parameters<typeof resolveClientRequestReplay>[0] {
  return {
    client,
    restaurantId: 'rest-1',
    clientRequestId: 'client-1',
    decisionHash: 'decision-hash',
    decisions: [decision(), decision({ fieldKey: 'operatingHours.weekly.1' })],
    ...overrides,
  };
}

describe('resolveClientRequestReplay', () => {
  beforeEach(() => {
    findPublishBatchByClientRequestMock.mockReset();
    listOperationsForJobMock.mockReset();
  });

  it('does not query existing batches when no client request id was supplied', async () => {
    const result = await resolveClientRequestReplay(input({ clientRequestId: null }));

    expect(result).toBeNull();
    expect(findPublishBatchByClientRequestMock).not.toHaveBeenCalled();
    expect(listOperationsForJobMock).not.toHaveBeenCalled();
  });

  it('returns null when the client request id has not been seen before', async () => {
    findPublishBatchByClientRequestMock.mockResolvedValue(null);

    const result = await resolveClientRequestReplay(input());

    expect(result).toBeNull();
    expect(findPublishBatchByClientRequestMock).toHaveBeenCalledWith({
      client,
      restaurantId: 'rest-1',
      clientRequestId: 'client-1',
    });
    expect(listOperationsForJobMock).not.toHaveBeenCalled();
  });

  it('rejects a reused client request id with a different decision hash', async () => {
    findPublishBatchByClientRequestMock.mockResolvedValue({
      id: 'batch-1',
      decisionHash: 'different-hash',
    });

    const result = await resolveClientRequestReplay(input());

    expect(listOperationsForJobMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      publishJobId: 'batch-1',
      restaurantId: 'rest-1',
      totalDecisions: 2,
      operations: [],
      failures: [
        {
          fieldKey: 'profile.businessDescription',
          failure: {
            code: 'INVALID_DECISION',
            message: 'Client request id was already used for a different publish decision set.',
            retryable: false,
          },
        },
        {
          fieldKey: 'operatingHours.weekly.1',
          failure: {
            code: 'INVALID_DECISION',
            message: 'Client request id was already used for a different publish decision set.',
            retryable: false,
          },
        },
      ],
    });
  });

  it('returns the existing operations summary when the decision hash matches', async () => {
    const operations = [operation()];
    findPublishBatchByClientRequestMock.mockResolvedValue({
      id: 'batch-1',
      decisionHash: 'decision-hash',
    });
    listOperationsForJobMock.mockResolvedValue(operations);

    const result = await resolveClientRequestReplay(input());

    expect(listOperationsForJobMock).toHaveBeenCalledWith({
      client,
      publishJobId: 'batch-1',
    });
    expect(result).toEqual({
      publishJobId: 'batch-1',
      restaurantId: 'rest-1',
      totalDecisions: 2,
      succeededCount: 1,
      failedCount: 0,
      skippedCount: 0,
      operations,
      failures: [],
    });
  });
});
