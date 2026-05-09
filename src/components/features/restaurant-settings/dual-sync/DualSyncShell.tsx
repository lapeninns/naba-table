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

import { AlertCircle, RefreshCw, Send, Zap } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
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
import { Skeleton } from '@/components/ui/skeleton';
import { useOpsDualSync } from '@/hooks/ops/useOpsDualSync';
import { cn } from '@/lib/utils';

import { DualSyncFieldRow } from './DualSyncFieldRow';
import { DualSyncFreshnessChip } from './DualSyncFreshnessChip';
import { DualSyncHeatmap } from './DualSyncHeatmap';
import { DualSyncOperationsPanel } from './DualSyncOperationsPanel';
import { DualSyncPublishJobsPanel } from './DualSyncPublishJobsPanel';
import { FoodMenusImportReviewPanel } from './FoodMenusImportReviewPanel';
import { summarizeFieldsToHeatmap } from './heatmap';

import type { DualSyncDecisionAction, DualSyncSectionKey } from '@/server/dual-sync';
import type { DualSyncFieldSummary } from '@/services/ops/dual-sync';

const SECTION_LABEL: Record<DualSyncSectionKey, string> = {
  profile: 'Profile',
  operatingHours: 'Operating hours',
  servicePeriods: 'Service periods',
  'businessContext.categories': 'Categories',
  'businessContext.serviceAreas': 'Service areas',
  'businessContext.attributes': 'Attributes',
  'businessContext.serviceItems': 'Service items',
  foodMenus: 'Food menus',
};

const SECTION_ORDER: ReadonlyArray<DualSyncSectionKey> = [
  'profile',
  'operatingHours',
  'servicePeriods',
  'businessContext.categories',
  'businessContext.serviceAreas',
  'businessContext.attributes',
  'businessContext.serviceItems',
  'foodMenus',
];

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

interface DecisionEntry {
  readonly action: DualSyncDecisionAction;
}

interface SectionBulkSummary {
  readonly importable: number;
  readonly exportable: number;
  readonly ignorable: number;
  readonly selected: number;
}

const isDualSyncSectionKey = (value: string): value is DualSyncSectionKey =>
  SECTION_ORDER.includes(value as DualSyncSectionKey);

function canApplyFieldAction(field: DualSyncFieldSummary, action: DualSyncDecisionAction): boolean {
  if (field.conflictPolicy === 'unsupported') return false;
  if (action === 'import_from_google') return field.capability.canImport;
  if (action === 'export_to_google') return field.capability.canExport;
  return true;
}

function getSectionBulkSummary(
  fields: ReadonlyArray<DualSyncFieldSummary>,
  decisions: Record<string, DecisionEntry>,
): SectionBulkSummary {
  return fields.reduce<SectionBulkSummary>(
    (summary, field) => ({
      importable: summary.importable + (canApplyFieldAction(field, 'import_from_google') ? 1 : 0),
      exportable: summary.exportable + (canApplyFieldAction(field, 'export_to_google') ? 1 : 0),
      ignorable: summary.ignorable + (canApplyFieldAction(field, 'ignore') ? 1 : 0),
      selected: summary.selected + (decisions[field.fieldKey] ? 1 : 0),
    }),
    { importable: 0, exportable: 0, ignorable: 0, selected: 0 },
  );
}

