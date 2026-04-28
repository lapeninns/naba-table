'use client';

import { AlertTriangle, GitPullRequestArrow, ShieldAlert } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

import { AuditTimeline } from './AuditTimeline';
import { DifferenceDetailPanel } from './DifferenceDetailPanel';
import { DifferenceInbox } from './DifferenceInbox';
import { PreflightReviewDialog } from './PreflightReviewDialog';
import { PublishPasswordDialog } from './PublishPasswordDialog';
import { RetryGooglePushPanel } from './RetryGooglePushPanel';
import { SyncDirectionTabs } from './SyncDirectionTabs';
import { SyncStatusHeader } from './SyncStatusHeader';
import { buildDirectionStats, directionLabel } from '../lib/sync-review';
import { useGoogleBusinessProfileSyncWorkspace } from '../lib/useGoogleBusinessProfileSyncWorkspace';

import type { GoogleBusinessProfileConnection } from '@/services/ops/restaurants';

type GoogleBusinessProfileSyncPageShellProps = {
  restaurantId: string;
  connection: GoogleBusinessProfileConnection;
  manageOnGoogleHref: string | null;
  onGenerateDraft: () => void;
  onChangeLocation: () => void;
  isGeneratingDraft: boolean;
  showChangeLocation: boolean;
};

function applyDialogTitle(direction: 'google_to_nabatable' | 'nabatable_to_google') {
  return direction === 'google_to_nabatable'
    ? 'Apply changes to Nabatable'
    : 'Apply changes to Google';
}

