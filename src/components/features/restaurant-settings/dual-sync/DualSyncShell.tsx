/**
 * Phase 3c of the unified dual-sync engine.
 *
 * Restaurant-settings dual-sync workspace. Renders the registry-driven
 * field summary returned by `GET /dual-sync/state`, lets the operator
 * pick a per-field action (import / export / ignore), and submits the
 * decision set to `POST /dual-sync/publish`.
 *
 * The shell is intentionally provider-agnostic: it only knows about the
 * field summary contract from `services/ops/dual-sync.ts`. Section
 * filtering lets the same component be reused inside the three settings
 * pages (profile, availability, GBP) by passing the relevant section
 * keys.
 */

'use client';

import { AlertCircle, PauseCircle, PlayCircle, RefreshCw, Send, Zap } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

import { DualSyncFieldRow } from './DualSyncFieldRow';
import { DualSyncFreshnessChip } from './DualSyncFreshnessChip';
import { DualSyncHeatmap } from './DualSyncHeatmap';
import { DualSyncPublishPreviewDialog } from './DualSyncPublishPreviewDialog';
import { DualSyncPublishResultDialog } from './DualSyncPublishResultDialog';
import { DualSyncToolbarTip } from './DualSyncToolbarTip';
import { summarizeFieldsToHeatmap } from './heatmap';
import {
  DUAL_SYNC_PANEL_VALUES,
  DUAL_SYNC_SECTION_LABEL,
  getDualSyncSectionBulkSummary,
  isDualSyncSectionKey,
  useDualSyncWorkspace,
} from './hooks/useDualSyncWorkspace';
import { DualSyncOperationalHealthPanel } from './panels/health/DualSyncOperationalHealthPanel';
import { DualSyncPendingCandidatesPanel } from './panels/jobs/DualSyncPendingCandidatesPanel';
import { DualSyncPublishJobsPanel } from './panels/jobs/DualSyncPublishJobsPanel';
import { DualSyncQueueJobsPanel } from './panels/jobs/DualSyncQueueJobsPanel';
import { DualSyncOperationsPanel } from './panels/operations/DualSyncOperationsPanel';

import type { DualSyncSectionKey } from '@/server/dual-sync';
import type {
  DualSyncPublishPreviewResponse,
  DualSyncPublishRequest,
  DualSyncPublishResponse,
} from '@/services/ops/dual-sync';

export interface DualSyncShellProps {
  readonly restaurantId: string;
  /**
   * Optional section filter. When provided, only fields whose
   * `sectionKey` is in this list are shown. The shell still publishes
   * decisions only for visible fields.
   */
  readonly sections?: ReadonlyArray<DualSyncSectionKey>;
  readonly className?: string;
  readonly singleOpenSections?: boolean;
}

interface PendingPublishPreview {
  readonly request: DualSyncPublishRequest;
  readonly plan: DualSyncPublishPreviewResponse;
}

