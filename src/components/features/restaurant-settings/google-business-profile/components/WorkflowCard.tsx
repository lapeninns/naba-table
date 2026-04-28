'use client';

import {
  ArrowRightLeft,
  CheckCircle2,
  Circle,
  GitPullRequestArrow,
  Loader2,
  RefreshCw,
  Send,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  useOpsCreateGoogleBusinessProfileDraft,
  useOpsGoogleBusinessProfileWorkflow,
  useOpsPreflightGoogleBusinessProfileDraftPublish,
  useOpsPublishGoogleBusinessProfileDraft,
  useOpsUpdateGoogleBusinessProfileDraft,
} from '@/hooks/ops/useOpsGoogleBusinessProfile';
import { cn } from '@/lib/utils';
import { deriveGoogleBusinessProfileWorkflowStage } from '@/services/ops/restaurants';

import { GoogleBusinessProfileSyncActionDialog } from '../GoogleBusinessProfileSyncActionDialog';
import { formatGbpDateTime } from '../lib/formatters';
import { DetailInspector } from './workflow/DetailInspector';
import { SectionInbox } from './workflow/SectionInbox';
import {
  buildDialogItems,
  buildSectionSummaries,
  formatAuditDirectionLabel,
  formatDraftStatusLabel,
  statusVariant,
} from './workflow/workflow-utils';

import type {
  GoogleBusinessProfileDraftPublishPreflight,
  GoogleBusinessProfileWorkflowStage,
} from '@/services/ops/restaurants';

type WorkflowCardProps = {
  restaurantId: string;
};

/* Re-export for external consumers */
export { humanFieldLabel } from './workflow/workflow-utils';

/* ── Stepper ─────────────────────────────────────── */

type StepDef = {
  key: GoogleBusinessProfileWorkflowStage | 'publish';
  label: string;
  completedAt: GoogleBusinessProfileWorkflowStage[];
  activeAt: GoogleBusinessProfileWorkflowStage[];
};

const STEPS: StepDef[] = [
  {
    key: 'review',
    label: 'Review & Approve',
    completedAt: ['approved', 'preflighted', 'publishing', 'published', 'partial_failure'],
    activeAt: ['no_draft', 'review'],
  },
  {
    key: 'publish',
    label: 'Publish Changes',
    completedAt: ['published'],
    activeAt: ['approved', 'preflighted', 'publishing', 'partial_failure'],
  },
];