export function GoogleBusinessProfileSyncPageShell({
  restaurantId,
  connection,
  manageOnGoogleHref,
  onGenerateDraft,
  onChangeLocation,
  isGeneratingDraft,
  showChangeLocation,
}: GoogleBusinessProfileSyncPageShellProps) {
  const workspace = useGoogleBusinessProfileSyncWorkspace(restaurantId);
  const workflow = workspace.workflowQuery.data;
  const draft = workspace.draft;
  const googlePushEnabled = connection.pushEnabled;
  const pushDirectionBlocked = workspace.direction === 'nabatable_to_google' && !googlePushEnabled;
  const statsByDirection = {
    google_to_nabatable: buildDirectionStats(
      draft,
      workspace.fieldDecisions,
      'google_to_nabatable',
    ),
    nabatable_to_google: buildDirectionStats(
      draft,
      workspace.fieldDecisions,
      'nabatable_to_google',
    ),
  };

  const conflictMetadata =
    draft?.conflictMetadata &&
    typeof draft.conflictMetadata === 'object' &&
    !Array.isArray(draft.conflictMetadata)
      ? (draft.conflictMetadata as Record<string, unknown>)
      : null;
  const staleFieldKeys = Array.isArray(conflictMetadata?.staleFieldKeys)
    ? (conflictMetadata?.staleFieldKeys as string[])
    : [];

  return (
    <div className="min-w-0 space-y-4">
      <SyncStatusHeader
        connection={connection}
        workflow={workflow}
        manageOnGoogleHref={manageOnGoogleHref}
        onGenerateDraft={onGenerateDraft}
        onChangeLocation={onChangeLocation}
        isGeneratingDraft={isGeneratingDraft}
        showChangeLocation={showChangeLocation}
      />

      {workflow?.blockedReasons.length ? (
        <Alert>
          <ShieldAlert className="size-4" />
          <AlertTitle>Review notes</AlertTitle>
          <AlertDescription>{workflow.blockedReasons[0]}</AlertDescription>
        </Alert>
      ) : null}

      {draft?.status === 'stale' && staleFieldKeys.length > 0 ? (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>Changes need another check</AlertTitle>
          <AlertDescription>
            Check for changes again before applying updates. Changed fields:{' '}
            {staleFieldKeys.join(', ')}.
          </AlertDescription>
        </Alert>
      ) : null}

      <SyncDirectionTabs
        direction={workspace.direction}
        onDirectionChange={workspace.setDirection}
        stats={statsByDirection}
        hasMixedSelections={workspace.mixedDirectionSelections}
        googlePushEnabled={googlePushEnabled}
      />

      {!googlePushEnabled ? (
        <Alert>
          <ShieldAlert className="size-4" />
          <AlertTitle>Google updates are disabled</AlertTitle>
          <AlertDescription>
            This linked Business Profile can still be reviewed and pulled into Nabatable, but Google
            write-back is disabled for this location.
          </AlertDescription>
        </Alert>
      ) : null}

      <Card className="min-w-0 border-border/70 shadow-sm">
        <CardContent className="min-w-0 space-y-4 p-3 sm:p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-1">
              <h2 className="text-base font-semibold text-foreground">
                {directionLabel(workspace.direction)} review
              </h2>
              <p className="text-sm text-muted-foreground">
                Choose which fields to use, then run a final check for this update path.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <Button
                type="button"
                className="w-full sm:w-auto"
                disabled={
                  !draft ||
                  pushDirectionBlocked ||
                  statsByDirection[workspace.direction].selectedCount === 0
                }
                onClick={() => {
                  workspace.resetPreflight();
                  workspace.setPreflightDialogOpen(true);
                }}
              >
                Review selected changes ({statsByDirection[workspace.direction].selectedCount})
              </Button>
            </div>
          </div>

          {!draft ? (
            <div className="flex min-h-[360px] items-center justify-center rounded-lg border border-dashed border-border/70 bg-muted/20 p-8 text-center">
              <div className="space-y-3">
                <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-background shadow-sm">
                  <GitPullRequestArrow className="size-7 text-muted-foreground" />
                </div>
                <div className="space-y-1">
                  <p className="text-base font-semibold text-foreground">No changes checked yet</p>
                  <p className="text-sm text-muted-foreground">
                    Check for changes to compare the latest Google profile details with Nabatable.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid min-h-[560px] min-w-0 grid-cols-1 overflow-hidden rounded-lg border border-border/70 lg:grid-cols-[minmax(260px,320px)_minmax(0,1fr)]">
              <div className="min-w-0 border-b border-border/60 lg:border-b-0 lg:border-r">
                <DifferenceInbox
                  summaries={workspace.sectionSummaries}
                  selectedSectionKey={workspace.selectedSectionKey}
                  onSelect={workspace.setSelectedSectionKey}
                />
              </div>
              <div className="min-w-0">
                <DifferenceDetailPanel
                  summary={workspace.selectedSectionSummary}
                  getDecisionForItem={(fieldKey) =>
                    workspace.fieldDecisions[fieldKey] ?? 'keep_nabatable'
                  }
                  onDecisionChange={(fieldKey, decision) => {
                    const section = draft.sectionDiffs.find((candidate) =>
                      candidate.items.some((item) => item.fieldKey === fieldKey),
                    );
                    const item = section?.items.find(
                      (candidate) => candidate.fieldKey === fieldKey,
                    );
                    if (!item) {
                      return;
                    }
                    workspace.updateDecision(item, decision);
                  }}
                  activePublishJob={workspace.activePublishJob}
                  googlePushEnabled={googlePushEnabled}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <RetryGooglePushPanel
        activePublishJob={workspace.activePublishJob}
        onRetry={() => workspace.setRetryDialogOpen(true)}
        isRetryPending={workspace.retryMutation.isPending}
      />

      <AuditTimeline events={workflow?.auditEvents ?? []} />

      <PreflightReviewDialog
        open={workspace.preflightDialogOpen}
        onOpenChange={workspace.setPreflightDialogOpen}
        direction={workspace.direction}
        selectedItems={workspace.selectedItems}
        preflight={workspace.preflightResult}
        preflightErrorMessage={
          workspace.preflightErrorMessage ?? workspace.preflightMutation.error?.message ?? null
        }
        isPreflightPending={workspace.preflightMutation.isPending}
        onRunPreflight={async () => {
          await workspace.runPreflight().catch(() => undefined);
        }}
        onContinue={() => workspace.setPublishDialogOpen(true)}
      />

      <PublishPasswordDialog
        open={workspace.publishDialogOpen}
        onOpenChange={workspace.setPublishDialogOpen}
        title={applyDialogTitle(workspace.direction)}
        description="Password confirmation is required after the final check passes."
        confirmLabel="Apply reviewed changes"
        isPending={workspace.publishMutation.isPending}
        errorMessage={workspace.publishErrorMessage}
        onConfirm={async (password) => {
          await workspace.publishWithPassword(password).catch(() => undefined);
        }}
      />

      <PublishPasswordDialog
        open={workspace.retryDialogOpen}
        onOpenChange={workspace.setRetryDialogOpen}
        title="Retry Google update"
        description="Retry only the Google update from the last reviewed change."
        confirmLabel="Retry Google update"
        isPending={workspace.retryMutation.isPending}
        errorMessage={workspace.retryErrorMessage}
        onConfirm={async (password) => {
          await workspace.retryGooglePushWithPassword(password).catch(() => undefined);
        }}
      />
    </div>
  );
}
