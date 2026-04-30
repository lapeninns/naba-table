import { describe, expect, it } from 'vitest';

import { summarizeOperationsByJob } from '@/server/dual-sync/publish/operations';

import type { DualSyncPublishOperation } from '@/server/dual-sync/types';

function makeOp(over: Partial<DualSyncPublishOperation> = {}): DualSyncPublishOperation {
  return {
    id: 'op-1',
    restaurantId: 'rest-1',
    publishJobId: 'job-1',
    sectionKey: 'profile',
    fieldKey: 'profile.name',
    direction: 'export_to_google',
    status: 'succeeded',
    attemptCount: 1,
    beforeCoreHash: null,
    beforeGbpHash: null,
    afterCoreHash: 'h-1',
    afterGbpHash: 'h-1',
    googleUpdateMask: null,
    errorCode: null,
    errorMessage: null,
    externalResponse: null,
    startedAt: '2026-04-29T00:00:00.000Z',
    finishedAt: '2026-04-29T00:00:01.000Z',
    createdAt: '2026-04-29T00:00:00.000Z',
    updatedAt: '2026-04-29T00:00:01.000Z',
    ...over,
  };
}

describe('summarizeOperationsByJob', () => {
  it('returns an empty list when there are no operations', () => {
    expect(summarizeOperationsByJob([])).toEqual([]);
  });

  it('groups operations by publishJobId and aggregates status counts', () => {
    const operations: DualSyncPublishOperation[] = [
      makeOp({
        id: 'op-1',
        publishJobId: 'job-A',
        status: 'succeeded',
        sectionKey: 'profile',
      }),
      makeOp({
        id: 'op-2',
        publishJobId: 'job-A',
        status: 'failed',
        errorCode: 'PORT_FAILURE',
        sectionKey: 'profile',
      }),
      makeOp({
        id: 'op-3',
        publishJobId: 'job-A',
        status: 'skipped',
        sectionKey: 'operatingHours',
      }),
      makeOp({
        id: 'op-4',
        publishJobId: 'job-B',
        status: 'succeeded',
        sectionKey: 'businessContext.attributes',
      }),
    ];
    const rollups = summarizeOperationsByJob(operations);
    expect(rollups).toHaveLength(2);
    const jobA = rollups.find((r) => r.publishJobId === 'job-A');
    expect(jobA).toBeDefined();
    expect(jobA?.totalOperations).toBe(3);
    expect(jobA?.succeededCount).toBe(1);
    expect(jobA?.failedCount).toBe(1);
    expect(jobA?.skippedCount).toBe(1);
    expect(jobA?.sections).toEqual(
      expect.arrayContaining(['profile', 'operatingHours']),
    );
    expect(jobA?.errorCodes).toEqual(['PORT_FAILURE']);
  });

  it('marks finishedAt null when any operation is unfinished', () => {
    const operations: DualSyncPublishOperation[] = [
      makeOp({
        id: 'op-1',
        publishJobId: 'job-X',
        status: 'succeeded',
        finishedAt: '2026-04-29T00:00:01.000Z',
      }),
      makeOp({
        id: 'op-2',
        publishJobId: 'job-X',
        status: 'running',
        finishedAt: null,
      }),
    ];
    const [rollup] = summarizeOperationsByJob(operations);
    expect(rollup?.finishedAt).toBeNull();
    expect(rollup?.otherCount).toBe(1);
  });

  it('takes the earliest createdAt and the latest finishedAt for completed jobs', () => {
    const operations: DualSyncPublishOperation[] = [
      makeOp({
        id: 'op-1',
        publishJobId: 'job-Y',
        createdAt: '2026-04-29T00:00:01.000Z',
        finishedAt: '2026-04-29T00:00:02.000Z',
        startedAt: '2026-04-29T00:00:01.000Z',
      }),
      makeOp({
        id: 'op-2',
        publishJobId: 'job-Y',
        createdAt: '2026-04-29T00:00:00.500Z',
        finishedAt: '2026-04-29T00:00:03.000Z',
        startedAt: '2026-04-29T00:00:00.500Z',
      }),
    ];
    const [rollup] = summarizeOperationsByJob(operations);
    expect(rollup?.startedAt).toBe('2026-04-29T00:00:00.500Z');
    expect(rollup?.finishedAt).toBe('2026-04-29T00:00:03.000Z');
  });

  it('counts directions and sections distinctly', () => {
    const operations: DualSyncPublishOperation[] = [
      makeOp({ id: 'op-1', publishJobId: 'job-Z', direction: 'export_to_google', sectionKey: 'profile' }),
      makeOp({ id: 'op-2', publishJobId: 'job-Z', direction: 'export_to_google', sectionKey: 'profile' }),
      makeOp({ id: 'op-3', publishJobId: 'job-Z', direction: 'import_from_google', sectionKey: 'businessContext.categories' }),
    ];
    const [rollup] = summarizeOperationsByJob(operations);
    expect(rollup?.exportCount).toBe(2);
    expect(rollup?.importCount).toBe(1);
    expect(rollup?.sections).toHaveLength(2);
  });

  it('orders rollups by startedAt descending', () => {
    const operations: DualSyncPublishOperation[] = [
      makeOp({
        id: 'op-1',
        publishJobId: 'job-old',
        createdAt: '2026-04-29T00:00:00.000Z',
        startedAt: '2026-04-29T00:00:00.000Z',
        finishedAt: '2026-04-29T00:00:01.000Z',
      }),
      makeOp({
        id: 'op-2',
        publishJobId: 'job-new',
        createdAt: '2026-04-29T00:01:00.000Z',
        startedAt: '2026-04-29T00:01:00.000Z',
        finishedAt: '2026-04-29T00:01:01.000Z',
      }),
    ];
    const rollups = summarizeOperationsByJob(operations);
    expect(rollups.map((r) => r.publishJobId)).toEqual(['job-new', 'job-old']);
  });

  it('aggregates only the error codes that actually appeared', () => {
    const operations: DualSyncPublishOperation[] = [
      makeOp({ id: 'op-1', publishJobId: 'job-E', status: 'failed', errorCode: 'CORE_DRIFT' }),
      makeOp({ id: 'op-2', publishJobId: 'job-E', status: 'failed', errorCode: 'CORE_DRIFT' }),
      makeOp({ id: 'op-3', publishJobId: 'job-E', status: 'failed', errorCode: 'GBP_DRIFT' }),
      makeOp({ id: 'op-4', publishJobId: 'job-E', status: 'succeeded', errorCode: null }),
    ];
    const [rollup] = summarizeOperationsByJob(operations);
    expect(rollup?.errorCodes).toEqual(
      expect.arrayContaining(['CORE_DRIFT', 'GBP_DRIFT']),
    );
    expect(rollup?.errorCodes).toHaveLength(2);
    expect(rollup?.failedCount).toBe(3);
  });
});
