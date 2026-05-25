import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  type DualSyncShellHeaderActionHandlers,
  type DualSyncShellHeaderWorkspaceState,
  useDualSyncShellHeaderProps,
} from '@/components/features/restaurant-settings/dual-sync/hooks/useDualSyncShellHeaderProps';

import type { DualSyncShellViewState } from '@/components/features/restaurant-settings/dual-sync/dualSyncShellDomain';
import type { WorkspaceReviewProgress } from '@/components/features/restaurant-settings/dual-sync/workspace-progress';

const workspaceProgress: WorkspaceReviewProgress = {
  draftedForReviewCount: 2,
  draftCoveragePercent: 50,
  inSyncCount: 5,
  needsReviewCount: 4,
  syncHealthPercent: 55,
  totalFields: 9,
};

function makeViewState(overrides: Partial<DualSyncShellViewState> = {}): DualSyncShellViewState {
  return {
    autoExportable: 3,
    canSubmit: true,
    lastSnapshotAt: '2026-05-21T17:10:00.000Z',
    overallHeatmap: {
      conflict: 1,
      drift: 2,
      failed: 0,
      in_sync: 5,
      unsupported: 1,
    },
    pauseReason: 'Dual-sync is paused for this restaurant.',
    syncPaused: false,
    totalOpen: 4,
    writeBlocked: false,
    ...overrides,
  };
}

function makePendingState(isPending: boolean) {
  return { isPending };
}

function makeWorkspace(
  overrides: Partial<DualSyncShellHeaderWorkspaceState> = {},
): DualSyncShellHeaderWorkspaceState {
  return {
    autoExportMutation: makePendingState(false),
    controlMutation: makePendingState(false),
    decisionCount: 2,
    previewPublishMutation: makePendingState(false),
    publishMutation: makePendingState(false),
    refreshMutation: makePendingState(false),
    workspaceProgress,
    ...overrides,
  };
}

function makeShellActions(): DualSyncShellHeaderActionHandlers {
  return {
    onClickAutoExport: vi.fn(),
    onClickPublish: vi.fn(),
    onClickRefresh: vi.fn(),
    onClickToggleControl: vi.fn(),
  };
}

describe('useDualSyncShellHeaderProps', () => {
  it('maps shell view state, workspace state, and shell actions into header props', () => {
    const onToggleDriftOnly = vi.fn();
    const shellActions = makeShellActions();
    const viewState = makeViewState({
      pauseReason: 'Maintenance window.',
      syncPaused: true,
    });
    const workspace = makeWorkspace({
      autoExportMutation: makePendingState(true),
      decisionCount: 7,
      publishMutation: makePendingState(true),
      refreshMutation: makePendingState(true),
    });

    const { result } = renderHook(() =>
      useDualSyncShellHeaderProps({
        workspace,
        shellActions,
        viewState,
        showDriftOnly: false,
        onToggleDriftOnly,
      }),
    );

    expect(result.current).toMatchObject({
      autoExportable: 3,
      autoExportPending: true,
      canSubmit: true,
      controlPending: false,
      decisionCount: 7,
      lastSnapshotAt: '2026-05-21T17:10:00.000Z',
      pauseReason: 'Maintenance window.',
      previewPublishPending: false,
      publishPending: true,
      refreshPending: true,
      showDriftOnly: false,
      syncPaused: true,
      totalOpen: 4,
      workspaceProgress,
    });
    expect(result.current.onAutoExport).toBe(shellActions.onClickAutoExport);
    expect(result.current.onPublish).toBe(shellActions.onClickPublish);
    expect(result.current.onRefresh).toBe(shellActions.onClickRefresh);
    expect(result.current.onToggleControl).toBe(shellActions.onClickToggleControl);
    expect(result.current.onToggleDriftOnly).toBe(onToggleDriftOnly);
  });

  it('updates the memoized header props when pending and filter state changes', () => {
    const shellActions = makeShellActions();
    const viewState = makeViewState();
    let workspace = makeWorkspace();
    let showDriftOnly = true;

    const { rerender, result } = renderHook(() =>
      useDualSyncShellHeaderProps({
        workspace,
        shellActions,
        viewState,
        showDriftOnly,
        onToggleDriftOnly: vi.fn(),
      }),
    );
    const firstProps = result.current;

    workspace = makeWorkspace({
      controlMutation: makePendingState(true),
      previewPublishMutation: makePendingState(true),
    });
    showDriftOnly = false;
    rerender();

    expect(result.current).not.toBe(firstProps);
    expect(result.current.controlPending).toBe(true);
    expect(result.current.previewPublishPending).toBe(true);
    expect(result.current.showDriftOnly).toBe(false);
  });
});
