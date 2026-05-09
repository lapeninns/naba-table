import { act, renderHook, waitFor } from '@testing-library/react';
import { createQueryWrapper, createTestQueryClient } from '@tests/utils/reactQuery';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useOpsDualSync } from '@/hooks/ops/useOpsDualSync';
import { queryKeys } from '@/lib/query/keys';
import {
  getDualSyncMetrics,
  getDualSyncState,
  listDualSyncJobs,
  previewDualSyncPublishPlan,
  publishDualSyncDecisions,
  refreshDualSync,
  retryDualSyncJob,
  runDualSyncAutoExport,
  setDualSyncControl,
} from '@/services/ops/dual-sync';

vi.mock('@/services/ops/dual-sync', () => ({
  getDualSyncMetrics: vi.fn(),
  getDualSyncPublishJobDetail: vi.fn(),
  getDualSyncState: vi.fn(),
  listDualSyncJobs: vi.fn(),
  listDualSyncOperations: vi.fn(),
  listDualSyncPublishJobs: vi.fn(),
  previewDualSyncPublishPlan: vi.fn(),
  publishDualSyncDecisions: vi.fn(),
  refreshDualSync: vi.fn(),
  retryDualSyncJob: vi.fn(),
  runDualSyncAutoExport: vi.fn(),
  setDualSyncControl: vi.fn(),
}));

const restaurantId = 'restaurant-1';

function stateResponse() {
  return {
    restaurantId,
    coreSnapshot: {},
    gbpSnapshot: {},
    coreSnapshotHash: 'core-hash',
    gbpSnapshotHash: 'gbp-hash',
    fields: [],
    outboundQueue: {
      totalOpen: 0,
      autoExportable: 0,
      missingBaseline: 0,
      lastQueuedAt: null,
    },
    lastSnapshot: null,
    control: {
      restaurantId,
      provider: 'google_business_profile',
      syncPaused: false,
      pauseReason: null,
      pausedByUserId: null,
      pausedAt: null,
      resumedAt: null,
      createdAt: null,
      updatedAt: null,
    },
  };
}