export function DualSyncShell({
  restaurantId,
  sections,
  className,
  singleOpenSections = false,
}: DualSyncShellProps) {
  const {
    stateQuery,
    refreshMutation,
    publishMutation,
    previewPublishMutation,
    autoExportMutation,
    retryJobMutation,
    cancelCandidateMutation,
    controlMutation,
    operationsQuery,
    jobsQuery,
    candidatesQuery,
    metricsQuery,
    publishJobsQuery,
    publishJobDetailQuery,
    decisions,
    setDecisions,
    decisionCount,
    fieldsBySection,
    getSectionProgress,
    onBulkSelectSection,
    onClearSection,
    onSelectAction,
    openSection,
    orderedAccordionValues,
    orderedSectionKeys,
    selectedJobId,
    setOpenSection,
    setSelectedJobId,
    setShowOperationalHealth,
    setShowOperations,
    setShowPendingCandidates,
    setShowPublishJobs,
    setShowQueueJobs,
    showOperationalHealth,
    showOperations,
    showPendingCandidates,
    showPublishJobs,
    showQueueJobs,
    visibleFields,
    workspaceProgress,
  } = useDualSyncWorkspace({
    restaurantId,
    sections,
    singleOpenSections,
  });
  const [publishPreview, setPublishPreview] = useState<PendingPublishPreview | null>(null);
  const [publishPreviewOpen, setPublishPreviewOpen] = useState(false);
  const [publishResult, setPublishResult] = useState<DualSyncPublishResponse | null>(null);
  const [publishResultOpen, setPublishResultOpen] = useState(false);

  const outboundQueue = stateQuery.data?.outboundQueue ?? null;
  const control = stateQuery.data?.control ?? null;
  const syncPaused = control?.syncPaused ?? false;
  const pauseReason = control?.pauseReason ?? 'Dual-sync is paused for this restaurant.';
  const autoExportable = outboundQueue?.autoExportable ?? 0;
  const totalOpen = outboundQueue?.totalOpen ?? 0;
  const lastSnapshot = stateQuery.data?.lastSnapshot ?? null;
  const lastSnapshotAt = lastSnapshot?.finishedAt ?? lastSnapshot?.startedAt ?? null;
  const overallHeatmap = useMemo(
    () => summarizeFieldsToHeatmap(stateQuery.data?.fields ?? []),
    [stateQuery.data?.fields],
  );
  const writeBlocked = syncPaused || publishMutation.isPending || previewPublishMutation.isPending;
  const canSubmit =
    decisionCount > 0 &&
    !syncPaused &&
    !publishMutation.isPending &&
    !previewPublishMutation.isPending;

  const onClickRefresh = async () => {
    if (syncPaused) {
      toast.error(pauseReason);
      return;
    }
    try {
      await refreshMutation.mutateAsync();
      toast.success('Pulled the latest Google profile.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Refresh failed.');
    }
  };

  const onClickAutoExport = async () => {
    if (syncPaused) {
      toast.error(pauseReason);
      return;
    }
    try {
      const result = await autoExportMutation.mutateAsync();
      const summary = result.publishResult?.summary;
      const succeeded = summary?.succeededCount ?? 0;
      const failed = summary?.failedCount ?? 0;
      if (failed > 0) {
        toast.error(`${succeeded} queued exports synced, ${failed} failed. See per-field errors.`);
      } else if (succeeded > 0) {
        toast.success(`${succeeded} queued exports synced to Google.`);
      } else if (result.skipped.length > 0) {
        toast.warning(
          `Skipped ${result.skipped.length} candidates without a baseline. Refresh first.`,
        );
      } else {
        toast.info('No queued exports were ready to run.');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Auto-export failed.');
    }
  };

  const buildPublishRequest = (): DualSyncPublishRequest | null => {
    const stateData = stateQuery.data;
    if (!stateData) {
      return null;
    }
    const fieldByKey = new Map(stateData.fields.map((field) => [field.fieldKey, field]));
    const payload = Object.entries(decisions)
      .map(([fieldKey, entry]) => {
        const field = fieldByKey.get(fieldKey);
        if (!field || !isDualSyncSectionKey(field.sectionKey)) return null;
        return {
          fieldKey,
          sectionKey: field.sectionKey as DualSyncSectionKey,
          action: entry.action,
          pinnedCoreHash: field.coreCanonicalHash,
          pinnedGbpHash: field.gbpCanonicalHash,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
    if (payload.length === 0) {
      return null;
    }
    return {
      decisions: payload,
      clientRequestId:
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `dual-sync-${Date.now()}`,
      pinnedCoreSnapshotHash: stateData.coreSnapshotHash ?? null,
      pinnedGbpSnapshotHash: stateData.gbpSnapshotHash ?? null,
    };
  };

  const onClickPublish = async () => {
    if (syncPaused) {
      toast.error(pauseReason);
      return;
    }
    if (!canSubmit) return;
    if (!stateQuery.data) {
      toast.error('Dual-sync state has not loaded yet.');
      return;
    }
    const request = buildPublishRequest();
    if (!request) {
      toast.error('No valid decisions to publish.');
      return;
    }
    try {
      const plan = await previewPublishMutation.mutateAsync(request);
      setPublishPreview({ request, plan });
      setPublishPreviewOpen(true);
      if (plan.acceptedCount === 0) {
        toast.warning('No selected fields are eligible to publish.');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Publish preview failed.');
    }
  };

  const onClickToggleControl = async () => {
    try {
      const nextPaused = !syncPaused;
      await controlMutation.mutateAsync({
        syncPaused: nextPaused,
        reason: nextPaused ? 'Paused from dual-sync settings.' : null,
      });
      if (nextPaused) {
        setDecisions({});
        setPublishPreview(null);
        setPublishPreviewOpen(false);
        toast.success('Dual-sync is paused for this restaurant.');
      } else {
        toast.success('Dual-sync is active for this restaurant.');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Dual-sync control update failed.');
    }
  };

  const onConfirmPublishPreview = async () => {
    if (!publishPreview) return;
    const acceptedDecisions = publishPreview.plan.groups.flatMap((group) => group.fields);
    if (acceptedDecisions.length === 0) {
      toast.error('No accepted decisions to publish.');
      return;
    }
    try {
      const result = await publishMutation.mutateAsync({
        ...publishPreview.request,
        decisions: acceptedDecisions,
        pinnedCoreSnapshotHash: publishPreview.plan.coreSnapshotHash,
        pinnedGbpSnapshotHash: publishPreview.plan.gbpSnapshotHash,
      });
      const failed = result.failedCount;
      const succeeded = result.succeededCount;
      if (failed > 0) {
        toast.error(`${succeeded} fields synced, ${failed} failed. See per-field errors below.`);
      } else {
        toast.success(`${succeeded} fields synced.`);
      }
      setDecisions({});
      setPublishPreview(null);
      setPublishPreviewOpen(false);
      setPublishResult(result);
      setPublishResultOpen(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Publish failed.');
    }
  };

  if (stateQuery.isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-base">Google Business Profile sync</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (stateQuery.isError) {
    return (
      <Alert variant="destructive" className={className}>
        <AlertCircle className="size-4" />
        <AlertTitle>Couldn&apos;t load dual-sync state.</AlertTitle>
        <AlertDescription>
          {stateQuery.error instanceof Error ? stateQuery.error.message : 'Unknown error.'}
        </AlertDescription>
      </Alert>
    );
  }

  if (visibleFields.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-base">Google Business Profile sync</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">
          No syncable fields in scope yet.
        </CardContent>
      </Card>
    );
  }

  const accordionProps = singleOpenSections
    ? ({
        type: 'single',
        collapsible: true,
        value: openSection,
        onValueChange: (value: string) => setOpenSection(value || undefined),
      } as const)
    : ({
        type: 'multiple',
        defaultValue: orderedAccordionValues,
      } as const);

  return (
    <>
      <DualSyncPublishPreviewDialog
        open={publishPreviewOpen}
        plan={publishPreview?.plan ?? null}
        isPublishing={publishMutation.isPending}
        onOpenChange={setPublishPreviewOpen}
        onConfirm={onConfirmPublishPreview}
      />
      <DualSyncPublishResultDialog
        open={publishResultOpen}
        result={publishResult}
        onOpenChange={setPublishResultOpen}
      />
      <TooltipProvider delayDuration={250}>
        <Card className={cn('space-y-4', className)}>
          <CardHeader className="flex flex-col gap-3 pb-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <CardTitle className="text-base">Google Business Profile sync</CardTitle>
                {totalOpen > 0 ? (
                  <Badge variant="secondary" className="font-mono text-xs">
                    {totalOpen} pending
                  </Badge>
                ) : null}
                <DualSyncFreshnessChip
                  timestamp={lastSnapshotAt}
                  prefix="Verified"
                  neverLabel="Never verified"
                />
                {overallHeatmap.total > 0 ? <DualSyncHeatmap counts={overallHeatmap} /> : null}
                {syncPaused ? (
                  <Badge variant="destructive" className="text-xs">
                    Paused
                  </Badge>
                ) : null}
              </div>
              <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:justify-end">
                <DualSyncToolbarTip
                  enabledHint={
                    syncPaused
                      ? 'Turn writes back on so you can refresh data, edit field actions, and publish.'
                      : 'Stop refresh, publish, and field actions while you investigate. Your unsent draft choices are cleared when you pause.'
                  }
                  disabledHint="Updating pause state…"
                  disabled={controlMutation.isPending}
                >
                  <Button
                    variant={syncPaused ? 'default' : 'outline'}
                    size="sm"
                    onClick={onClickToggleControl}
                    disabled={controlMutation.isPending}
                  >
                    {syncPaused ? (
                      <PlayCircle data-icon="inline-start" />
                    ) : (
                      <PauseCircle data-icon="inline-start" />
                    )}
                    {controlMutation.isPending
                      ? 'Updating...'
                      : syncPaused
                        ? 'Resume sync'
                        : 'Pause sync'}
                  </Button>
                </DualSyncToolbarTip>
                <DualSyncToolbarTip
                  enabledHint="Pull a fresh listing snapshot for the review workspace below. This does not apply draft actions or refresh only the connection card."
                  disabledHint={
                    syncPaused ? pauseReason : 'Already pulling the latest Google data…'
                  }
                  disabled={syncPaused || refreshMutation.isPending}
                >
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onClickRefresh}
                    disabled={syncPaused || refreshMutation.isPending}
                  >
                    <RefreshCw
                      className={cn('mr-1 size-4', refreshMutation.isPending && 'animate-spin')}
                    />
                    Import latest Google details
                  </Button>
                </DualSyncToolbarTip>
                <DualSyncToolbarTip
                  enabledHint={`Send ${autoExportable} queued Google update${autoExportable === 1 ? '' : 's'} that are ready to publish. Use after reviewing changes when work was queued.`}
                  disabledHint={
                    syncPaused
                      ? pauseReason
                      : autoExportMutation.isPending
                        ? 'Automatic publishing is running…'
                        : 'Nothing is queued to push to Google yet.'
                  }
                  disabled={syncPaused || autoExportable === 0 || autoExportMutation.isPending}
                >
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onClickAutoExport}
                    disabled={syncPaused || autoExportable === 0 || autoExportMutation.isPending}
                    aria-disabled={
                      syncPaused || autoExportable === 0 || autoExportMutation.isPending
                    }
                  >
                    <Zap
                      className={cn('mr-1 size-4', autoExportMutation.isPending && 'animate-pulse')}
                    />
                    {autoExportMutation.isPending
                      ? 'Running…'
                      : `Automatically publish approved changes ${
                          autoExportable > 0 ? `(${autoExportable})` : ''
                        }`.trim()}
                  </Button>
                </DualSyncToolbarTip>
                <DualSyncToolbarTip
                  enabledHint="Preview your choices, then apply the Import from Google, Send to Google, or Ignore decisions you selected."
                  disabledHint={
                    publishMutation.isPending || previewPublishMutation.isPending
                      ? 'Finish the running publish or preview first.'
                      : syncPaused
                        ? pauseReason
                        : 'Choose Import from Google, Send to Google, or Ignore on at least one field.'
                  }
                  disabled={!canSubmit}
                >
                  <Button
                    size="sm"
                    onClick={onClickPublish}
                    disabled={!canSubmit}
                    aria-disabled={!canSubmit}
                  >
                    <Send className="mr-1 size-4" />
                    {publishMutation.isPending
                      ? 'Publishing…'
                      : `Review and publish ${
                          decisionCount > 0 ? `(${decisionCount})` : ''
                        }`.trim()}
                  </Button>
                </DualSyncToolbarTip>
              </div>
            </div>
            <div className="flex w-full flex-col gap-2 border-t border-border/60 pt-3">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <p className="text-muted-foreground max-w-3xl text-xs leading-relaxed">
                  {workspaceProgress.needsReviewCount > 0 ? (
                    <>
                      <span className="text-foreground font-medium">Review queue: </span>
                      {workspaceProgress.draftedForReviewCount} of{' '}
                      {workspaceProgress.needsReviewCount} fields that differ from Google have a
                      draft action. Finish choices in each section, then Publish.
                    </>
                  ) : (
                    <>
                      <span className="text-foreground font-medium">Up to date: </span>
                      No visible fields currently need a sync direction (drift, conflict, or
                      failure).
                    </>
                  )}
                </p>
                <div className="text-muted-foreground flex shrink-0 flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[10px] tabular-nums">
                  <span title="Share of visible fields whose snapshot matches Google">
                    Match {Math.round(workspaceProgress.syncHealthPercent)}%
                  </span>
                  {workspaceProgress.needsReviewCount > 0 ? (
                    <span title="Draft actions covering fields that still differ">
                      · Draft {Math.round(workspaceProgress.draftCoveragePercent)}%
                    </span>
                  ) : null}
                </div>
              </div>
              <Progress
                value={
                  workspaceProgress.needsReviewCount > 0
                    ? workspaceProgress.draftCoveragePercent
                    : workspaceProgress.syncHealthPercent
                }
                className="h-2"
                aria-label={
                  workspaceProgress.needsReviewCount > 0
                    ? 'Progress drafting decisions for fields that differ from Google'
                    : 'Share of visible fields in sync with Google'
                }
              />
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {syncPaused ? (
              <Alert>
                <PauseCircle className="size-4" />
                <AlertTitle>Dual-sync is paused.</AlertTitle>
                <AlertDescription>
                  {pauseReason} Write-affecting actions are disabled until sync is resumed.
                </AlertDescription>
              </Alert>
            ) : null}
            <Accordion {...accordionProps} className="space-y-3">
              {orderedSectionKeys.map((sectionKey) => {
                const fields = fieldsBySection.get(sectionKey) ?? [];
                const bulkSummary = getDualSyncSectionBulkSummary(fields, decisions);
                const sectionProgress = getSectionProgress(fields, decisions);
                const hasSectionReview = sectionProgress.needsReviewCount > 0;
                return (
                  <AccordionItem key={sectionKey} value={sectionKey} className="border-b">
                    <AccordionTrigger className="text-sm font-semibold">
                      <div className="flex w-full flex-col gap-2 pr-2 sm:flex-row sm:items-center sm:justify-between">
                        <span className="text-left">
                          {DUAL_SYNC_SECTION_LABEL[sectionKey]} ({fields.length})
                        </span>
                        <div className="flex min-w-0 flex-1 flex-col gap-1 sm:max-w-56">
                          <div className="text-muted-foreground flex items-center justify-between gap-2 font-mono text-[10px] font-normal tabular-nums">
                            {hasSectionReview ? (
                              <>
                                <span>Draft progress</span>
                                <span>
                                  {sectionProgress.draftedForReviewCount}/
                                  {sectionProgress.needsReviewCount}
                                </span>
                              </>
                            ) : (
                              <>
                                <span>No review needed</span>
                                <span>0 pending</span>
                              </>
                            )}
                          </div>
                          <Progress
                            value={hasSectionReview ? sectionProgress.draftCoveragePercent : 100}
                            className="h-1.5"
                            aria-label={
                              hasSectionReview
                                ? `Draft progress for ${DUAL_SYNC_SECTION_LABEL[sectionKey]}`
                                : `${DUAL_SYNC_SECTION_LABEL[sectionKey]} has no fields needing review`
                            }
                          />
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-2 pt-2">
                      {fields.length > 0 ? (
                        <div className="bg-muted/30 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2">
                          <div className="space-y-0.5">
                            <p className="text-xs font-semibold uppercase tracking-wide">
                              Bulk select
                            </p>
                            <p className="text-muted-foreground text-xs">
                              Apply one draft action to fields in this section that need an operator
                              choice. In-sync rows are left unchanged.
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => onBulkSelectSection(fields, 'import_from_google')}
                              disabled={writeBlocked || bulkSummary.importable === 0}
                              aria-disabled={writeBlocked || bulkSummary.importable === 0}
                            >
                              Import ({bulkSummary.importable})
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => onBulkSelectSection(fields, 'export_to_google')}
                              disabled={writeBlocked || bulkSummary.exportable === 0}
                              aria-disabled={writeBlocked || bulkSummary.exportable === 0}
                            >
                              Export ({bulkSummary.exportable})
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => onBulkSelectSection(fields, 'ignore')}
                              disabled={writeBlocked || bulkSummary.ignorable === 0}
                              aria-disabled={writeBlocked || bulkSummary.ignorable === 0}
                            >
                              Ignore ({bulkSummary.ignorable})
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => onClearSection(fields)}
                              disabled={writeBlocked || bulkSummary.selected === 0}
                              aria-disabled={writeBlocked || bulkSummary.selected === 0}
                            >
                              Clear ({bulkSummary.selected})
                            </Button>
                          </div>
                        </div>
                      ) : null}
                      {fields.map((field) => (
                        <DualSyncFieldRow
                          key={field.fieldKey}
                          field={field}
                          selectedAction={decisions[field.fieldKey]?.action ?? null}
                          onChangeAction={(next) => onSelectAction(field.fieldKey, next)}
                          disabled={writeBlocked}
                        />
                      ))}
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
              <AccordionItem
                key={DUAL_SYNC_PANEL_VALUES.metrics}
                value={DUAL_SYNC_PANEL_VALUES.metrics}
                className="border-b"
                onClick={() => {
                  if (!showOperationalHealth) setShowOperationalHealth(true);
                }}
              >
                <AccordionTrigger
                  className="text-sm font-semibold"
                  onClick={() => setShowOperationalHealth(true)}
                >
                  Operational health
                </AccordionTrigger>
                <AccordionContent className="pt-2">
                  {showOperationalHealth ? (
                    <DualSyncOperationalHealthPanel metricsQuery={metricsQuery} />
                  ) : (
                    <div className="text-muted-foreground text-xs">
                      Expand to load queue, quota, and publish failure health.
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
              <AccordionItem
                key={DUAL_SYNC_PANEL_VALUES.pendingCandidates}
                value={DUAL_SYNC_PANEL_VALUES.pendingCandidates}
                className="border-b"
                onClick={() => {
                  if (!showPendingCandidates) setShowPendingCandidates(true);
                }}
              >
                <AccordionTrigger
                  className="text-sm font-semibold"
                  onClick={() => setShowPendingCandidates(true)}
                >
                  Pending changes
                </AccordionTrigger>
                <AccordionContent className="pt-2">
                  {showPendingCandidates ? (
                    <DualSyncPendingCandidatesPanel
                      candidatesQuery={candidatesQuery}
                      cancelCandidateMutation={cancelCandidateMutation}
                    />
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-dashed p-3">
                      <span className="text-xs text-muted-foreground">
                        Load pending Core changes that can be cancelled before export.
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowPendingCandidates(true)}
                      >
                        Load pending changes
                      </Button>
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
              <AccordionItem
                key={DUAL_SYNC_PANEL_VALUES.queueJobs}
                value={DUAL_SYNC_PANEL_VALUES.queueJobs}
                className="border-b"
                onClick={() => {
                  if (!showQueueJobs) setShowQueueJobs(true);
                }}
              >
                <AccordionTrigger
                  className="text-sm font-semibold"
                  onClick={() => setShowQueueJobs(true)}
                >
                  Queue recovery
                </AccordionTrigger>
                <AccordionContent className="pt-2">
                  {showQueueJobs ? (
                    <DualSyncQueueJobsPanel
                      jobsQuery={jobsQuery}
                      retryJobMutation={retryJobMutation}
                    />
                  ) : (
                    <div className="text-muted-foreground text-xs">
                      Expand to load durable queue jobs and retry terminal failures.
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
              <AccordionItem
                key={DUAL_SYNC_PANEL_VALUES.publishes}
                value={DUAL_SYNC_PANEL_VALUES.publishes}
                className="border-b"
                onClick={() => {
                  if (!showPublishJobs) setShowPublishJobs(true);
                }}
              >
                <AccordionTrigger
                  className="text-sm font-semibold"
                  onClick={() => setShowPublishJobs(true)}
                >
                  Recent publishes
                </AccordionTrigger>
                <AccordionContent className="pt-2">
                  {showPublishJobs ? (
                    <DualSyncPublishJobsPanel
                      publishJobsQuery={publishJobsQuery}
                      selectedJobId={selectedJobId}
                      onSelectJob={setSelectedJobId}
                      publishJobDetailQuery={publishJobDetailQuery}
                    />
                  ) : (
                    <div className="text-muted-foreground text-xs">
                      Expand to load recent publish jobs grouped by run.
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
              <AccordionItem
                key={DUAL_SYNC_PANEL_VALUES.operations}
                value={DUAL_SYNC_PANEL_VALUES.operations}
                className="border-b"
                onClick={() => {
                  if (!showOperations) setShowOperations(true);
                }}
              >
                <AccordionTrigger
                  className="text-sm font-semibold"
                  onClick={() => setShowOperations(true)}
                >
                  Recent operations
                </AccordionTrigger>
                <AccordionContent className="pt-2">
                  {showOperations ? (
                    <DualSyncOperationsPanel operationsQuery={operationsQuery} />
                  ) : (
                    <div className="text-muted-foreground text-xs">
                      Expand to load recent publish operations.
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>
      </TooltipProvider>
    </>
  );
}
