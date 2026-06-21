import { useMemo } from 'react';

import type { DualSyncShellViewState } from '../dualSyncShellDomain';
import type { DualSyncShellHeaderProps } from '../DualSyncShellHeader';
import type { WorkspaceReviewProgress } from '../workspace-progress';

interface PendingMutationState {
  readonly isPending: boolean;
}

export interface DualSyncShellHeaderWorkspaceState {
  readonly controlMutation: PendingMutationState;
  readonly refreshMutation: PendingMutationState;
  readonly autoExportMutation: PendingMutationState;
  readonly publishMutation: PendingMutationState;
  readonly previewPublishMutation: PendingMutationState;
  readonly decisionCount: number;
  readonly workspaceProgress: WorkspaceReviewProgress;
}

export interface DualSyncShellHeaderActionHandlers {
  readonly onClickToggleControl: () => void;
  readonly onClickRefresh: () => void;
  readonly onClickAutoExport: () => void;
  readonly onClickPublish: () => void;
}

interface UseDualSyncShellHeaderPropsArgs {
  readonly workspace: DualSyncShellHeaderWorkspaceState;
  readonly shellActions: DualSyncShellHeaderActionHandlers;
  readonly viewState: DualSyncShellViewState;
  readonly showDriftOnly: boolean;
  readonly onToggleDriftOnly: () => void;
}

export function useDualSyncShellHeaderProps({
  workspace,
  shellActions,
  viewState,
  showDriftOnly,
  onToggleDriftOnly,
}: UseDualSyncShellHeaderPropsArgs): DualSyncShellHeaderProps {
  const controlPending = workspace.controlMutation.isPending;
  const refreshPending = workspace.refreshMutation.isPending;
  const autoExportPending = workspace.autoExportMutation.isPending;
  const publishPending = workspace.publishMutation.isPending;
  const previewPublishPending = workspace.previewPublishMutation.isPending;
  const { decisionCount, workspaceProgress } = workspace;
  const { onClickAutoExport, onClickPublish, onClickRefresh, onClickToggleControl } = shellActions;
  const {
    autoExportable,
    canSubmit,
    lastSnapshotAt,
    overallHeatmap,
    pauseReason,
    syncPaused,
    totalOpen,
  } = viewState;

  return useMemo(
    () => ({
      autoExportable,
      autoExportPending,
      canSubmit,
      controlPending,
      decisionCount,
      lastSnapshotAt,
      onAutoExport: onClickAutoExport,
      onPublish: onClickPublish,
      onRefresh: onClickRefresh,
      onToggleControl: onClickToggleControl,
      onToggleDriftOnly,
      overallHeatmap,
      pauseReason,
      previewPublishPending,
      publishPending,
      refreshPending,
      showDriftOnly,
      syncPaused,
      totalOpen,
      workspaceProgress,
    }),
    [
      autoExportable,
      autoExportPending,
      canSubmit,
      controlPending,
      decisionCount,
      lastSnapshotAt,
      onClickAutoExport,
      onClickPublish,
      onClickRefresh,
      onClickToggleControl,
      onToggleDriftOnly,
      overallHeatmap,
      pauseReason,
      previewPublishPending,
      publishPending,
      refreshPending,
      showDriftOnly,
      syncPaused,
      totalOpen,
      workspaceProgress,
    ],
  );
}
