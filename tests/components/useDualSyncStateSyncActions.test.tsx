import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useDualSyncStateSyncActions } from '@/components/features/restaurant-settings/dual-sync/hooks/useDualSyncStateSyncActions';

import type { RunAutoExportResponse } from '@/services/ops/dual-sync';

function makeAutoExportResponse(
  overrides: Partial<RunAutoExportResponse> = {},
): RunAutoExportResponse {
  return {
    restaurantId: 'restaurant-1',
    candidatesConsidered: 1,
    decisionsExecuted: 1,
    publishResult: {
      summary: {
        publishJobId: 'publish-job-1',
        restaurantId: 'restaurant-1',
        totalDecisions: 1,
        succeededCount: 1,
        failedCount: 0,
        skippedCount: 0,
        operations: [],
        failures: [],
      },
    },
    skipped: [],
    ...overrides,
  };
}

function renderStateSyncActions({
  autoExportMutation = vi.fn(async () => makeAutoExportResponse()),
  pauseReason = 'Dual-sync is paused.',
  refreshMutation = vi.fn(async () => undefined),
  showToast = vi.fn(),
  syncPaused = false,
} = {}) {
  const workspace = {
    autoExportMutation: {
      mutateAsync: autoExportMutation,
    },
    refreshMutation: {
      mutateAsync: refreshMutation,
    },
  };

  return {
    autoExportMutation,
    refreshMutation,
    showToast,
    ...renderHook(() =>
      useDualSyncStateSyncActions({
        workspace,
        syncPaused,
        pauseReason,
        showToast,
      }),
    ),
  };
}

describe('useDualSyncStateSyncActions', () => {
  it('blocks refresh and auto-export while dual-sync is paused', async () => {
    const refreshMutation = vi.fn(async () => undefined);
    const autoExportMutation = vi.fn(async () => makeAutoExportResponse());
    const { result, showToast } = renderStateSyncActions({
      autoExportMutation,
      pauseReason: 'Paused for QA.',
      refreshMutation,
      syncPaused: true,
    });

    await act(async () => result.current.onClickRefresh());
    await act(async () => result.current.onClickAutoExport());

    expect(refreshMutation).not.toHaveBeenCalled();
    expect(autoExportMutation).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenNthCalledWith(1, {
      kind: 'error',
      message: 'Paused for QA.',
    });
    expect(showToast).toHaveBeenNthCalledWith(2, {
      kind: 'error',
      message: 'Paused for QA.',
    });
  });

  it('refreshes Google profile state and reports success', async () => {
    const refreshMutation = vi.fn(async () => undefined);
    const { result, showToast } = renderStateSyncActions({ refreshMutation });

    await act(async () => result.current.onClickRefresh());

    expect(refreshMutation).toHaveBeenCalledTimes(1);
    expect(showToast).toHaveBeenCalledWith({
      kind: 'success',
      message: 'Pulled the latest Google profile.',
    });
  });

  it('reports refresh errors with the normalized message', async () => {
    const refreshMutation = vi.fn(async () => {
      throw new Error('Refresh broke');
    });
    const { result, showToast } = renderStateSyncActions({ refreshMutation });

    await act(async () => result.current.onClickRefresh());

    expect(showToast).toHaveBeenCalledWith({
      kind: 'error',
      message: 'Refresh failed. Reason code: unknown_error.',
    });
  });

  it('runs auto-export and emits the derived toast intent', async () => {
    const autoExportMutation = vi.fn(async () => makeAutoExportResponse());
    const { result, showToast } = renderStateSyncActions({ autoExportMutation });

    await act(async () => result.current.onClickAutoExport());

    expect(autoExportMutation).toHaveBeenCalledTimes(1);
    expect(showToast).toHaveBeenCalledWith({
      kind: 'success',
      message: '1 queued exports synced to Google.',
    });
  });

  it('reports auto-export errors with the normalized message', async () => {
    const autoExportMutation = vi.fn(async () => {
      throw new Error('Auto-export broke');
    });
    const { result, showToast } = renderStateSyncActions({ autoExportMutation });

    await act(async () => result.current.onClickAutoExport());

    expect(showToast).toHaveBeenCalledWith({
      kind: 'error',
      message: 'Auto-export failed. Reason code: unknown_error.',
    });
  });
});
