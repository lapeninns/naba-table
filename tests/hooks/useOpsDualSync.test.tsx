import { act, renderHook } from '@testing-library/react';
import { createQueryWrapper, createTestQueryClient } from '@tests/utils/reactQuery';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useOpsDualSync } from '@/hooks/ops/useOpsDualSync';
import { queryKeys } from '@/lib/query/keys';
import {
  getDualSyncState,
  publishDualSyncDecisions,
  refreshDualSync,
  runDualSyncAutoExport,
} from '@/services/ops/dual-sync';

vi.mock('@/services/ops/dual-sync', () => ({
  getDualSyncPublishJobDetail: vi.fn(),
  getDualSyncState: vi.fn(),
  listDualSyncOperations: vi.fn(),
  listDualSyncPublishJobs: vi.fn(),
  publishDualSyncDecisions: vi.fn(),
  refreshDualSync: vi.fn(),
  runDualSyncAutoExport: vi.fn(),
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
  };
}

describe('useOpsDualSync', () => {
  beforeEach(() => {
    vi.mocked(getDualSyncState).mockResolvedValue(stateResponse() as never);
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
      queryKey: queryKeys.opsRestaurants.detail(restaurantId),
    });
  });
});