export function DualSyncShell({
  restaurantId,
  sections,
  className,
  singleOpenSections = false,
}: DualSyncShellProps) {
  const FOOD_MENUS_REVIEW_VALUE = '__foodMenusReview';
  const PUBLISHES_VALUE = '__publishes';
  const OPERATIONS_VALUE = '__operations';
  const [showOperations, setShowOperations] = useState(false);
  const [showPublishJobs, setShowPublishJobs] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const {
    stateQuery,
    refreshMutation,
    publishMutation,
    autoExportMutation,
    operationsQuery,
    publishJobsQuery,
    publishJobDetailQuery,
  } = useOpsDualSync({
    restaurantId,
    operationsRequest: showOperations ? { limit: 50 } : undefined,
    publishJobsRequest: showPublishJobs ? { jobLimit: 25 } : undefined,
    publishJobDetailId: showPublishJobs ? selectedJobId : null,
  });
  const [decisions, setDecisions] = useState<Record<string, DecisionEntry>>({});

  const outboundQueue = stateQuery.data?.outboundQueue ?? null;
  const autoExportable = outboundQueue?.autoExportable ?? 0;
  const totalOpen = outboundQueue?.totalOpen ?? 0;
  const lastSnapshot = stateQuery.data?.lastSnapshot ?? null;
  const lastSnapshotAt = lastSnapshot?.finishedAt ?? lastSnapshot?.startedAt ?? null;
  const overallHeatmap = useMemo(
    () => summarizeFieldsToHeatmap(stateQuery.data?.fields ?? []),
    [stateQuery.data?.fields],
  );
  const showFoodMenusReview = !sections || sections.length === 0 || sections.includes('foodMenus');
  const [openSection, setOpenSection] = useState<string | undefined>(undefined);

  const visibleFields = useMemo<ReadonlyArray<DualSyncFieldSummary>>(() => {
    const all = stateQuery.data?.fields ?? [];
    if (!sections || sections.length === 0) {
      return all.filter((field) => isDualSyncSectionKey(field.sectionKey));
    }
    const allowed = new Set<DualSyncSectionKey>(sections);
    return all.filter((field) =>
      isDualSyncSectionKey(field.sectionKey)
        ? allowed.has(field.sectionKey as DualSyncSectionKey)
        : false,
    );
  }, [stateQuery.data, sections]);

  const fieldsBySection = useMemo(() => {
    const grouped = new Map<DualSyncSectionKey, DualSyncFieldSummary[]>();
    for (const field of visibleFields) {
      if (!isDualSyncSectionKey(field.sectionKey)) continue;
      const arr = grouped.get(field.sectionKey) ?? [];
      arr.push(field);
      grouped.set(field.sectionKey, arr);
    }
    for (const arr of grouped.values()) {
      arr.sort((a, b) => a.sortOrder - b.sortOrder);
    }
    return grouped;
  }, [visibleFields]);
  const orderedSectionKeys = useMemo(
    () => SECTION_ORDER.filter((key) => fieldsBySection.has(key)),
    [fieldsBySection],
  );
  const orderedAccordionValues = useMemo(() => {
    const values = orderedSectionKeys.map((key) => key as string);
    if (showFoodMenusReview) {
      values.unshift(FOOD_MENUS_REVIEW_VALUE);
    }
    values.push(PUBLISHES_VALUE, OPERATIONS_VALUE);
    return values;
  }, [orderedSectionKeys, showFoodMenusReview]);

  // Reset decisions when the underlying state set changes.
  useEffect(() => {
    setDecisions({});
  }, [stateQuery.data?.coreSnapshotHash, stateQuery.data?.gbpSnapshotHash]);

  const decisionCount = Object.keys(decisions).length;
  const canSubmit = decisionCount > 0 && !publishMutation.isPending;

  useEffect(() => {
    if (!singleOpenSections) {
      return;
    }
    setOpenSection((current) => {
      if (current && orderedAccordionValues.includes(current)) {
        return current;
      }
      return orderedAccordionValues[0];
    });
  }, [orderedAccordionValues, singleOpenSections]);

  const onSelectAction = (fieldKey: string, next: DualSyncDecisionAction | null) => {
    setDecisions((prev) => {
      const updated = { ...prev };
      if (next === null) {
        delete updated[fieldKey];
      } else {
        updated[fieldKey] = { action: next };
      }
      return updated;
    });
  };

  const onBulkSelectSection = (
    fields: ReadonlyArray<DualSyncFieldSummary>,
    action: DualSyncDecisionAction,
  ) => {
    setDecisions((prev) => {
      const updated = { ...prev };
      for (const field of fields) {
        if (canApplyFieldAction(field, action)) {
          updated[field.fieldKey] = { action };
        }
      }
      return updated;
    });
  };

  const onClearSection = (fields: ReadonlyArray<DualSyncFieldSummary>) => {
    setDecisions((prev) => {
      const updated = { ...prev };
      for (const field of fields) {
        delete updated[field.fieldKey];
      }
      return updated;
    });
  };

  const onClickRefresh = async () => {
    try {
      await refreshMutation.mutateAsync();
      toast.success('Pulled the latest Google profile.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Refresh failed.');
    }
  };

  const onClickAutoExport = async () => {
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

  const onClickPublish = async () => {
    if (!canSubmit) return;
    const stateData = stateQuery.data;
    if (!stateData) {
      toast.error('Dual-sync state has not loaded yet.');
      return;
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
      toast.error('No valid decisions to publish.');
      return;
    }
    try {
      const result = await publishMutation.mutateAsync({
        decisions: payload,
        pinnedCoreSnapshotHash: stateData.coreSnapshotHash ?? null,
        pinnedGbpSnapshotHash: stateData.gbpSnapshotHash ?? null,
      });
      const failed = result.failedCount;
      const succeeded = result.succeededCount;
      if (failed > 0) {
        toast.error(`${succeeded} fields synced, ${failed} failed. See per-field errors below.`);
      } else {
        toast.success(`${succeeded} fields synced.`);
      }
      setDecisions({});
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
    <Card className={cn('space-y-4', className)}>
      <CardHeader className="flex flex-col gap-3 pb-2 sm:gap-4 lg:flex-row lg:items-center lg:justify-between">
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
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={onClickRefresh}
            disabled={refreshMutation.isPending}
          >
            <RefreshCw className={cn('mr-1 size-4', refreshMutation.isPending && 'animate-spin')} />
            Pull from Google
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onClickAutoExport}
            disabled={autoExportable === 0 || autoExportMutation.isPending}
            aria-disabled={autoExportable === 0 || autoExportMutation.isPending}
            title={
              autoExportable === 0
                ? 'No queued exports ready to auto-publish.'
                : `Auto-publish ${autoExportable} queued exports`
            }
          >
            <Zap className={cn('mr-1 size-4', autoExportMutation.isPending && 'animate-pulse')} />
            {autoExportMutation.isPending
              ? 'Running…'
              : `Auto-publish ${autoExportable > 0 ? `(${autoExportable})` : ''}`.trim()}
          </Button>
          <Button
            size="sm"
            onClick={onClickPublish}
            disabled={!canSubmit}
            aria-disabled={!canSubmit}
          >
            <Send className="mr-1 size-4" />
            {publishMutation.isPending
              ? 'Publishing…'
              : `Publish ${decisionCount > 0 ? `(${decisionCount})` : ''}`.trim()}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Accordion {...accordionProps} className="space-y-3">
          {showFoodMenusReview ? (
            <AccordionItem value={FOOD_MENUS_REVIEW_VALUE} className="border-b">
              <AccordionTrigger className="text-sm font-semibold">
                Review Google menu suggestions
              </AccordionTrigger>
              <AccordionContent className="pt-2">
                <FoodMenusImportReviewPanel restaurantId={restaurantId} />
              </AccordionContent>
            </AccordionItem>
          ) : null}
          {orderedSectionKeys.map((sectionKey) => {
            const fields = fieldsBySection.get(sectionKey) ?? [];
            const sectionHeatmap = summarizeFieldsToHeatmap(fields);
            const bulkSummary = getSectionBulkSummary(fields, decisions);
            return (
              <AccordionItem key={sectionKey} value={sectionKey} className="border-b">
                <AccordionTrigger className="text-sm font-semibold">
                  <div className="flex w-full flex-wrap items-center justify-between gap-2 pr-2">
                    <span>
                      {SECTION_LABEL[sectionKey]} ({fields.length})
                    </span>
                    <DualSyncHeatmap counts={sectionHeatmap} showLabels={false} />
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-2 pt-2">
                  <div className="bg-muted/30 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2">
                    <div className="space-y-0.5">
                      <p className="text-xs font-semibold uppercase tracking-wide">Bulk select</p>
                      <p className="text-muted-foreground text-xs">
                        Apply one action to all eligible fields in this section before publishing.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onBulkSelectSection(fields, 'import_from_google')}
                        disabled={publishMutation.isPending || bulkSummary.importable === 0}
                        aria-disabled={publishMutation.isPending || bulkSummary.importable === 0}
                      >
                        Import all ({bulkSummary.importable})
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onBulkSelectSection(fields, 'export_to_google')}
                        disabled={publishMutation.isPending || bulkSummary.exportable === 0}
                        aria-disabled={publishMutation.isPending || bulkSummary.exportable === 0}
                      >
                        Export all ({bulkSummary.exportable})
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onBulkSelectSection(fields, 'ignore')}
                        disabled={publishMutation.isPending || bulkSummary.ignorable === 0}
                        aria-disabled={publishMutation.isPending || bulkSummary.ignorable === 0}
                      >
                        Ignore all ({bulkSummary.ignorable})
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => onClearSection(fields)}
                        disabled={publishMutation.isPending || bulkSummary.selected === 0}
                        aria-disabled={publishMutation.isPending || bulkSummary.selected === 0}
                      >
                        Clear ({bulkSummary.selected})
                      </Button>
                    </div>
                  </div>
                  {fields.map((field) => (
                    <DualSyncFieldRow
                      key={field.fieldKey}
                      field={field}
                      selectedAction={decisions[field.fieldKey]?.action ?? null}
                      onChangeAction={(next) => onSelectAction(field.fieldKey, next)}
                      disabled={publishMutation.isPending}
                    />
                  ))}
                </AccordionContent>
              </AccordionItem>
            );
          })}
          <AccordionItem
            key={PUBLISHES_VALUE}
            value={PUBLISHES_VALUE}
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
            key={OPERATIONS_VALUE}
            value={OPERATIONS_VALUE}
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
  );
}
