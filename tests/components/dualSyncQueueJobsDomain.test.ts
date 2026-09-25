import { describe, expect, it } from 'vitest';

import {
  DUAL_SYNC_QUEUE_JOB_KIND_LABEL,
  DUAL_SYNC_QUEUE_JOB_STATUS_LABEL,
  DUAL_SYNC_QUEUE_JOB_STATUS_VARIANT,
  buildDualSyncQueueJobsPanelModel,
  canRetryQueueJob,
  formatQueueJobErrorPreview,
  formatQueueJobShortId,
  formatQueueJobTimestamp,
  getDualSyncQueueJobRetryErrorToastIntent,
  getDualSyncQueueJobRetrySuccessToastIntent,
  getQueueJobStatusIconKey,
} from '@/components/features/restaurant-settings/dual-sync/panels/jobs/dualSyncQueueJobsDomain';

import type { DualSyncJob } from '@/server/dual-sync';

function makeJob(overrides: Partial<DualSyncJob> = {}): DualSyncJob {
  return {
    id: 'queue-job-123456789',
    restaurantId: 'restaurant-1',
    provider: 'google_business_profile',
    jobKind: 'publish_batch',
    status: 'dead_letter',
    idempotencyKey: 'request-1',
    priority: 100,
    payload: {},
    attemptCount: 3,
    maxAttempts: 3,
    availableAt: '2026-05-09T12:00:00.000Z',
    lockedAt: null,
    lockedBy: null,
    lastErrorCode: 'QUOTA_LIMITED',
    lastErrorMessage: 'Google edit budget exhausted.',
    deadLetterReason: 'Google edit budget exhausted.',
    startedAt: '2026-05-09T11:59:00.000Z',
    finishedAt: '2026-05-09T12:00:00.000Z',
    createdAt: '2026-05-09T11:58:00.000Z',
    updatedAt: '2026-05-09T12:00:00.000Z',
    ...overrides,
  };
}

describe('dualSyncQueueJobsDomain', () => {
  it('formats status and job kind labels', () => {
    expect(DUAL_SYNC_QUEUE_JOB_STATUS_LABEL.dead_letter).toBe('Dead letter');
    expect(DUAL_SYNC_QUEUE_JOB_STATUS_VARIANT.dead_letter).toBe('status-cancelled');
    expect(DUAL_SYNC_QUEUE_JOB_KIND_LABEL.publish_batch).toBe('Publish batch');
  });

  it('maps queue job status to icon keys', () => {
    expect(getQueueJobStatusIconKey('succeeded')).toBe('success');
    expect(getQueueJobStatusIconKey('failed')).toBe('failure');
    expect(getQueueJobStatusIconKey('dead_letter')).toBe('failure');
    expect(getQueueJobStatusIconKey('cancelled')).toBe('failure');
    expect(getQueueJobStatusIconKey('retrying')).toBe('retrying');
    expect(getQueueJobStatusIconKey('queued')).toBe('pending');
  });

  it('allows retry only for terminal retryable statuses', () => {
    expect(canRetryQueueJob(makeJob({ status: 'failed' }))).toBe(true);
    expect(canRetryQueueJob(makeJob({ status: 'dead_letter' }))).toBe(true);
    expect(canRetryQueueJob(makeJob({ status: 'cancelled' }))).toBe(true);
    expect(canRetryQueueJob(makeJob({ status: 'running' }))).toBe(false);
    expect(canRetryQueueJob(makeJob({ status: 'succeeded' }))).toBe(false);
  });

  it('formats timestamps, short ids, and error previews', () => {
    expect(formatQueueJobTimestamp(null)).toBe('-');
    expect(formatQueueJobTimestamp('not-a-date')).toBe('not-a-date');
    expect(formatQueueJobTimestamp('2026-05-09T12:00:00.000Z')).toContain('2026');
    expect(formatQueueJobShortId(makeJob())).toBe('queue-jo');
    expect(formatQueueJobErrorPreview('a'.repeat(100))).toBe(`${'a'.repeat(96)}...`);
    expect(formatQueueJobErrorPreview('short')).toBe('short');
  });

  it('builds the queue jobs panel model from an optional response', () => {
    expect(buildDualSyncQueueJobsPanelModel(undefined)).toEqual({ jobs: [] });
    expect(
      buildDualSyncQueueJobsPanelModel({
        restaurantId: 'restaurant-1',
        jobs: [makeJob({ id: 'queue-job-1' })],
      }),
    ).toEqual({ jobs: [makeJob({ id: 'queue-job-1' })] });
  });

  it('builds retry action toast intents', () => {
    expect(getDualSyncQueueJobRetrySuccessToastIntent()).toEqual({
      kind: 'success',
      message: 'Queue job requeued.',
    });
    expect(getDualSyncQueueJobRetryErrorToastIntent(new Error('Retry broke'))).toEqual({
      kind: 'error',
      message: 'Queue job retry failed. Reason code: unknown_error.',
    });
    expect(getDualSyncQueueJobRetryErrorToastIntent('unknown')).toEqual({
      kind: 'error',
      message: 'Queue job retry failed. Reason code: unknown_error.',
    });
  });
});
