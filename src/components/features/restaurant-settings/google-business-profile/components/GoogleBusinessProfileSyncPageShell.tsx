'use client';

import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Download,
  Eye,
  GitPullRequestArrow,
  Layers3,
  LockKeyhole,
  ShieldAlert,
  Upload,
  XCircle,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

import { AuditTimeline } from './AuditTimeline';
import { FieldDecisionRow } from './FieldDecisionRow';
import { PreflightReviewDialog } from './PreflightReviewDialog';
import { PublishPasswordDialog } from './PublishPasswordDialog';
import { RetryGooglePushPanel } from './RetryGooglePushPanel';
import { SyncStatusHeader } from './SyncStatusHeader';
import {
  formatWorkflowStatus,
  workflowStatusVariant,
  type ConflictSectionSummary,
  type FieldDecision,
} from '../lib/sync-review';
import { useGoogleBusinessProfileSyncWorkspace } from '../lib/useGoogleBusinessProfileSyncWorkspace';

import type {
  GoogleBusinessProfileActivePublishJob,
  GoogleBusinessProfileConnection,
} from '@/services/ops/restaurants';

type GoogleBusinessProfileSyncPageShellProps = {
  restaurantId: string;
  connection: GoogleBusinessProfileConnection;
  manageOnGoogleHref: string | null;
  onGenerateDraft: () => void;
  onChangeLocation: () => void;
  isGeneratingDraft: boolean;
  showChangeLocation: boolean;
};

type BulkDecision = Extract<FieldDecision, 'import_from_google' | 'export_to_google' | 'ignore'>;

function applyDialogTitle(direction: 'google_to_nabatable' | 'nabatable_to_google') {
  return direction === 'google_to_nabatable'
    ? 'Apply changes to Nabatable'
    : 'Apply changes to Google';
}

function EmptyReviewState() {
  return (
    <div className="flex min-h-[380px] items-center justify-center p-8 text-center">
      <div className="flex max-w-md flex-col items-center gap-5">
        <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-muted/60 shadow-sm ring-1 ring-border/70">
          <GitPullRequestArrow className="size-7 text-primary/70" />
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-lg font-semibold tracking-tight text-foreground">
            No changes checked yet
          </p>
          <p className="text-pretty text-sm leading-6 text-muted-foreground">
            Check for changes to compare the latest Google profile details with Nabatable.
          </p>
        </div>
      </div>
    </div>
  );
}

function NoReviewableSections() {
  return (
    <div className="flex min-h-[320px] items-center justify-center rounded-lg border border-dashed bg-muted/20 p-8 text-center">
      <div className="flex max-w-md flex-col items-center gap-4">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted/60">
          <Eye className="size-5 text-muted-foreground" />
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-foreground">No section cards to review</p>
          <p className="text-sm leading-6 text-muted-foreground">
            The latest draft has no actionable differences. Check for changes again when Google or
            Nabatable data changes.
          </p>
        </div>
      </div>
    </div>
  );
}

