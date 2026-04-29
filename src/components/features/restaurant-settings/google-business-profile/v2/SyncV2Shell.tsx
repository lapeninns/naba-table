/**
 * Phase 5 of the GBP Dual-Sync V2 architecture.
 *
 * Decision-first V2 sync workspace. Single source of truth is the
 * `decisions` map keyed by `${sectionKey}::${fieldKey}`. Progress indicators
 * and CTA enablement are derived from decisions + diff capabilities; no
 * separate selection state is kept.
 */

'use client';

import { AlertCircle, CheckCircle2, RefreshCw, RotateCcw, Save, Send } from 'lucide-react';
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
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useOpsGoogleBusinessProfileV2 } from '@/hooks/ops/useOpsGoogleBusinessProfileV2';
import { cn } from '@/lib/utils';

import { V2FieldDecisionRow } from './V2FieldDecisionRow';
import { V2PreflightDialog } from './V2PreflightDialog';

import type {
  SyncV2DecisionAction,
  SyncV2DecisionInput,
  SyncV2DiffItem,
  SyncV2DirectionIntent,
  SyncV2PreflightResult,
  SyncV2PublishJob,
  SyncV2SectionKey,
} from '@/server/google-business-profile-v2/types';

export interface SyncV2ShellProps {
  readonly restaurantId: string;
  readonly draftId: string | null;
}

const SECTION_LABELS: Record<SyncV2SectionKey, string> = {
  profile: 'Profile',
  operatingHours: 'Operating hours',
  servicePeriods: 'Service periods',
  'businessContext.categories': 'Categories',
  'businessContext.serviceAreas': 'Service areas',
  'businessContext.attributes': 'Attributes',
  'businessContext.serviceItems': 'Service items',
};

const SECTION_ORDER: ReadonlyArray<SyncV2SectionKey> = [
  'profile',
  'operatingHours',
  'servicePeriods',
  'businessContext.categories',
  'businessContext.serviceAreas',
  'businessContext.attributes',
  'businessContext.serviceItems',
];

function diffKey(item: { sectionKey: SyncV2SectionKey; fieldKey: string }): string {
  return `${item.sectionKey}::${item.fieldKey}`;
}

