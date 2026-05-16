import { beforeEach, describe, expect, it, vi } from 'vitest';

const claimNextDualSyncJobMock = vi.hoisted(() => vi.fn());
const completeDualSyncJobMock = vi.hoisted(() => vi.fn());
const failDualSyncJobMock = vi.hoisted(() => vi.fn());
const runPublishMock = vi.hoisted(() => vi.fn());
const defaultDualSyncPortsMock = vi.hoisted(() => vi.fn());
const createDurableDualSyncGoogleEditThrottleMock = vi.hoisted(() => vi.fn());
const refreshFromGoogleMock = vi.hoisted(() => vi.fn());
const runAutoExportForRestaurantMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/dual-sync/queue/jobs', () => ({
  claimNextDualSyncJob: claimNextDualSyncJobMock,
  completeDualSyncJob: completeDualSyncJobMock,
  failDualSyncJob: failDualSyncJobMock,
}));

vi.mock('@/server/dual-sync/publish/orchestrator', () => ({
  runPublish: runPublishMock,
}));

vi.mock('@/server/dual-sync/publish/ports', () => ({
  defaultDualSyncPorts: defaultDualSyncPortsMock,
}));

vi.mock('@/server/dual-sync/publish/google-safety', () => ({
  createDurableDualSyncGoogleEditThrottle: createDurableDualSyncGoogleEditThrottleMock,
}));

vi.mock('@/server/dual-sync/refresh', () => ({
  refreshFromGoogle: refreshFromGoogleMock,
}));

vi.mock('@/server/dual-sync/scheduling/auto-export', () => ({
  runAutoExportForRestaurant: runAutoExportForRestaurantMock,
}));

import { processNextDualSyncJob } from '@/server/dual-sync/queue/worker';

import type { DualSyncJob } from '@/server/dual-sync/types';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

const client = { from: vi.fn() } as unknown as SupabaseClient<Database>;
const ports = { applyExportToGoogle: vi.fn() };

function makeJob(overrides: Partial<DualSyncJob> = {}): DualSyncJob {
  return {
    id: 'job-1',
    restaurantId: 'rest-1',
    provider: 'google_business_profile',
    jobKind: 'publish_batch',
    status: 'running',
    idempotencyKey: 'request-1',
    priority: 100,
    payload: {},
    attemptCount: 1,
    maxAttempts: 3,
    availableAt: '2026-05-09T00:00:00.000Z',
    lockedAt: '2026-05-09T00:01:00.000Z',
    lockedBy: 'worker-1',
    lastErrorCode: null,
    lastErrorMessage: null,
    deadLetterReason: null,
    startedAt: '2026-05-09T00:01:00.000Z',
    finishedAt: null,
    createdAt: '2026-05-09T00:00:00.000Z',
    updatedAt: '2026-05-09T00:01:00.000Z',
    ...overrides,
  };
}

