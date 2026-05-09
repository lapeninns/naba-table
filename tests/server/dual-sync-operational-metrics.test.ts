import { describe, expect, it } from 'vitest';

import { summarizeDualSyncOperationalMetrics } from '@/server/dual-sync/observability';

import type { DualSyncJob, DualSyncPublishOperation } from '@/server/dual-sync/types';

function job(over: Partial<DualSyncJob> = {}): DualSyncJob {
  return {
    id: 'job-1',
    restaurantId: 'rest-1',
    provider: 'google_business_profile',
    jobKind: 'publish_batch',
    status: 'queued',
    idempotencyKey: null,
    priority: 100,
    payload: {},
    attemptCount: 0,
    maxAttempts: 3,
    availableAt: '2026-05-09T12:00:00.000Z',
    lockedAt: null,
    lockedBy: null,
    lastErrorCode: null,
    lastErrorMessage: null,
    deadLetterReason: null,
    startedAt: null,
    finishedAt: null,
    createdAt: '2026-05-09T12:00:00.000Z',
    updatedAt: '2026-05-09T12:00:00.000Z',
    ...over,
  };
}

function operation(over: Partial<DualSyncPublishOperation> = {}): DualSyncPublishOperation {
  return {
    id: 'op-1',
    restaurantId: 'rest-1',
    publishJobId: 'publish-1',
    publishBatchId: 'batch-1',
    operationGroupId: 'group-1',
    sectionKey: 'profile',
    fieldKey: 'profile.name',
    direction: 'export_to_google',
    status: 'succeeded',
    attemptCount: 1,
    beforeCoreHash: 'core-before',
    beforeGbpHash: 'gbp-before',
    afterCoreHash: 'core-after',
    afterGbpHash: 'gbp-after',
    googleUpdateMask: 'title',
    errorCode: null,
    errorMessage: null,
    externalResponse: null,
    startedAt: '2026-05-09T12:00:00.000Z',
    finishedAt: '2026-05-09T12:00:01.000Z',
    createdAt: '2026-05-09T12:00:00.000Z',
    updatedAt: '2026-05-09T12:00:01.000Z',
    ...over,
  };
}

describe('summarizeDualSyncOperationalMetrics', () => {
  it('builds alerting metrics from queue jobs and publish operations', () => {
    const metrics = summarizeDualSyncOperationalMetrics({
      restaurantId: 'rest-1',
      windowStart: '2026-05-08T12:00:00.000Z',
      windowEnd: '2026-05-09T12:00:00.000Z',
      thresholds: {
        queueBacklogWarning: 2,
        quotaLimitedWarning: 1,
        staleDecisionWarning: 1,
      },
      jobs: [
        job({ id: 'queued-1', status: 'queued' }),
        job({ id: 'retrying-1', status: 'retrying', lastErrorCode: 'QUOTA_LIMITED' }),
        job({ id: 'dead-1', status: 'dead_letter', lastErrorCode: 'REAUTH_REQUIRED' }),
      ],
      operations: [
        operation({ id: 'op-success', publishJobId: 'publish-mixed', status: 'succeeded' }),
        operation({
          id: 'op-failed',
          publishJobId: 'publish-mixed',
          status: 'failed',
          errorCode: 'CORE_DRIFT',
        }),
      ],
    });

    expect(metrics.queueBacklog).toBe(2);
    expect(metrics.deadLetterJobs).toBe(1);
    expect(metrics.partialPublishFailures).toBe(1);
    expect(metrics.failureCounts).toEqual(
      expect.objectContaining({
        QUOTA_LIMITED: 1,
        REAUTH_REQUIRED: 1,
        CORE_DRIFT: 1,
      }),
    );
    expect(metrics.alerts.map((alert) => alert.code)).toEqual(
      expect.arrayContaining([
        'QUEUE_BACKLOG',
        'DEAD_LETTER_JOBS',
        'QUOTA_LIMITED',
        'REAUTH_REQUIRED',
        'STALE_DECISIONS',
        'PARTIAL_PUBLISH_FAILURES',
      ]),
    );
  });
});