function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function formatSnapshotTime(value: string | null | undefined): string {
  if (!value) return 'Snapshot time unavailable';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function directionLabel(direction: SyncV2DirectionIntent): string {
  return direction === 'import_to_nabatable' ? 'Import to Nabatable' : 'Export to Google';
}

function goToDraft(draftId: string): void {
  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.set('v2DraftId', draftId);
  window.location.assign(nextUrl.toString());
}

function refreshButtonLabel(status: string | undefined): string {
  if (status === 'open') return 'Refresh snapshots';
  if (status === 'published') return 'Published';
  if (status === 'failed') return 'Needs refresh';
  return 'Draft locked';
}

export function SyncV2Shell({ restaurantId, draftId }: SyncV2ShellProps) {
  const {
    draft,
    decisions,
    isLoading,
    error,
    refresh,
    createDraft,
    upsertDecisions,
    preflight,
    publish,
    state,
  } = useOpsGoogleBusinessProfileV2({ restaurantId, draftId });

  const [direction, setDirection] = useState<SyncV2DirectionIntent>('import_to_nabatable');
  const [pendingDecisions, setPendingDecisions] = useState<Record<string, SyncV2DecisionAction>>(
    {},
  );
  const [preflightResult, setPreflightResult] = useState<SyncV2PreflightResult | null>(null);
  const [publishJob, setPublishJob] = useState<SyncV2PublishJob | null>(null);
  const [preflightErrors, setPreflightErrors] = useState<SyncV2PreflightResult['errors']>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const canRefreshSnapshots = draft?.status === 'open';
  const canRunPreflight = draft?.status === 'open' || draft?.status === 'preflight_locked';

  // Effective decisions are persisted decisions overlaid with pending edits.
  const effectiveDecisions = useMemo(() => {
    const map: Record<string, SyncV2DecisionAction> = {};
    for (const d of decisions) map[diffKey(d)] = d.action;
    for (const [k, v] of Object.entries(pendingDecisions)) map[k] = v;
    return map;
  }, [decisions, pendingDecisions]);

  const diffItems = useMemo(
    () => (draft?.diffItems ?? []) as ReadonlyArray<SyncV2DiffItem>,
    [draft?.diffItems],
  );
  const itemsBySection = useMemo(() => {
    const grouped: Partial<Record<SyncV2SectionKey, SyncV2DiffItem[]>> = {};
    for (const item of diffItems) {
      const list = grouped[item.sectionKey] ?? [];
      list.push(item);
      grouped[item.sectionKey] = list;
    }
    for (const list of Object.values(grouped)) {
      list?.sort((a, b) => a.sortOrder - b.sortOrder || a.fieldKey.localeCompare(b.fieldKey));
    }
    return grouped;
  }, [diffItems]);
  const sectionEntries = useMemo(
    () =>
      SECTION_ORDER.map((sectionKey) => ({
        sectionKey,
        items: itemsBySection[sectionKey] ?? [],
      })).filter((entry) => entry.items.length > 0),
    [itemsBySection],
  );
  const defaultOpenSection = sectionEntries[0]?.sectionKey ?? 'profile';
  const progress = useMemo(() => {
    let importCount = 0;
    let exportCount = 0;
    let ignoredCount = 0;
    let unresolvedCount = 0;
    let blockedCount = 0;

    for (const item of diffItems) {
      const action = effectiveDecisions[diffKey(item)];
      if (action === 'import_from_google') importCount += 1;
      else if (action === 'export_to_google') exportCount += 1;
      else if (action === 'ignore') ignoredCount += 1;
      else unresolvedCount += 1;

      if ((item.capabilities.blockedReasons?.length ?? 0) > 0) blockedCount += 1;
    }

    return {
      blockedCount,
      exportCount,
      ignoredCount,
      importCount,
      resolvedCount: diffItems.length - unresolvedCount,
      totalCount: diffItems.length,
      unresolvedCount,
    };
  }, [diffItems, effectiveDecisions]);

  const handleAction = (item: SyncV2DiffItem, action: SyncV2DecisionAction) => {
    setPendingDecisions((prev) => ({ ...prev, [diffKey(item)]: action }));
  };

  const dirty = Object.keys(pendingDecisions).length > 0;

  const onSaveDecisions = async () => {
    if (!dirty) return;
    const inputs: SyncV2DecisionInput[] = Object.entries(pendingDecisions)
      .map(([key, action]) => {
        const item = diffItems.find((i) => diffKey(i) === key);
        if (!item) return null;
        return {
          sectionKey: item.sectionKey,
          fieldKey: item.fieldKey,
          action,
          nabatableValueHash: item.nabatableValueHash,
          googleValueHash: item.googleValueHash,
        } satisfies SyncV2DecisionInput;
      })
      .filter((x): x is SyncV2DecisionInput => x !== null);
    try {
      await upsertDecisions(inputs);
      setPendingDecisions({});
      toast.success('Decisions saved.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save decisions.');
    }
  };

  const onCreateDraft = async (options: { readonly refresh?: boolean } = {}) => {
    try {
      const res = await createDraft(options);
      toast.success(options.refresh ? 'Snapshots refreshed.' : 'V2 draft created.');
      const newId = res.draft.id;
      goToDraft(newId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to prepare draft.');
    }
  };

  const onPreflight = async () => {
    if (dirty) {
      toast.info('Save your decisions before running preflight.');
      return;
    }
    try {
      const res = await preflight(direction);
      if (res.ok) {
        setPreflightResult(res.preflight);
        setPublishJob(res.publishJob);
        setPreflightErrors([]);
        setDialogOpen(true);
      } else {
        setPreflightResult(null);
        setPublishJob(null);
        setPreflightErrors(res.errors);
        setDialogOpen(true);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Preflight failed.');
    }
  };

  const onConfirmPublish = async (publishJobId: string, confirmPassword: string) => {
    try {
      const res = await publish({ publishJobId, confirmPassword });
      if (res.errors.length > 0) {
        toast.error(`Publish failed: ${res.errors[0]?.message ?? 'unknown error'}`);
      } else {
        toast.success('Publish complete.');
        setDialogOpen(false);
        await refresh();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Publish failed.');
    }
  };

  if (!draftId) {
    return (
      <Card className="overflow-hidden">
        <CardHeader className="gap-2">
          <div className="flex items-center gap-2">
            <Badge variant="outline">Sync V2</Badge>
            <Badge variant="secondary">Draft required</Badge>
          </div>
          <CardTitle>Review Google Business Profile differences</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            Create a comparison draft to review Nabatable and Google values before publishing any
            changes.
          </p>
          <Button onClick={() => onCreateDraft()} disabled={state.isCreatingDraft}>
            <RefreshCw
              data-icon="inline-start"
              className={state.isCreatingDraft ? 'animate-spin' : undefined}
            />
            {state.isCreatingDraft ? 'Creating draft' : 'Create review draft'}
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex flex-col gap-4 p-6" aria-busy="true" role="status">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-7 w-64" />
            <Skeleton className="h-4 w-80 max-w-full" />
          </div>
          <div className="grid gap-3 sm:grid-cols-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Failed to load V2 draft</AlertTitle>
        <AlertDescription>{(error as Error).message}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-4 pb-44 sm:pb-28">
      <Card className="overflow-hidden">
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge variant="outline">Google Business Profile</Badge>
                <Badge variant={dirty ? 'secondary' : 'outline'}>
                  {dirty
                    ? pluralize(Object.keys(pendingDecisions).length, 'unsaved change')
                    : 'Saved'}
                </Badge>
              </div>
              <CardTitle className="text-2xl tracking-tight">
                Review profile sync decisions
              </CardTitle>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                Compare the latest snapshots, choose what should be imported, exported, or left
                unchanged, then run the final check before publishing.
              </p>
            </div>
            <div className="rounded-lg bg-muted/40 px-3 py-2 text-sm text-muted-foreground ring-1 ring-border/70">
              <span className="block">Snapshot fetched</span>
              <span className="block font-medium text-foreground">
                {formatSnapshotTime(draft?.fetchedAt)}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-2 h-8 px-2"
                onClick={() => onCreateDraft({ refresh: true })}
                disabled={
                  dirty ||
                  !canRefreshSnapshots ||
                  state.isCreatingDraft ||
                  state.isPreflighting ||
                  state.isPublishing
                }
              >
                <RefreshCw
                  data-icon="inline-start"
                  className={state.isCreatingDraft ? 'animate-spin' : undefined}
                />
                {refreshButtonLabel(draft?.status)}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {[
              {
                label: 'Resolved',
                value: progress.resolvedCount,
                helper: `of ${progress.totalCount}`,
              },
              { label: 'Imports', value: progress.importCount, helper: 'Google to Nabatable' },
              { label: 'Exports', value: progress.exportCount, helper: 'Nabatable to Google' },
              { label: 'Ignored', value: progress.ignoredCount, helper: 'No publish action' },
              { label: 'Unresolved', value: progress.unresolvedCount, helper: 'Need a decision' },
            ].map((metric) => (
              <div
                key={metric.label}
                className="rounded-lg bg-background p-3 ring-1 ring-border/70"
              >
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  {metric.label}
                </p>
                <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">
                  {metric.value}
                </p>
                <p className="text-xs text-muted-foreground">{metric.helper}</p>
              </div>
            ))}
          </div>

          {progress.blockedCount > 0 ? (
            <Alert>
              <AlertCircle className="size-4" />
              <AlertTitle>
                {pluralize(progress.blockedCount, 'field')} need manual attention
              </AlertTitle>
              <AlertDescription>
                These rows can still be ignored, but one or more sync directions are unavailable.
              </AlertDescription>
            </Alert>
          ) : null}

          <Separator />

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Publish direction</p>
              <p className="text-sm text-muted-foreground">
                This sets the final preflight path. Individual row decisions still determine which
                fields are included.
              </p>
            </div>
            <Tabs value={direction} onValueChange={(v) => setDirection(v as SyncV2DirectionIntent)}>
              <TabsList className="grid w-full grid-cols-2 lg:w-auto">
                <TabsTrigger value="import_to_nabatable">Import</TabsTrigger>
                <TabsTrigger value="export_to_google">Export</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardContent>
      </Card>

      {diffItems.length === 0 ? (
        <Alert>
          <CheckCircle2 className="size-4" />
          <AlertTitle>No changes</AlertTitle>
          <AlertDescription>
            Nabatable and Google currently agree on every reviewed field.
          </AlertDescription>
        </Alert>
      ) : (
        <Accordion
          type="single"
          collapsible
          defaultValue={defaultOpenSection}
          className="rounded-lg border bg-card"
        >
          {sectionEntries.map(({ sectionKey, items }) => {
            const resolvedInSection = items.filter(
              (item) => effectiveDecisions[diffKey(item)],
            ).length;
            return (
              <AccordionItem key={sectionKey} value={sectionKey} className="border-border">
                <AccordionTrigger className="px-4 py-4 hover:bg-muted/50 sm:px-5">
                  <div className="flex min-w-0 flex-col gap-2 text-left sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <span className="block text-base font-semibold text-foreground">
                        {SECTION_LABELS[sectionKey]}
                      </span>
                      <span className="block text-sm font-normal text-muted-foreground">
                        {pluralize(resolvedInSection, 'decision')} set across{' '}
                        {pluralize(items.length, 'field')}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={resolvedInSection === items.length ? 'secondary' : 'outline'}>
                        {resolvedInSection}/{items.length} resolved
                      </Badge>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4 sm:px-5">
                  <div className="flex flex-col gap-3">
                    {items.map((item) => {
                      const action = effectiveDecisions[diffKey(item)] ?? null;
                      return (
                        <V2FieldDecisionRow
                          key={diffKey(item)}
                          diffItem={item}
                          currentAction={action}
                          disabled={
                            state.isUpsertingDecisions || state.isPreflighting || state.isPublishing
                          }
                          onChange={(nextAction) => handleAction(item, nextAction)}
                        />
                      );
                    })}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}

      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 px-4 py-3 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 rounded-lg bg-background/95 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">
              {dirty
                ? `${pluralize(Object.keys(pendingDecisions).length, 'decision')} not saved`
                : `${pluralize(progress.resolvedCount, 'decision')} saved`}
            </p>
            <p className="text-xs text-muted-foreground">
              {dirty
                ? 'Save decisions before running preflight.'
                : !canRunPreflight
                  ? draft?.status === 'published'
                    ? 'This draft has already been published.'
                    : 'Refresh snapshots to review the latest values.'
                  : `Ready to run ${directionLabel(direction).toLowerCase()} preflight when all required decisions are set.`}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="ghost"
              onClick={() => setPendingDecisions({})}
              disabled={!dirty || state.isUpsertingDecisions}
            >
              <RotateCcw data-icon="inline-start" />
              Discard
            </Button>
            <Button onClick={onSaveDecisions} disabled={!dirty || state.isUpsertingDecisions}>
              <Save data-icon="inline-start" />
              {state.isUpsertingDecisions ? 'Saving' : 'Save decisions'}
            </Button>
            <Button
              onClick={onPreflight}
              disabled={
                dirty || !canRunPreflight || state.isPreflighting || progress.totalCount === 0
              }
              className={cn(progress.unresolvedCount > 0 && !dirty && 'opacity-90')}
            >
              <Send data-icon="inline-start" />
              {state.isPreflighting ? 'Checking' : 'Run preflight'}
            </Button>
          </div>
        </div>
      </div>

      <V2PreflightDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        preflight={preflightResult}
        publishJob={publishJob}
        preflightErrors={preflightErrors}
        isPublishing={state.isPublishing}
        onConfirm={onConfirmPublish}
      />
    </div>
  );
}