describe('dual-sync queue worker', () => {
  beforeEach(() => {
    claimNextDualSyncJobMock.mockReset();
    completeDualSyncJobMock.mockReset();
    failDualSyncJobMock.mockReset();
    runPublishMock.mockReset();
    defaultDualSyncPortsMock.mockReset();
    createDurableDualSyncGoogleEditThrottleMock.mockReset();
    refreshFromGoogleMock.mockReset();
    runAutoExportForRestaurantMock.mockReset();

    defaultDualSyncPortsMock.mockReturnValue(ports);
    createDurableDualSyncGoogleEditThrottleMock.mockReturnValue({ reserve: vi.fn() });
    completeDualSyncJobMock.mockImplementation(async ({ jobId }: { readonly jobId: string }) =>
      makeJob({ id: jobId, status: 'succeeded', finishedAt: '2026-05-09T00:02:00.000Z' }),
    );
    failDualSyncJobMock.mockImplementation(async ({ jobId }: { readonly jobId: string }) =>
      makeJob({ id: jobId, status: 'retrying', lastErrorCode: 'DUAL_SYNC_JOB_FAILED' }),
    );
  });

  it('returns idle when no durable job is claimable', async () => {
    claimNextDualSyncJobMock.mockResolvedValue(null);

    await expect(processNextDualSyncJob({ client, workerId: 'worker-1' })).resolves.toMatchObject({
      status: 'idle',
      job: null,
    });
  });

  it('executes a publish job and completes it', async () => {
    claimNextDualSyncJobMock.mockResolvedValue(
      makeJob({
        payload: {
          decisions: [
            {
              fieldKey: 'profile.businessDescription',
              sectionKey: 'profile',
              action: 'export_to_google',
              pinnedCoreHash: 'core-hash',
              pinnedGbpHash: 'gbp-hash',
            },
          ],
          actorUserId: 'user-1',
          pinnedCoreSnapshotHash: 'core-snapshot',
          pinnedGbpSnapshotHash: 'gbp-snapshot',
        },
      }),
    );

    const result = await processNextDualSyncJob({ client, workerId: 'worker-1' });

    expect(result.status).toBe('succeeded');
    expect(runPublishMock).toHaveBeenCalledWith(
      client,
      expect.objectContaining({
        restaurantId: 'rest-1',
        actorUserId: 'user-1',
        clientRequestId: 'request-1',
        pinnedCoreSnapshotHash: 'core-snapshot',
        pinnedGbpSnapshotHash: 'gbp-snapshot',
        decisions: [
          expect.objectContaining({
            fieldKey: 'profile.businessDescription',
            action: 'export_to_google',
          }),
        ],
      }),
      expect.objectContaining({
        ports,
        googleEditThrottle: expect.objectContaining({ reserve: expect.any(Function) }),
      }),
    );
    expect(createDurableDualSyncGoogleEditThrottleMock).toHaveBeenCalledWith(client);
    expect(completeDualSyncJobMock).toHaveBeenCalledWith({ client, jobId: 'job-1' });
  });

  it('executes refresh and core recompute jobs with the expected snapshot run kind', async () => {
    claimNextDualSyncJobMock.mockResolvedValueOnce(
      makeJob({
        jobKind: 'google_refresh_scheduled',
        payload: { skipPull: false },
      }),
    );
    await processNextDualSyncJob({ client, workerId: 'worker-1' });
    expect(refreshFromGoogleMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        restaurantId: 'rest-1',
        runKind: 'scheduled',
        skipPull: false,
      }),
    );

    claimNextDualSyncJobMock.mockResolvedValueOnce(
      makeJob({
        id: 'job-2',
        jobKind: 'core_write_recompute',
        payload: {},
      }),
    );
    await processNextDualSyncJob({ client, workerId: 'worker-1' });
    expect(refreshFromGoogleMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        restaurantId: 'rest-1',
        runKind: 'core_write',
        skipPull: true,
      }),
    );
  });

  it('executes auto-export jobs through the scheduler helper', async () => {
    claimNextDualSyncJobMock.mockResolvedValue(
      makeJob({
        jobKind: 'auto_export',
        payload: { maxCandidates: 25, actorUserId: 'user-1' },
      }),
    );

    await processNextDualSyncJob({ client, workerId: 'worker-1' });

    expect(runAutoExportForRestaurantMock).toHaveBeenCalledWith(
      expect.objectContaining({
        client,
        restaurantId: 'rest-1',
        maxCandidates: 25,
        actorUserId: 'user-1',
      }),
    );
  });

  it('retries failed jobs and preserves provider error codes', async () => {
    const error = Object.assign(new Error('quota exhausted'), { code: 'QUOTA_LIMITED' });
    claimNextDualSyncJobMock.mockResolvedValue(
      makeJob({
        payload: {
          decisions: [
            {
              fieldKey: 'profile.businessDescription',
              sectionKey: 'profile',
              action: 'export_to_google',
              pinnedCoreHash: 'core-hash',
              pinnedGbpHash: 'gbp-hash',
            },
          ],
        },
      }),
    );
    runPublishMock.mockRejectedValue(error);

    const result = await processNextDualSyncJob({
      client,
      workerId: 'worker-1',
      options: { retryAfterMs: () => 120_000 },
    });

    expect(result.status).toBe('retrying');
    expect(failDualSyncJobMock).toHaveBeenCalledWith(
      expect.objectContaining({
        client,
        jobId: 'job-1',
        attemptCount: 1,
        maxAttempts: 3,
        errorCode: 'QUOTA_LIMITED',
        errorMessage: 'quota exhausted',
        retryAfterMs: 120_000,
      }),
    );
    expect(completeDualSyncJobMock).not.toHaveBeenCalled();
  });

  it('fails queued publish jobs that omit field-level pins before replaying', async () => {
    claimNextDualSyncJobMock.mockResolvedValue(
      makeJob({
        payload: {
          decisions: [
            {
              fieldKey: 'profile.businessDescription',
              sectionKey: 'profile',
              action: 'export_to_google',
            },
          ],
        },
      }),
    );

    const result = await processNextDualSyncJob({ client, workerId: 'worker-1' });

    expect(result.status).toBe('retrying');
    expect(runPublishMock).not.toHaveBeenCalled();
    expect(failDualSyncJobMock).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: 'DUAL_SYNC_JOB_FAILED',
        errorMessage: 'publish_batch job payload must include at least one valid decision.',
      }),
    );
  });

  it('preserves the restaurant pause code for queued jobs', async () => {
    const error = Object.assign(new Error('Maintenance window.'), {
      code: 'DUAL_SYNC_RESTAURANT_PAUSED',
    });
    claimNextDualSyncJobMock.mockResolvedValue(
      makeJob({
        payload: {
          decisions: [
            {
              fieldKey: 'profile.businessDescription',
              sectionKey: 'profile',
              action: 'export_to_google',
              pinnedCoreHash: 'core-hash',
              pinnedGbpHash: 'gbp-hash',
            },
          ],
        },
      }),
    );
    runPublishMock.mockRejectedValue(error);

    const result = await processNextDualSyncJob({ client, workerId: 'worker-1' });

    expect(result.status).toBe('retrying');
    expect(failDualSyncJobMock).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: 'DUAL_SYNC_RESTAURANT_PAUSED',
        errorMessage: 'Maintenance window.',
      }),
    );
  });
});
