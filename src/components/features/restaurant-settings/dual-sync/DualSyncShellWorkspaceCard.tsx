import { RefreshCw, Send } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/typography';

import { DualSyncFreshnessChip } from './DualSyncFreshnessChip';
import {
  describeDualSyncDecisionOutcome,
  formatDualSyncDecisionSummary,
  getDualSyncReviewActionState,
} from './dualSyncReviewActionsDomain';
import { DualSyncReviewPausedAlert } from './DualSyncReviewPausedAlert';
import { DualSyncReviewSections } from './DualSyncReviewSections';
import { DualSyncViewToggle } from './DualSyncViewToggle';
import { GbpStepCard } from '../google-business-profile/components/GbpStepCard';
import { pluralise } from '../shared/settingsSaveSequence';

import type { DualSyncShellViewState } from './dualSyncShellDomain';
import type { DualSyncShellActions } from './hooks/useDualSyncShellActions';
import type { DualSyncWorkspace } from './hooks/useDualSyncWorkspace';

interface DualSyncShellWorkspaceCardProps {
  readonly workspace: DualSyncWorkspace;
  readonly shellActions: DualSyncShellActions;
  readonly viewState: DualSyncShellViewState;
  readonly showDriftOnly: boolean;
  readonly onShowDriftOnlyChange: (next: boolean) => void;
}

/** Step 3, "Review differences": the per-field choices and the two ways to act on them. */
export function DualSyncShellWorkspaceCard({
  workspace,
  shellActions,
  viewState,
  showDriftOnly,
  onShowDriftOnlyChange,
}: DualSyncShellWorkspaceCardProps) {
  const importPending =
    workspace.previewPublishMutation.isPending || workspace.publishMutation.isPending;
  const actions = getDualSyncReviewActionState({
    syncPaused: viewState.syncPaused,
    pauseReason: viewState.pauseReason,
    controlPending: workspace.controlMutation.isPending,
    refreshPending: workspace.refreshMutation.isPending,
    autoExportPending: workspace.autoExportMutation.isPending,
    publishPending: Boolean(
      workspace.exactPublishMutation?.isPending ?? workspace.publishMutation.isPending,
    ),
    previewPublishPending: Boolean(
      workspace.exactPreviewPublishMutation?.isPending ??
      workspace.previewPublishMutation.isPending,
    ),
    importPending: shellActions.usesExactPublish && importPending,
    canPublish: viewState.canPublish,
    canImport: viewState.canImport,
    autoExportable: viewState.autoExportable,
    summary: viewState.decisionSummary,
  });
  const differenceCount = workspace.visibleFields.filter(
    (field) => field.state !== 'in_sync',
  ).length;
  const hasDecisions =
    viewState.decisionSummary.toSend +
      viewState.decisionSummary.toImport +
      viewState.decisionSummary.ignored >
    0;

  return (
    <GbpStepCard
      id="gbp-review"
      testId="gbp-review-card"
      step={3}
      title="Review differences"
      description={`${pluralise(differenceCount, 'difference')} between Nabatable and Google. Choose what to do with each, then review exactly what will be published.`}
      status={
        <DualSyncFreshnessChip
          timestamp={viewState.lastSnapshotAt}
          prefix="Checked"
          neverLabel="Not checked yet"
        />
      }
      actions={
        <>
          <DualSyncViewToggle showDriftOnly={showDriftOnly} onChange={onShowDriftOnlyChange} />
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-dual-sync-action="refresh"
            onClick={shellActions.onClickRefresh}
            disabled={actions.refresh.disabled}
            className="[@media(pointer:coarse)]:min-h-11"
          >
            <RefreshCw
              data-icon="inline-start"
              className={
                workspace.refreshMutation.isPending
                  ? 'animate-spin motion-reduce:animate-none'
                  : undefined
              }
              aria-hidden
            />
            {actions.refresh.label}
          </Button>
        </>
      }
      contentClassName="gap-0 p-0 sm:px-0"
      footer={
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-col gap-1">
            <p role="status" className="text-sm font-medium tabular-nums text-foreground">
              {formatDualSyncDecisionSummary(viewState.decisionSummary)}
            </p>
            <Text variant="caption">
              {describeDualSyncDecisionOutcome(viewState.decisionSummary)}
            </Text>
            {actions.publish.disabledHint && (hasDecisions || viewState.syncPaused) ? (
              <Text variant="caption" id="dual-sync-publish-hint">
                {actions.publish.disabledHint}
              </Text>
            ) : null}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
            {actions.importValues.visible ? (
              <Button
                type="button"
                variant="outline"
                data-dual-sync-action="use-google"
                onClick={shellActions.onClickImportValues}
                disabled={actions.importValues.disabled}
                className="[@media(pointer:coarse)]:min-h-11"
              >
                {actions.importValues.label}
              </Button>
            ) : null}
            <Button
              type="button"
              data-dual-sync-action="publish"
              onClick={shellActions.onClickPublish}
              disabled={actions.publish.disabled}
              aria-describedby={
                actions.publish.disabledHint && (hasDecisions || viewState.syncPaused)
                  ? 'dual-sync-publish-hint'
                  : undefined
              }
              className="[@media(pointer:coarse)]:min-h-11"
            >
              <Send data-icon="inline-start" aria-hidden />
              {actions.publish.label}
            </Button>
          </div>
        </div>
      }
    >
      {viewState.syncPaused ? (
        <div className="px-4 py-3 sm:px-5">
          <DualSyncReviewPausedAlert
            pauseReason={viewState.pauseReason}
            onResume={shellActions.onClickToggleControl}
            resumeLabel={actions.control.label}
            resumeDisabled={actions.control.disabled}
          />
        </div>
      ) : null}
      <DualSyncReviewSections
        workspace={workspace}
        showDriftOnly={showDriftOnly}
        writeBlocked={viewState.writeBlocked}
      />
    </GbpStepCard>
  );
}