describe('useOpsDualSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getDualSyncState).mockResolvedValue(stateResponse() as never);
    vi.mocked(listDualSyncJobs).mockResolvedValue({
      restaurantId,
      jobs: [],
    } as never);
    vi.mocked(getDualSyncMetrics).mockResolvedValue({
      restaurantId,
      windowStart: '2026-05-09T00:00:00.000Z',
      windowEnd: '2026-05-10T00:00:00.000Z',
      jobCounts: {},
      operationCounts: {},
      failureCounts: {},
      queueBacklog: 0,
      deadLetterJobs: 0,
      partialPublishFailures: 0,
      alerts: [],
    } as never);
    vi.mocked(previewDualSyncPublishPlan).mockResolvedValue({
      restaurantId,
      coreSnapshotHash: 'core-hash',
      gbpSnapshotHash: 'gbp-hash',
      groups: [],
      rejected: [],
      warnings: [],
      acceptedCount: 0,
      rejectedCount: 0,
      ignoredCount: 0,
    } as never);
    vi.mocked(publishDualSyncDecisions).mockResolvedValue({
      publishJobId: 'job-1',
      restaurantId,
      total: 0,
      succeeded: 0,
      failed: 0,
      skipped: 0,
      operations: [],
      failures: [],
    } as never);
    vi.mocked(refreshDualSync).mockResolvedValue({
      snapshotRun: {},
      transitions: [],
      evaluatedFieldKeys: [],
    } as never);
    vi.mocked(runDualSyncAutoExport).mockResolvedValue({
      restaurantId,
      candidatesConsidered: 0,
      decisionsExecuted: 0,
      publishResult: null,
      skipped: [],
    } as never);
    vi.mocked(setDualSyncControl).mockResolvedValue({
      restaurantId,
      control: stateResponse().control,
    } as never);
    vi.mocked(retryDualSyncJob).mockResolvedValue({
      restaurantId,
      job: {
        id: 'queue-job-1',
        restaurantId,
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
      },
    } as never);
  });

  it('invalidates cached restaurant profile details after dual-sync publish', async () => {
    const queryClient = createTestQueryClient();
    const wrapper = createQueryWrapper(queryClient);
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useOpsDualSync({ restaurantId }), { wrapper });

    await act(async () => {
      await result.current.publishMutation.mutateAsync({ decisions: [] });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['dual-sync-state', restaurantId] });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['dual-sync-operations', restaurantId],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['dual-sync-jobs', restaurantId],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['dual-sync-metrics', restaurantId],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['dual-sync-publish-jobs', restaurantId],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['dual-sync-publish-job-detail', restaurantId],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.opsRestaurants.googleBusinessProfile(restaurantId),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.opsRestaurants.googleBusinessProfileLocations(restaurantId),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.opsFoodMenus.importReviews(restaurantId),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.opsRestaurants.detail(restaurantId),
    });
  });

  it('invalidates cached restaurant profile details after dual-sync refresh', async () => {
    const queryClient = createTestQueryClient();
    const wrapper = createQueryWrapper(queryClient);
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useOpsDualSync({ restaurantId }), { wrapper });

    await act(async () => {
      await result.current.refreshMutation.mutateAsync();
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.opsRestaurants.googleBusinessProfile(restaurantId),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['dual-sync-operations', restaurantId],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['dual-sync-jobs', restaurantId],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['dual-sync-metrics', restaurantId],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.opsRestaurants.detail(restaurantId),
    });
  });

  it('invalidates cached restaurant profile details after dual-sync auto-export', async () => {
    const queryClient = createTestQueryClient();
    const wrapper = createQueryWrapper(queryClient);
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useOpsDualSync({ restaurantId }), { wrapper });

    await act(async () => {
      await result.current.autoExportMutation.mutateAsync();
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.opsRestaurants.googleBusinessProfile(restaurantId),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['dual-sync-publish-jobs', restaurantId],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['dual-sync-jobs', restaurantId],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['dual-sync-metrics', restaurantId],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.opsRestaurants.detail(restaurantId),
    });
  });

  it('lazily fetches durable queue jobs when requested', async () => {
    const queryClient = createTestQueryClient();
    const wrapper = createQueryWrapper(queryClient);

    renderHook(
      () =>
        useOpsDualSync({
          restaurantId,
          jobsRequest: { limit: 25, statuses: ['dead_letter', 'retrying'] },
        }),
      { wrapper },
    );

    await waitFor(() => {
      expect(listDualSyncJobs).toHaveBeenCalledWith(restaurantId, {
        limit: 25,
        statuses: ['dead_letter', 'retrying'],
      });
    });
  });

  it('lazily fetches operational metrics when requested', async () => {
    const queryClient = createTestQueryClient();
    const wrapper = createQueryWrapper(queryClient);

    renderHook(
      () =>
        useOpsDualSync({
          restaurantId,
          metricsRequest: { windowHours: 6, limit: 100 },
        }),
      { wrapper },
    );

    await waitFor(() => {
      expect(getDualSyncMetrics).toHaveBeenCalledWith(restaurantId, {
        windowHours: 6,
        limit: 100,
      });
    });
  });

  it('retries a durable queue job and invalidates dual-sync workspace caches', async () => {
    const queryClient = createTestQueryClient();
    const wrapper = createQueryWrapper(queryClient);
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useOpsDualSync({ restaurantId }), { wrapper });

    await act(async () => {
      await result.current.retryJobMutation.mutateAsync('queue-job-1');
    });

    expect(retryDualSyncJob).toHaveBeenCalledWith(restaurantId, 'queue-job-1');
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['dual-sync-jobs', restaurantId],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['dual-sync-metrics', restaurantId],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['dual-sync-state', restaurantId],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.opsRestaurants.detail(restaurantId),
    });
  });

  it('updates restaurant dual-sync control and invalidates workspace caches', async () => {
    const queryClient = createTestQueryClient();
    const wrapper = createQueryWrapper(queryClient);
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useOpsDualSync({ restaurantId }), { wrapper });

    await act(async () => {
      await result.current.controlMutation.mutateAsync({
        syncPaused: true,
        reason: 'Maintenance window.',
      });
    });

    expect(setDualSyncControl).toHaveBeenCalledWith(restaurantId, {
      syncPaused: true,
      reason: 'Maintenance window.',
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['dual-sync-state', restaurantId] });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['dual-sync-jobs', restaurantId],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['dual-sync-metrics', restaurantId],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.opsRestaurants.detail(restaurantId),
    });
  });

  it('previews a dual-sync publish plan without invalidating workspace caches', async () => {
    const queryClient = createTestQueryClient();
    const wrapper = createQueryWrapper(queryClient);
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useOpsDualSync({ restaurantId }), { wrapper });

    await act(async () => {
      await result.current.previewPublishMutation.mutateAsync({
        decisions: [],
        pinnedCoreSnapshotHash: 'core-hash',
        pinnedGbpSnapshotHash: 'gbp-hash',
      });
    });

    expect(previewDualSyncPublishPlan).toHaveBeenCalledWith(restaurantId, {
      decisions: [],
      pinnedCoreSnapshotHash: 'core-hash',
      pinnedGbpSnapshotHash: 'gbp-hash',
    });
    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});
