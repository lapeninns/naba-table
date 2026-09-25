import { PauseCircle, PlayCircle, Zap } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/typography';

import { getDualSyncReviewActionState } from './dualSyncReviewActionsDomain';

import type { DualSyncShellViewState } from './dualSyncShellDomain';
import type { DualSyncShellActions } from './hooks/useDualSyncShellActions';
import type { DualSyncWorkspace } from './hooks/useDualSyncWorkspace';

interface DualSyncSyncControlsProps {
  readonly workspace: DualSyncWorkspace;
  readonly shellActions: DualSyncShellActions;
  readonly viewState: DualSyncShellViewState;
}

/** Pause or resume sync, and publish changes already queued for Google. */
export function DualSyncSyncControls({
  workspace,
  shellActions,
  viewState,
}: DualSyncSyncControlsProps) {
  const actions = getDualSyncReviewActionState({
    syncPaused: viewState.syncPaused,
    pauseReason: viewState.pauseReason,
    controlPending: workspace.controlMutation.isPending,
    refreshPending: workspace.refreshMutation.isPending,
    autoExportPending: workspace.autoExportMutation.isPending,
    publishPending: false,
    previewPublishPending: false,
    importPending: false,
    canPublish: viewState.canPublish,
    canImport: viewState.canImport,
    autoExportable: viewState.autoExportable,
    summary: viewState.decisionSummary,
  });
  const ControlIcon = viewState.syncPaused ? PlayCircle : PauseCircle;

  return (
    <div className="flex flex-col gap-2">
      <Text as="h4" variant="subheading">
        Sync
      </Text>
      <Text variant="caption">
        {viewState.syncPaused
          ? 'Sync is paused. Turn it back on to refresh, choose and publish.'
          : 'Pausing stops refreshes, choices and publishing, and clears unsent choices.'}{' '}
        <span className="tabular-nums">{viewState.totalOpen} queued for Google.</span>
      </Text>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant={viewState.syncPaused ? 'default' : 'outline'}
          size="sm"
          data-dual-sync-action="control"
          onClick={shellActions.onClickToggleControl}
          disabled={actions.control.disabled}
          className="[@media(pointer:coarse)]:min-h-11"
        >
          <ControlIcon data-icon="inline-start" aria-hidden />
          {actions.control.label}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-dual-sync-action="autoExport"
          onClick={shellActions.onClickAutoExport}
          disabled={actions.autoExport.disabled}
          className="[@media(pointer:coarse)]:min-h-11"
        >
          <Zap data-icon="inline-start" aria-hidden />
          {actions.autoExport.label}
        </Button>
      </div>
      {actions.autoExport.disabledHint ? (
        <Text variant="caption">{actions.autoExport.disabledHint}</Text>
      ) : null}
    </div>
  );
}
