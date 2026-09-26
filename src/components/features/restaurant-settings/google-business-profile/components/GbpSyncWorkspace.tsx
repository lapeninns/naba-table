'use client';

import { AlertCircle, CircleDashed } from 'lucide-react';
import { useState } from 'react';

import { Accordion } from '@/components/ui/accordion';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

import { GbpAlerts } from './GbpAlerts';
import { GbpDecisionBar } from './GbpDecisionBar';
import { GbpLinkedLayout } from './GbpLinkedLayout';
import { GbpOperationsPanel, type GbpOperatorQueries } from './GbpOperationsPanel';
import { GbpOverviewCard } from './GbpOverviewCard';
import { GbpReviewTable } from './GbpReviewTable';
import { DualSyncLazyPanels } from '../../dual-sync/DualSyncLazyPanels';
import { getDualSyncReviewActionState } from '../../dual-sync/dualSyncReviewActionsDomain';
import { getDualSyncErrorMessage } from '../../dual-sync/dualSyncShellActionDomain';
import { DualSyncShellDialogs } from '../../dual-sync/DualSyncShellDialogs';
import { useDualSyncShellController } from '../../dual-sync/hooks/useDualSyncShellController';
import {
  getGbpReconnectReason,
  getGbpSendBlockReason,
  hasGbpComparison,
  summarizeGbpReview,
} from '../gbpPageModel';
import { GBP_REVIEW_SECTIONS } from '../googleBusinessProfileWorkflow';

import type { GoogleBusinessProfileSectionState } from '../useGoogleBusinessProfileSectionState';

export type GbpSyncWorkspaceProps = {
  readonly restaurantId: string;
  readonly section: GoogleBusinessProfileSectionState;
  /** Admin write state and controls; null for staff who cannot manage settings. */
  readonly operator: GbpOperatorQueries | null;
};

/**
 * A linked, comparable listing. One dual-sync controller feeds the overview, the alerts, the
 * review table, the decision bar and Operations, so choices and pending states agree everywhere.
 * Publishing still goes through the existing exact-plan and import paths unchanged.
 */