function StepperIndicator({ stage }: { stage: GoogleBusinessProfileWorkflowStage }) {
  return (
    <ol
      className="flex flex-wrap items-center gap-2"
      aria-label="Approval workflow progress"
      data-testid="gbp-workflow-stepper"
    >
      {STEPS.map((step, i) => {
        const done = step.completedAt.includes(stage);
        const active = step.activeAt.includes(stage);
        const spinning = stage === 'publishing' && step.key === 'publish';
        const Icon = done ? CheckCircle2 : spinning ? Loader2 : Circle;
        return (
          <li
            key={step.key}
            data-stage-key={step.key}
            data-stage-state={done ? 'complete' : active ? 'active' : 'pending'}
            className="flex items-center gap-1.5"
          >
            {i > 0 ? (
              <span
                className={cn('mx-1 hidden h-px w-7 sm:block', done ? 'bg-primary' : 'bg-border')}
              />
            ) : null}
            <Icon
              className={cn(
                'size-4',
                done ? 'text-primary' : active ? 'text-primary' : 'text-muted-foreground/40',
                spinning && 'animate-spin',
              )}
            />
            <span
              className={cn(
                'text-xs font-medium',
                done ? 'text-foreground' : active ? 'text-foreground' : 'text-muted-foreground/50',
              )}
            >
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/* ── Main component ─────────────────────────────── */

export function WorkflowCard({ restaurantId }: WorkflowCardProps) {
  const workflowQuery = useOpsGoogleBusinessProfileWorkflow(restaurantId);
  const createDraftMutation = useOpsCreateGoogleBusinessProfileDraft(restaurantId);
  const updateDraftMutation = useOpsUpdateGoogleBusinessProfileDraft(restaurantId);
  const preflightMutation = useOpsPreflightGoogleBusinessProfileDraftPublish(restaurantId);
  const publishMutation = useOpsPublishGoogleBusinessProfileDraft(restaurantId);

  const [selectedSectionKey, setSelectedSectionKey] = useState<string | null>(null);
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [publishPreflight, setPublishPreflight] =
    useState<GoogleBusinessProfileDraftPublishPreflight | null>(null);

  const workflow = workflowQuery.data;
  const draft = workflow?.latestDraft ?? null;

  const stage = useMemo(() => deriveGoogleBusinessProfileWorkflowStage(workflow), [workflow]);

  const selectedItems = useMemo(() => buildDialogItems(workflow), [workflow]);

  const sections = useMemo(() => draft?.sectionDiffs ?? [], [draft]);

  const summaries = useMemo(() => buildSectionSummaries(sections), [sections]);

  const counts = useMemo(() => {
    let changed = 0;
    let selected = 0;
    let blocked = 0;
    for (const s of summaries as {
      changedCount: number;
      selectedCount: number;
      blockedCount: number;
    }[]) {
      changed += s.changedCount;
      selected += s.selectedCount;
      blocked += s.blockedCount;
    }
    return { changed, selected, blocked };
  }, [summaries]);

  const activeSummary = useMemo(
    () =>
      summaries.find(
        (s: { section: { sectionKey: string } }) => s.section.sectionKey === selectedSectionKey,
      ) ?? null,
    [summaries, selectedSectionKey],
  );

  // Auto-select first active section when draft loads
  const handleSectionSelect = useCallback((key: string) => {
    setSelectedSectionKey(key);
  }, []);

  // If nothing selected yet but sections exist, pick first active.
  useEffect(() => {
    if (
      selectedSectionKey &&
      summaries.some(
        (s: { section: { sectionKey: string } }) => s.section.sectionKey === selectedSectionKey,
      )
    ) {
      return;
    }
    const firstActive = summaries.find((s: { isActive: boolean }) => s.isActive);
    if (firstActive) {
      setSelectedSectionKey(firstActive.section.sectionKey);
    } else if (summaries[0]) {
      setSelectedSectionKey(summaries[0].section.sectionKey);
    }
  }, [summaries, selectedSectionKey]);

  const visibleAuditEvents = useMemo(
    () =>
      workflow?.auditEvents.filter((e) => e.direction !== 'push_from_nabatable_to_google') ?? [],
    [workflow],
  );

  const isReviewPhase = stage === 'no_draft' || stage === 'review';
  const isPublishPhase =
    Boolean(draft) &&
    !draft?.staleSections.length &&
    (stage === 'approved' ||
      stage === 'preflighted' ||
      stage === 'publishing' ||
      stage === 'partial_failure');
  const canApprove =
    Boolean(draft) && isReviewPhase && !draft?.staleSections.length && counts.selected > 0;
  const canPublish = isPublishPhase && selectedItems.length > 0;

  const fetchedLabel = draft?.fetchedAt ? formatGbpDateTime(draft.fetchedAt) : null;
  const completionPercent =
    counts.changed > 0 ? Math.round((counts.selected / counts.changed) * 100) : 0;

  return (
    <div className="flex flex-col gap-4" data-testid="gbp-workflow-card">
      <Card className="overflow-hidden border-border/70 shadow-sm">
        <CardHeader className="gap-5 border-b bg-muted/20 sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
          <div className="flex max-w-4xl flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="w-fit font-medium">
                Read-only approval review
              </Badge>
              <Badge variant="secondary" className="gap-1 text-[11px]">
                <ArrowRightLeft className="size-3" aria-hidden />
                Google to Nabatable
              </Badge>
              <Badge variant="outline" className="text-[11px]">
                No Google write
              </Badge>
            </div>
            <div className="flex flex-col gap-2">
              <CardTitle className="text-balance text-2xl">Approval workflow</CardTitle>
              <CardDescription className="max-w-3xl">
                Compare the latest Google Business Profile values against Nabatable, confirm the
                approved selections, then publish only the reviewed changes into Nabatable.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StepperIndicator stage={stage} />
              {draft ? (
                <Badge variant={statusVariant(draft.status)} className="text-[11px]">
                  {formatDraftStatusLabel(draft.status)}
                </Badge>
              ) : null}
            </div>
          </div>

          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                createDraftMutation.mutate(undefined, {
                  onSuccess: () => workflowQuery.refetch(),
                })
              }
              disabled={createDraftMutation.isPending}
            >
              <RefreshCw
                className={cn('size-3.5', createDraftMutation.isPending && 'animate-spin')}
                data-icon="inline-start"
              />
              {createDraftMutation.isPending ? 'Refreshing…' : 'Refresh draft'}
            </Button>

            {isReviewPhase && draft ? (
              <Button
                type="button"
                size="sm"
                onClick={() =>
                  updateDraftMutation.mutate(
                    { draftId: draft.id, payload: { status: 'approved' } },
                    { onSuccess: () => workflowQuery.refetch() },
                  )
                }
                disabled={!canApprove || updateDraftMutation.isPending}
                data-testid="gbp-approve-button"
              >
                <CheckCircle2 className="size-3.5" data-icon="inline-start" />
                {updateDraftMutation.isPending ? 'Approving…' : `Approve (${counts.selected})`}
              </Button>
            ) : null}

            {isPublishPhase ? (
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  setPublishPreflight(null);
                  preflightMutation.reset();
                  setPublishDialogOpen(true);
                }}
                disabled={!canPublish || publishMutation.isPending}
                data-testid="gbp-publish-button"
              >
                <Send className="size-3.5" data-icon="inline-start" />
                Publish ({selectedItems.length})
              </Button>
            ) : null}
          </div>
        </CardHeader>

        {draft ? (
          <CardContent className="grid gap-0 p-0 sm:grid-cols-3">
            <div className="border-b px-5 py-4 sm:border-b-0 sm:border-r">
              <p className="text-xs font-medium text-muted-foreground">Review coverage</p>
              <p
                className="mt-1 text-2xl font-semibold tabular-nums text-foreground"
                data-testid="gbp-selected-count"
              >
                {counts.selected}/{counts.changed}
              </p>
              <p className="text-xs text-muted-foreground">{completionPercent}% selected</p>
            </div>
            <div className="border-b px-5 py-4 sm:border-b-0 sm:border-r">
              <p className="text-xs font-medium text-muted-foreground">Blocked items</p>
              <p
                className={cn(
                  'mt-1 text-2xl font-semibold tabular-nums',
                  counts.blocked > 0 ? 'text-destructive' : 'text-foreground',
                )}
              >
                {counts.blocked}
              </p>
              <p className="text-xs text-muted-foreground">
                {counts.blocked > 0 ? 'Needs a fresh or supported value' : 'No blockers in draft'}
              </p>
            </div>
            <div className="px-5 py-4">
              <p className="text-xs font-medium text-muted-foreground">Draft fetched</p>
              <p className="mt-1 text-sm font-semibold tabular-nums text-foreground">
                {fetchedLabel ?? 'Not fetched'}
              </p>
              <p className="text-xs text-muted-foreground">Read-only comparison snapshot</p>
            </div>
          </CardContent>
        ) : null}
      </Card>

      {workflowQuery.error ? (
        <Alert variant="destructive">
          <AlertTitle>Workflow unavailable</AlertTitle>
          <AlertDescription>{workflowQuery.error.message}</AlertDescription>
        </Alert>
      ) : null}

      {draft?.staleSections.length ? (
        <Alert variant="destructive">
          <AlertTitle>Draft is stale</AlertTitle>
          <AlertDescription>
            Refresh the draft before publishing: {draft.staleSections.join(', ')}.
          </AlertDescription>
        </Alert>
      ) : null}

      <Card className="overflow-hidden border-border/70">
        <CardContent className="p-0">
          {!draft && !workflowQuery.isLoading ? (
            <div
              className="flex min-h-[320px] items-center justify-center p-8 text-center"
              data-testid="gbp-no-draft"
            >
              <div className="flex max-w-md flex-col items-center gap-4">
                <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-muted/60">
                  <GitPullRequestArrow className="size-7 text-muted-foreground/50" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <p className="text-base font-semibold text-foreground">No review draft yet</p>
                  <p className="text-sm text-muted-foreground">
                    Generate a draft to compare what is on Google Business Profile against
                    Nabatable. Use <span className="font-medium">Refresh draft</span> above to fetch
                    the latest from Google and build a reviewable change list.
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {draft ? (
            <div
              className="grid min-h-[560px] grid-cols-1 lg:grid-cols-[320px_1fr]"
              data-testid="gbp-split-pane"
            >
              <div className="border-b border-border/60 lg:border-b-0 lg:border-r lg:border-border/60">
                <SectionInbox
                  summaries={summaries}
                  selectedKey={selectedSectionKey}
                  onSelect={handleSectionSelect}
                  totalSelected={counts.selected}
                  totalChanged={counts.changed}
                />
              </div>

              <div className="min-h-0">
                <DetailInspector summary={activeSummary} />
              </div>
            </div>
          ) : null}
        </CardContent>
        {visibleAuditEvents.length > 0 ? (
          <CardFooter className="flex-col items-stretch gap-3 border-t bg-muted/20 px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
                Recent audit
              </p>
              <Badge variant="outline" className="text-[10px]">
                {visibleAuditEvents.length} event{visibleAuditEvents.length === 1 ? '' : 's'}
              </Badge>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              {visibleAuditEvents.slice(0, 4).map((event) => (
                <div
                  key={event.id}
                  className="flex min-w-0 items-center justify-between gap-3 rounded-md border bg-background px-3 py-2 text-xs"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">
                      {formatAuditDirectionLabel(event)}
                    </p>
                    <p className="truncate text-muted-foreground">
                      {event.affectedSections.join(', ') || 'No sections'}
                    </p>
                  </div>
                  <Badge variant={statusVariant(event.result)} className="shrink-0 text-[10px]">
                    {event.result}
                  </Badge>
                </div>
              ))}
            </div>
          </CardFooter>
        ) : null}
      </Card>

      <GoogleBusinessProfileSyncActionDialog
        open={publishDialogOpen}
        onOpenChange={(open: boolean) => {
          setPublishDialogOpen(open);
          if (!open) {
            setPublishPreflight(null);
            preflightMutation.reset();
          }
        }}
        title="Publish approved GBP draft"
        description="Publish approved Google Business Profile changes into Nabatable. This does not write back to Google."
        confirmLabel="Publish"
        selectionLabel="These items were approved in Step 1 and will publish."
        items={selectedItems}
        preflight={publishPreflight}
        isPreflightPending={preflightMutation.isPending}
        preflightErrorMessage={preflightMutation.error?.message ?? null}
        onPreflightReset={() => {
          setPublishPreflight(null);
          preflightMutation.reset();
        }}
        onPreflight={async () => {
          if (!draft) return;
          const pf = await preflightMutation.mutateAsync({
            draftId: draft.id,
            payload: {
              selectedApprovals: draft.selectedApprovals,
              directionIntent: 'google_to_nabatable',
            },
          });
          setPublishPreflight(pf);
        }}
        isPending={publishMutation.isPending}
        errorMessage={publishMutation.error?.message ?? null}
        onConfirm={async ({ password }: { password: string }) => {
          if (!draft || !publishPreflight) return;
          await publishMutation.mutateAsync({
            draftId: draft.id,
            payload: {
              password,
              publishJobId: publishPreflight.publishJobId,
              idempotencyKey: publishPreflight.idempotencyKey,
              selectedApprovals: draft.selectedApprovals,
              directionIntent: 'google_to_nabatable',
            },
          });
          setPublishDialogOpen(false);
          setPublishPreflight(null);
          void workflowQuery.refetch();
        }}
      />
    </div>
  );
}