function SectionReviewCard({
  summary,
  getDecisionForItem,
  onDecisionChange,
  activePublishJob,
  googlePushEnabled,
}: {
  summary: ConflictSectionSummary;
  getDecisionForItem: (fieldKey: string) => FieldDecision;
  onDecisionChange: (fieldKey: string, decision: FieldDecision) => void;
  activePublishJob: GoogleBusinessProfileActivePublishJob | null;
  googlePushEnabled: boolean;
}) {
  const isResolved =
    summary.actionableCount > 0 &&
    summary.resolvedCount === summary.actionableCount &&
    summary.blockedCount === 0;
  const canBulkChange = summary.section.status !== 'stale';
  const bulkImportCount = summary.changedItems.filter((item) => item.canPublishToNabatable).length;
  const bulkExportCount = summary.changedItems.filter(
    (item) => item.canPushToGoogle && googlePushEnabled,
  ).length;
  const bulkIgnoreCount = summary.changedItems.length;
  const applyBulkDecision = (decision: BulkDecision) => {
    if (!canBulkChange) {
      return;
    }

    for (const item of summary.changedItems) {
      if (decision === 'import_from_google' && !item.canPublishToNabatable) {
        continue;
      }
      if (decision === 'export_to_google' && (!item.canPushToGoogle || !googlePushEnabled)) {
        continue;
      }
      onDecisionChange(item.fieldKey, decision);
    }
  };

  return (
    <AccordionItem
      value={summary.section.sectionKey}
      className="min-w-0 overflow-hidden rounded-xl border border-border/70 bg-card text-card-foreground shadow-sm"
      data-testid="gbp-section-review-card"
    >
      <AccordionTrigger className="rounded-none px-4 py-4 hover:bg-muted/30 sm:px-5">
        <span className="flex min-w-0 flex-1 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <span className="min-w-0 text-left">
            <span className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-background ring-1 ring-border/70">
                {isResolved ? (
                  <CheckCircle2 className="size-4 text-primary" aria-hidden />
                ) : (
                  <Layers3 className="size-4 text-muted-foreground" aria-hidden />
                )}
              </span>
              <span className="min-w-0 text-xl font-semibold tracking-tight text-foreground">
                {summary.section.label}
              </span>
              <Badge variant="outline" className="gap-1 text-[10px]">
                <LockKeyhole className="size-3" aria-hidden />
                Section review
              </Badge>
              <Badge variant={workflowStatusVariant(summary.section.status)}>
                {formatWorkflowStatus(summary.section.status)}
              </Badge>
            </span>
            <span className="mt-2 block text-pretty text-sm leading-6 text-muted-foreground">
              {summary.section.summary}
            </span>
          </span>
          <span className="flex min-w-0 flex-wrap gap-2 text-xs text-muted-foreground lg:justify-end">
            <Badge variant="secondary">
              {summary.resolvedCount}/{summary.actionableCount} resolved
            </Badge>
            {summary.importCount > 0 ? (
              <Badge variant="outline">{summary.importCount} importing</Badge>
            ) : null}
            {summary.exportCount > 0 ? (
              <Badge variant="outline">{summary.exportCount} exporting</Badge>
            ) : null}
            {summary.unchangedCount > 0 ? (
              <Badge variant="outline">{summary.unchangedCount} unchanged</Badge>
            ) : null}
          </span>
        </span>
      </AccordionTrigger>
      <AccordionContent className="border-t bg-background/60">
        {summary.section.blockedReasons.length > 0 ? (
          <Alert
            className="mb-4"
            variant={summary.section.status === 'stale' ? 'destructive' : 'default'}
          >
            <AlertTitle>
              {summary.section.status === 'stale' ? 'Check for changes again' : 'Section notes'}
            </AlertTitle>
            <AlertDescription>{summary.section.blockedReasons.join(' ')}</AlertDescription>
          </Alert>
        ) : null}

        <div className="mb-4 flex flex-col gap-3 rounded-lg border border-border/70 bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">Bulk select this section</p>
            <p className="text-xs leading-5 text-muted-foreground">
              Apply one decision to every eligible changed field in this section.
            </p>
          </div>
          <div className="grid min-w-0 gap-2 sm:grid-cols-3">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!canBulkChange || bulkImportCount === 0}
              onClick={() => applyBulkDecision('import_from_google')}
            >
              <Download data-icon="inline-start" />
              Import all ({bulkImportCount})
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!canBulkChange || bulkExportCount === 0}
              onClick={() => applyBulkDecision('export_to_google')}
            >
              <Upload data-icon="inline-start" />
              Export all ({bulkExportCount})
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!canBulkChange || bulkIgnoreCount === 0}
              onClick={() => applyBulkDecision('ignore')}
            >
              <XCircle data-icon="inline-start" />
              Ignore all
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          {summary.changedItems.map((item) => {
            const inActiveJob = Boolean(activePublishJob?.selectedApprovals[item.fieldKey]);
            return (
              <FieldDecisionRow
                key={item.fieldKey}
                item={item}
                section={summary.section}
                decision={getDecisionForItem(item.fieldKey)}
                onDecisionChange={(decision) => onDecisionChange(item.fieldKey, decision)}
                jobStatus={inActiveJob ? (activePublishJob?.status ?? null) : null}
                googlePushEnabled={googlePushEnabled}
              />
            );
          })}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
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
  const googlePushEnabled = connection.pushEnabled;
  const workspace = useGoogleBusinessProfileSyncWorkspace(restaurantId, googlePushEnabled);
  const workflow = workspace.workflowQuery.data;
  const draft = workspace.draft;
  const [openSectionKey, setOpenSectionKey] = useState('');
  const firstSectionKey = workspace.conflictSectionSummaries[0]?.section.sectionKey;
  const initializedDraftIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!draft?.id || !firstSectionKey) {
      setOpenSectionKey('');
      initializedDraftIdRef.current = null;
      return;
    }

    if (initializedDraftIdRef.current !== draft.id) {
      setOpenSectionKey(firstSectionKey);
      initializedDraftIdRef.current = draft.id;
      return;
    }

    if (!openSectionKey) {
      return;
    }

    const currentIsAvailable = workspace.conflictSectionSummaries.some(
      (summary) => summary.section.sectionKey === openSectionKey,
    );
    if (!currentIsAvailable) {
      setOpenSectionKey(firstSectionKey);
    }
  }, [draft?.id, firstSectionKey, openSectionKey, workspace.conflictSectionSummaries]);

  const progressValue =
    workspace.conflictStats.actionableCount > 0
      ? (workspace.conflictStats.resolvedCount / workspace.conflictStats.actionableCount) * 100
      : 0;
  const hasSelectedChanges =
    workspace.directionCounts.google_to_nabatable > 0 ||
    workspace.directionCounts.nabatable_to_google > 0;

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
    <div className="min-w-0 pb-24">
      <div className="flex flex-col gap-5">
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

        {!googlePushEnabled ? (
          <Alert>
            <ShieldAlert className="size-4" />
            <AlertTitle>Google updates are disabled</AlertTitle>
            <AlertDescription>
              This linked Business Profile can still be reviewed and pulled into Nabatable, but
              Google write-back is disabled for this location.
            </AlertDescription>
          </Alert>
        ) : null}

        <section className="min-w-0 overflow-hidden rounded-lg border border-border/70 bg-background shadow-sm">
          <div className="flex min-w-0 flex-col gap-5">
            <div className="border-b border-border/60 bg-[linear-gradient(180deg,hsl(var(--muted)/0.62),hsl(var(--background)))] p-4 sm:p-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="flex max-w-3xl flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">Approval workflow</Badge>
                    <Badge variant="secondary" className="gap-1">
                      <Download className="size-3" aria-hidden />
                      Import
                    </Badge>
                    <Badge variant="secondary" className="gap-1">
                      <Upload className="size-3" aria-hidden />
                      Export
                    </Badge>
                  </div>
                  <div className="flex flex-col gap-1">
                    <h2 className="text-balance text-2xl font-semibold tracking-tight text-foreground">
                      Review differences
                    </h2>
                    <p className="max-w-3xl text-pretty text-sm leading-6 text-muted-foreground">
                      Decide which value wins for each field, then run a final check before applying
                      selected imports and exports.
                    </p>
                  </div>
                </div>
                <div className="grid min-w-0 gap-2 sm:grid-cols-3 xl:min-w-[420px]">
                  <div className="rounded-xl bg-background p-3 shadow-sm ring-1 ring-border/70">
                    <p className="text-[11px] font-medium text-muted-foreground">Resolved</p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
                      {workspace.conflictStats.resolvedCount}/
                      {workspace.conflictStats.actionableCount}
                    </p>
                  </div>
                  <div className="rounded-xl bg-background p-3 shadow-sm ring-1 ring-border/70">
                    <p className="text-[11px] font-medium text-muted-foreground">Imports</p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
                      {workspace.conflictStats.importCount}
                    </p>
                  </div>
                  <div className="rounded-xl bg-background p-3 shadow-sm ring-1 ring-border/70">
                    <p className="text-[11px] font-medium text-muted-foreground">Exports</p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
                      {workspace.conflictStats.exportCount}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {!draft ? (
              <EmptyReviewState />
            ) : (
              <div className="flex min-w-0 flex-col gap-4 p-3 sm:p-5">
                {workspace.conflictSectionSummaries.length > 0 ? (
                  <Accordion
                    type="single"
                    collapsible
                    value={openSectionKey}
                    onValueChange={setOpenSectionKey}
                    className="flex min-w-0 flex-col gap-3"
                  >
                    {workspace.conflictSectionSummaries.map((summary) => (
                      <SectionReviewCard
                        key={summary.section.sectionKey}
                        summary={summary}
                        getDecisionForItem={(fieldKey) =>
                          workspace.fieldDecisions[fieldKey] ?? 'ignore'
                        }
                        onDecisionChange={(fieldKey, decision) => {
                          const item = summary.section.items.find(
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
                    ))}
                  </Accordion>
                ) : (
                  <NoReviewableSections />
                )}
              </div>
            )}
          </div>
        </section>

        <RetryGooglePushPanel
          activePublishJob={workspace.activePublishJob}
          onRetry={() => workspace.setRetryDialogOpen(true)}
          isRetryPending={workspace.retryMutation.isPending}
        />

        {draft && hasSelectedChanges ? (
          <div
            className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-7xl rounded-2xl bg-background/95 p-4 shadow-xl shadow-muted-foreground/10 ring-1 ring-border/70 backdrop-blur sm:right-6 md:left-[calc(var(--sidebar-width)+1.5rem)] lg:left-[calc(var(--sidebar-width)+2rem)] lg:right-8"
            data-testid="gbp-review-apply-bar"
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0 flex-1">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">
                    {workspace.conflictStats.resolvedCount} of{' '}
                    {workspace.conflictStats.actionableCount} conflicts resolved
                  </p>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Download className="size-3" aria-hidden />
                      {workspace.conflictStats.importCount} imports
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Upload className="size-3" aria-hidden />
                      {workspace.conflictStats.exportCount} exports
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <XCircle className="size-3" aria-hidden />
                      {Math.max(
                        workspace.conflictStats.actionableCount -
                          workspace.conflictStats.resolvedCount,
                        0,
                      )}{' '}
                      unresolved
                    </span>
                  </div>
                </div>
                <Progress value={progressValue} />
              </div>
              <Button
                type="button"
                className="w-full active:scale-[0.96] lg:w-auto"
                disabled={!hasSelectedChanges}
                onClick={workspace.beginReview}
              >
                <CheckCircle2 className="size-4" data-icon="inline-start" />
                Review &amp; Apply
                <ArrowRight className="size-4" data-icon="inline-end" />
              </Button>
            </div>
          </div>
        ) : null}

        <AuditTimeline events={workflow?.auditEvents ?? []} />
      </div>

      <PreflightReviewDialog
        open={workspace.preflightDialogOpen}
        onOpenChange={workspace.setPreflightDialogOpen}
        direction={workspace.reviewDirection}
        directionCounts={workspace.directionCounts}
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
        title={applyDialogTitle(workspace.reviewDirection)}
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
