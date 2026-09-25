import { act, renderHook, waitFor } from '@testing-library/react';
import { createQueryWrapper, createTestQueryClient } from '@tests/utils/reactQuery';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useOpsDualSync } from '@/hooks/ops/useOpsDualSync';
import { queryKeys } from '@/lib/query/keys';
import {
  getDualSyncMetrics,
  getDualSyncState,
  listDualSyncCandidates,
  listDualSyncJobs,
  previewDualSyncPublishPlan,
  publishDualSyncDecisions,
  refreshDualSync,
  cancelDualSyncCandidate,
  retryDualSyncJob,
  runDualSyncAutoExport,
  setDualSyncControl,
} from '@/services/ops/dual-sync';

vi.mock('@/services/ops/dual-sync', () => ({
  getDualSyncMetrics: vi.fn(),
  getDualSyncPublishJobDetail: vi.fn(),
  getDualSyncState: vi.fn(),
  listDualSyncCandidates: vi.fn(),
  listDualSyncJobs: vi.fn(),
  listDualSyncOperations: vi.fn(),
  listDualSyncPublishJobs: vi.fn(),
  previewDualSyncPublishPlan: vi.fn(),
  publishDualSyncDecisions: vi.fn(),
  refreshDualSync: vi.fn(),
  cancelDualSyncCandidate: vi.fn(),
  retryDualSyncJob: vi.fn(),
  runDualSyncAutoExport: vi.fn(),
  setDualSyncControl: vi.fn(),
}));

const restaurantId = 'restaurant-1';
const stateQueryKey = ['dual-sync-state', restaurantId] as const;

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
    vi.mocked(listDualSyncCandidates).mockResolvedValue({
      restaurantId,
      candidates: [],
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
    vi.mocked(cancelDualSyncCandidate).mockResolvedValue({
      restaurantId,
      candidate: {
        id: 'candidate-1',
        restaurantId,
        provider: 'google_business_profile',
        sectionKey: 'profile',
        fieldKey: 'profile.name',
        proposedValue: 'New name',
        proposedValueHash: 'hash-new',
        baselineGbpHash: 'hash-old',
        status: 'cancelled',
        source: 'core_write',
        createdByUserId: 'user-1',
        resolvedAt: '2026-05-09T12:10:00.000Z',
        createdAt: '2026-05-09T12:00:00.000Z',
        updatedAt: '2026-05-09T12:10:00.000Z',
      },
    } as never);
  });

  it('marks every dual-sync query as non-persistent', () => {
    const queryClient = createTestQueryClient();
    const wrapper = createQueryWrapper(queryClient);

    renderHook(
      () =>
        useOpsDualSync({
          restaurantId,
          operationsRequest: {},
          jobsRequest: {},
          candidatesRequest: {},
          metricsRequest: {},
          publishJobsRequest: {},
          publishJobDetailId: 'publish-job-1',
        }),
      { wrapper },
    );

    const dualSyncQueries = queryClient
      .getQueryCache()
      .getAll()
      .filter((query) => String(query.queryKey[0]).startsWith('dual-sync-'));

    expect(dualSyncQueries).toHaveLength(7);
    expect(dualSyncQueries.every((query) => query.meta?.persist === false)).toBe(true);
  });

  it('keeps dual-sync state fresh for two minutes instead of refetching on every mount', async () => {
    const queryClient = createTestQueryClient();
    const wrapper = createQueryWrapper(queryClient);

    const { result } = renderHook(() => useOpsDualSync({ restaurantId }), { wrapper });
    await waitFor(() => expect(result.current.stateQuery.isSuccess).toBe(true));

    const stateQuery = queryClient.getQueryCache().find({ queryKey: stateQueryKey, exact: true });
    expect(stateQuery?.options).toMatchObject({ staleTime: 2 * 60_000 });

    renderHook(() => useOpsDualSync({ restaurantId }), { wrapper });
    expect(getDualSyncState).toHaveBeenCalledTimes(1);
  });

  it('serves cached dual-sync state without fetching when stateEnabled is false', () => {
    const queryClient = createTestQueryClient();
    const wrapper = createQueryWrapper(queryClient);
    const cached = stateResponse();
    // Stale cache entry: an enabled query would refetch it on mount.
    queryClient.setQueryData(stateQueryKey, cached, { updatedAt: 0 });

    const { result } = renderHook(() => useOpsDualSync({ restaurantId, stateEnabled: false }), {
      wrapper,
    });

    expect(result.current.stateQuery.data).toEqual(cached);
    expect(getDualSyncState).not.toHaveBeenCalled();
  });

  it('does not fetch dual-sync state when stateEnabled is false and nothing is cached', () => {
    const queryClient = createTestQueryClient();
    const wrapper = createQueryWrapper(queryClient);

    const { result } = renderHook(() => useOpsDualSync({ restaurantId, stateEnabled: false }), {
      wrapper,
    });

    expect(result.current.stateQuery.data).toBeUndefined();
    expect(result.current.stateQuery.isLoading).toBe(false);
    expect(getDualSyncState).not.toHaveBeenCalled();
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

  it('lazily fetches outbound candidates when requested', async () => {
    const queryClient = createTestQueryClient();
    const wrapper = createQueryWrapper(queryClient);

    renderHook(
      () =>
        useOpsDualSync({
          restaurantId,
          candidatesRequest: { limit: 25, statuses: ['open'] },
        }),
      { wrapper },
    );

    await waitFor(() => {
      expect(listDualSyncCandidates).toHaveBeenCalledWith(restaurantId, {
        limit: 25,
        statuses: ['open'],
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

  it('cancels an outbound candidate and invalidates dual-sync workspace caches', async () => {
    const queryClient = createTestQueryClient();
    const wrapper = createQueryWrapper(queryClient);
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useOpsDualSync({ restaurantId }), { wrapper });

    await act(async () => {
      await result.current.cancelCandidateMutation.mutateAsync('candidate-1');
    });

    expect(cancelDualSyncCandidate).toHaveBeenCalledWith(restaurantId, 'candidate-1');
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['dual-sync-candidates', restaurantId],
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
