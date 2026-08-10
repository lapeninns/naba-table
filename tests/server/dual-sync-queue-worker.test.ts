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
    externalProfileId: 'profile-1',
    externalAccountId: 'account-1',
    externalLocationId: 'location-1',
    connectionGeneration: 2,
    consentEpoch: 3,
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

  it('executes an exact hash-only write envelope once without rebuilding from queued content', async () => {
    const executeGoogleWriteEnvelope = vi.fn().mockResolvedValue(undefined);
    claimNextDualSyncJobMock.mockResolvedValue(
      makeJob({
        maxAttempts: 1,
        payload: {
          confirmationVersion: 'gbp-exact-consent-v1',
          bundleId: 'bundle-1',
          listing: {
            restaurantId: 'rest-1',
            externalProfileRowId: 'profile-row-1',
            accountId: 'account-1',
            profileId: 'profile-1',
            locationId: 'location-1',
            connectionGeneration: 2,
            consentEpoch: 3,
          },
          snapshotPins: { core: 'a'.repeat(64), google: 'b'.repeat(64) },
          planFingerprint: 'c'.repeat(64),
          policyVersion: 'gbp-write-policy-v1',
          rendererVersion: 'gbp-renderer-v1',
          expiresAt: '2026-08-09T10:15:00.000Z',
          groups: [
            {
              grantId: 'grant-1',
              groupId: 'profile',
              fieldKeys: ['profile.businessDescription'],
              requestHash: 'd'.repeat(64),
              decisionHash: 'e'.repeat(64),
              beforeHashes: {
                core: { 'profile.businessDescription': 'f'.repeat(64) },
                google: { 'profile.businessDescription': '1'.repeat(64) },
              },
              afterHashes: {
                core: { 'profile.businessDescription': '2'.repeat(64) },
                google: { 'profile.businessDescription': '3'.repeat(64) },
              },
              updateMasks: ['profile'],
            },
          ],
        },
      }),
    );

    const result = await processNextDualSyncJob({
      client,
      workerId: 'worker-1',
      options: { executeGoogleWriteEnvelope },
    });

    expect(result.status).toBe('succeeded');
    expect(executeGoogleWriteEnvelope).toHaveBeenCalledWith(
      expect.objectContaining({ bundleId: 'bundle-1', planFingerprint: 'c'.repeat(64) }),
    );
    expect(runPublishMock).not.toHaveBeenCalled();
  });

  it('routes scheduled refresh through the Google Updates executor without legacy refresh', async () => {
    const executeScheduledGoogleUpdateRefresh = vi.fn().mockResolvedValue(undefined);
    claimNextDualSyncJobMock.mockResolvedValueOnce(
      makeJob({
        jobKind: 'google_refresh_scheduled',
        payload: {},
      }),
    );
    await processNextDualSyncJob({
      client,
      workerId: 'worker-1',
      now: '2026-08-09T10:00:00.000Z',
      options: { executeScheduledGoogleUpdateRefresh },
    });

    expect(executeScheduledGoogleUpdateRefresh).toHaveBeenCalledWith({
      client,
      jobId: 'job-1',
      restaurantId: 'rest-1',
      observedAt: '2026-08-09T10:00:00.000Z',
    });
    expect(refreshFromGoogleMock).not.toHaveBeenCalled();
  });

  it('keeps ordinary manual and core recompute jobs on the legacy refresh path', async () => {
    claimNextDualSyncJobMock.mockResolvedValueOnce(
      makeJob({ jobKind: 'google_refresh_manual', payload: {} }),
    );
    await processNextDualSyncJob({ client, workerId: 'worker-1' });
    expect(refreshFromGoogleMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ runKind: 'manual', skipPull: false }),
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

  it('routes PubSub-correlated manual jobs through Google Updates only', async () => {
    const executeScheduledGoogleUpdateRefresh = vi.fn().mockResolvedValue(undefined);
    claimNextDualSyncJobMock.mockResolvedValueOnce(
      makeJob({
        jobKind: 'google_refresh_manual',
        payload: {
          eventId: 'event-1',
          sourceReceiptSubscription: 'subscription-1',
          sourceReceiptMessageId: 'message-1',
        },
      }),
    );

    await processNextDualSyncJob({
      client,
      workerId: 'worker-1',
      options: { executeScheduledGoogleUpdateRefresh },
    });

    expect(executeScheduledGoogleUpdateRefresh).toHaveBeenCalledTimes(1);
    expect(refreshFromGoogleMock).not.toHaveBeenCalled();
  });

  it('fails closed when a scheduled refresh lacks its immutable fence', async () => {
    const executeScheduledGoogleUpdateRefresh = vi.fn().mockResolvedValue(undefined);
    claimNextDualSyncJobMock.mockResolvedValueOnce(
      makeJob({
        jobKind: 'google_refresh_scheduled',
        externalLocationId: null,
      }),
    );

    const result = await processNextDualSyncJob({
      client,
      workerId: 'worker-1',
      options: { executeScheduledGoogleUpdateRefresh },
    });

    expect(result.status).toBe('retrying');
    expect(executeScheduledGoogleUpdateRefresh).not.toHaveBeenCalled();
    expect(refreshFromGoogleMock).not.toHaveBeenCalled();
    expect(failDualSyncJobMock).toHaveBeenCalledWith(
      expect.objectContaining({ errorCode: 'DUAL_SYNC_JOB_FAILED' }),
    );
  });

  it('rejects partial PubSub correlation instead of falling back to legacy refresh', async () => {
    const executeScheduledGoogleUpdateRefresh = vi.fn().mockResolvedValue(undefined);
    claimNextDualSyncJobMock.mockResolvedValueOnce(
      makeJob({
        jobKind: 'google_refresh_manual',
        payload: { eventId: 'event-1' },
      }),
    );

    await processNextDualSyncJob({
      client,
      workerId: 'worker-1',
      options: { executeScheduledGoogleUpdateRefresh },
    });

    expect(executeScheduledGoogleUpdateRefresh).not.toHaveBeenCalled();
    expect(refreshFromGoogleMock).not.toHaveBeenCalled();
    expect(failDualSyncJobMock).toHaveBeenCalledWith(
      expect.objectContaining({ errorCode: 'GBP_REFRESH_RECEIPT_INVALID' }),
    );
  });

  it('keeps a stale-fence Google Updates failure out of the legacy refresh path', async () => {
    const executeScheduledGoogleUpdateRefresh = vi
      .fn()
      .mockRejectedValue(
        Object.assign(new Error('stale fence'), { code: 'GBP_UPDATE_MASK_STALE_FENCE' }),
      );
    claimNextDualSyncJobMock.mockResolvedValueOnce(
      makeJob({ jobKind: 'google_refresh_scheduled' }),
    );

    await processNextDualSyncJob({
      client,
      workerId: 'worker-1',
      options: { executeScheduledGoogleUpdateRefresh },
    });

    expect(refreshFromGoogleMock).not.toHaveBeenCalled();
    expect(failDualSyncJobMock).toHaveBeenCalledWith(
      expect.objectContaining({ errorCode: 'GBP_UPDATE_MASK_STALE_FENCE' }),
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

  it('preserves generic refresh retry semantics with safe provider error codes', async () => {
    const error = Object.assign(new Error('quota exhausted'), { code: 'QUOTA_LIMITED' });
    claimNextDualSyncJobMock.mockResolvedValue(
      makeJob({
        jobKind: 'google_refresh_manual',
        payload: {},
      }),
    );
    refreshFromGoogleMock.mockRejectedValue(error);

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
        errorMessage: 'QUOTA_LIMITED',
        retryAfterMs: 120_000,
      }),
    );
    expect(completeDualSyncJobMock).not.toHaveBeenCalled();
  });

  it('never gives a failed listing mutation job a generic retry attempt', async () => {
    claimNextDualSyncJobMock.mockResolvedValue(
      makeJob({
        maxAttempts: 3,
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
    runPublishMock.mockRejectedValue(new Error('provider response body must not persist'));
    failDualSyncJobMock.mockResolvedValue(
      makeJob({ status: 'dead_letter', lastErrorCode: 'DUAL_SYNC_JOB_FAILED' }),
    );

    const result = await processNextDualSyncJob({ client, workerId: 'worker-1' });

    expect(result.status).toBe('dead_letter');
    expect(failDualSyncJobMock).toHaveBeenCalledWith(
      expect.objectContaining({ maxAttempts: 1, errorMessage: 'DUAL_SYNC_JOB_FAILED' }),
    );
    expect(JSON.stringify(failDualSyncJobMock.mock.calls)).not.toContain(
      'provider response body must not persist',
    );
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
        errorMessage: 'DUAL_SYNC_JOB_FAILED',
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
        errorMessage: 'DUAL_SYNC_RESTAURANT_PAUSED',
      }),
    );
  });
});