export function GbpSyncWorkspace({ restaurantId, section, operator }: GbpSyncWorkspaceProps) {
  const {
    shellActions,
    shellViewState: view,
    workspace,
  } = useDualSyncShellController({
    restaurantId,
    sections: GBP_REVIEW_SECTIONS,
  });
  const [showMatching, setShowMatching] = useState(false);
  const { data, summary, linkedLocation } = section;
  if (!data || !linkedLocation) return null;

  const operatorState = operator
    ? (operator.connectionQuery.data ?? operator.setWriteAccessMutation.data ?? null)
    : null;
  const operatorUnavailable = Boolean(operator?.connectionQuery.error) && !operatorState;
  const exact = shellActions.exactPublishActions;
  const exactPublishPending = Boolean(workspace.exactPublishMutation?.isPending);
  const previewPending = Boolean(
    workspace.exactPreviewPublishMutation?.isPending || workspace.previewPublishMutation.isPending,
  );
  const importPending = workspace.publishMutation.isPending;
  const actions = getDualSyncReviewActionState({
    syncPaused: view.syncPaused,
    pauseReason: view.pauseReason,
    controlPending: workspace.controlMutation.isPending,
    refreshPending: workspace.refreshMutation.isPending,
    autoExportPending: workspace.autoExportMutation.isPending,
    publishPending: exactPublishPending,
    previewPublishPending: previewPending,
    importPending,
    canPublish: view.canPublish,
    canImport: view.canImport,
    autoExportable: view.autoExportable,
    summary: view.decisionSummary,
  });
  const sendBlockReason = getGbpSendBlockReason({
    operator: operatorState,
    operatorUnavailable,
    connectionStatus: data.status,
    syncPaused: view.syncPaused,
  });
  const reconnectReason = shellActions.needsReauth
    ? 'expired'
    : getGbpReconnectReason({ connectionStatus: data.status, operator: operatorState });
  const reconnect = {
    label: shellActions.isReconnectPending ? 'Reconnecting…' : 'Reconnect Google',
    onClick: shellActions.handleReconnect,
    pending: shellActions.isReconnectPending,
  };
  const review = summarizeGbpReview(workspace.visibleFields, workspace.decisions);
  const compared = hasGbpComparison(workspace.visibleFields);
  const refresh = {
    label: actions.refresh.label,
    onClick: shellActions.onClickRefresh,
    pending: workspace.refreshMutation.isPending,
    // Getting the latest only repeats Google's refusal until Google is reconnected.
    disabled: actions.refresh.disabled || reconnectReason !== null,
  };
  const notices = operator?.terminalNoticesQuery.data?.notices ?? [];

  let reviewContent;
  if (workspace.stateQuery.isLoading) {
    reviewContent = (
      <div className="flex flex-col gap-3" role="status" aria-busy="true">
        <span className="sr-only">Comparing Nabatable with Google…</span>
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-80 w-full" />
      </div>
    );
  } else if (workspace.stateQuery.isError) {
    reviewContent = (
      <Alert variant="destructive">
        <AlertCircle className="size-4" aria-hidden />
        <AlertTitle>Couldn’t load the differences</AlertTitle>
        <AlertDescription className="flex flex-col items-start gap-2">
          <span>
            {getDualSyncErrorMessage(
              workspace.stateQuery.error,
              'The differences could not be loaded.',
            )}{' '}
            Your saved settings are unchanged.
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void workspace.stateQuery.refetch()}
          >
            Try again
          </Button>
        </AlertDescription>
      </Alert>
    );
  } else if (workspace.visibleFields.length === 0) {
    reviewContent = (
      <p className="rounded-lg border px-4 py-6 text-sm text-muted-foreground">
        No Nabatable fields can be compared with Google yet.
      </p>
    );
  } else if (!compared) {
    // Nothing has been read from Google, so there are no differences to decide on yet.
    reviewContent = (
      <div className="flex flex-col items-center gap-2 rounded-lg border px-4 py-7 text-center">
        <CircleDashed className="size-5 text-muted-foreground" aria-hidden />
        <p className="font-semibold">Google hasn’t been checked yet</p>
        <p className="max-w-prose text-sm text-muted-foreground">
          {reconnectReason
            ? 'Nabatable can’t read this listing until Google is reconnected. Once it can, the differences appear here.'
            : 'Get the latest from Google to compare the listing with your Nabatable details.'}
        </p>
        <Button
          type="button"
          size="sm"
          variant={reconnectReason ? 'default' : 'outline'}
          onClick={reconnectReason ? reconnect.onClick : refresh.onClick}
          disabled={reconnectReason ? reconnect.pending : refresh.disabled || refresh.pending}
        >
          {reconnectReason ? reconnect.label : refresh.label}
        </Button>
      </div>
    );
  } else {
    reviewContent = (
      <>
        <GbpReviewTable
          workspace={workspace}
          sendBlockReason={sendBlockReason}
          choicesLocked={view.writeBlocked}
          checkedAt={view.lastSnapshotAt}
          showMatching={showMatching}
          onShowMatchingChange={setShowMatching}
        />
        <GbpDecisionBar
          toSend={view.decisionSummary.toSend}
          toImport={view.decisionSummary.toImport}
          ignored={view.decisionSummary.ignored}
          undecided={review.undecided}
          sendBlockReason={sendBlockReason}
          canImport={view.canImport}
          // Not view.canPublish: that also locks during the plan's own preview, and a disabled
          // button would drop focus before the plan dialog opens.
          canPreview={
            view.decisionSummary.toSend > 0 &&
            !view.syncPaused &&
            !importPending &&
            !sendBlockReason
          }
          previewPending={previewPending || exactPublishPending}
          importPending={importPending}
          onImport={shellActions.onClickImportValues}
          onPreview={shellActions.onClickPublish}
        />
      </>
    );
  }

  return (
    <GbpLinkedLayout
      overview={
        <GbpOverviewCard
          data={data}
          location={linkedLocation}
          accountLabel={summary.accountLabel}
          operator={operatorState}
          operatorUnavailable={operatorUnavailable}
          reconnectReason={reconnectReason}
          checkedAt={view.lastSnapshotAt ?? data.lastPullAt}
          manageHref={summary.manageOnGoogleHref}
          refresh={refresh}
        />
      }
      alerts={
        <GbpAlerts
          operator={operatorState}
          operatorUnavailable={operatorUnavailable}
          onRetryOperator={() => void operator?.connectionQuery.refetch()}
          reauth={{
            reason: reconnectReason,
            account: summary.accountLabel,
            onReconnect: reconnect,
          }}
          syncError={data.status === 'sync_error' ? (data.lastError ?? '') : null}
          refresh={{ ...refresh, refresh: true }}
          paused={
            view.syncPaused
              ? {
                  reason: view.pauseReason,
                  onResume: {
                    label: actions.control.label,
                    onClick: shellActions.onClickToggleControl,
                    pending: workspace.controlMutation.isPending,
                  },
                }
              : null
          }
          lastPublish={
            shellActions.usesExactPublish && exact.result
              ? { result: exact.result, onShow: () => exact.setResultOpen(true) }
              : null
          }
        />
      }
      differenceCount={workspace.stateQuery.data && compared ? review.differences : null}
      review={reviewContent}
      operations={
        <GbpOperationsPanel
          operator={operator}
          sync={{
            paused: view.syncPaused,
            pauseReason: view.pauseReason,
            queued: view.totalOpen,
            toggle: {
              label: actions.control.label,
              onClick: shellActions.onClickToggleControl,
              disabled: actions.control.disabled,
            },
            publishQueued: {
              label: actions.autoExport.label,
              onClick: shellActions.onClickAutoExport,
              disabled: actions.autoExport.disabled || Boolean(sendBlockReason),
              hint: sendBlockReason ?? actions.autoExport.disabledHint,
            },
          }}
          diagnostics={
            <Accordion type="multiple" className="flex flex-col">
              <DualSyncLazyPanels workspace={workspace} />
            </Accordion>
          }
          onRequestDisconnect={summary.canDisconnect ? section.handleRequestDisconnect : null}
          isDisconnecting={section.disconnectMutation.isPending}
        />
      }
      operationsNeedAttention={notices.some((notice) => notice.terminal_kind !== 'consumed')}
      dialogs={
        <DualSyncShellDialogs
          shellActions={shellActions}
          publishPending={exactPublishPending || workspace.publishMutation.isPending}
          importPending={importPending}
        />
      }
    />
  );
}
