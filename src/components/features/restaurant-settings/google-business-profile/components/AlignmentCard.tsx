'use client';

import { AlertTriangle, ArrowUpRight, CheckCircle2, Info } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { OpsEmptyState } from '@/components/features/ops-shell/patterns/OpsEmptyState';
import { SettingsCard } from '@/components/features/restaurant-settings/shared/SettingsCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

import {
  ALIGNMENT_TAB_ORDER,
  AVAILABILITY_WORKSPACE_HREF,
  GBP_ALIGNMENT_DAY_INDICES,
  countsFor,
  hasWeeklyScheduleContext,
  servicePeriodsDayCounts,
  tabTone,
  type AlignmentCounts,
  type AlignmentTabId,
} from './alignmentModel';
import { GbpReadOnlyScheduleDayCard } from './GbpReadOnlyScheduleDayCard';
import { GoogleBusinessProfileComparisonBadge } from '../../GoogleBusinessProfileComparisonBadge';
import { formatGbpDay } from '../lib/formatters';

import type { DriftGroupSummary, DriftReport, DriftRowStatus } from '../lib/drift';
import type {
  GoogleBusinessProfileConnection,
  OperatingHoursSnapshot,
  ServicePeriodRow,
} from '@/services/ops/restaurants';

type AlignmentCardProps = {
  report: DriftReport;
  connection: GoogleBusinessProfileConnection;
  operatingHours: OperatingHoursSnapshot | null | undefined;
  servicePeriods: ServicePeriodRow[] | null | undefined;
  isScheduleDataLoading: boolean;
};

function TabCountDot({ counts }: { counts: AlignmentCounts }) {
  const tone = tabTone(counts);
  if (tone === 'muted') return null;
  const count = counts.drift + counts.partial;
  const classes = {
    drift: 'bg-primary/10',
    partial: 'bg-primary',
    verified: 'bg-primary/10',
  }[tone];
  return (
    <span
      className={cn(
        'ml-1.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full px-1 text-[10px] font-semibold text-primary-foreground',
        classes,
      )}
      aria-hidden
    >
      {tone === 'verified' ? '✓' : count}
    </span>
  );
}

function ComparisonPill({ status }: { status: DriftRowStatus }) {
  if (status === 'unavailable') {
    return (
      <Badge
        variant="outline"
        className="h-5 gap-1 rounded-full px-2 text-[10px] font-semibold uppercase tracking-wide border-border/60 bg-muted/40 text-muted-foreground"
      >
        No data
      </Badge>
    );
  }
  const mapped = status === 'verified' ? 'verified' : status === 'drift' ? 'drifted' : 'partial';
  return <GoogleBusinessProfileComparisonBadge status={mapped} />;
}

function CompactDriftTable({
  rows,
  emptyLabel,
}: {
  rows: DriftGroupSummary['rows'];
  emptyLabel: string;
}) {
  if (rows.length === 0) {
    return (
      <OpsEmptyState
        title={emptyLabel}
        className="min-h-[120px] rounded-lg bg-muted/20 px-4 py-6 text-xs"
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border/60">
      <Table>
        <TableHeader className="bg-muted/50 text-[11px] uppercase tracking-wide text-muted-foreground">
          <TableRow>
            <TableHead className="h-auto px-3 py-1.5 text-left font-medium">Item</TableHead>
            <TableHead className="h-auto px-3 py-1.5 text-left font-medium">Google</TableHead>
            <TableHead className="h-auto px-3 py-1.5 text-left font-medium">Nabatable</TableHead>
            <TableHead className="h-auto w-px px-3 py-1.5 text-right font-medium">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="divide-y divide-border/60 text-sm">
          {rows.map((row) => {
            const needsAttention = row.status === 'drift' || row.status === 'partial';
            return (
              <TableRow
                key={row.id}
                className={cn(needsAttention ? 'bg-primary/10' : 'bg-background')}
              >
                <TableHead
                  scope="row"
                  className="h-auto whitespace-nowrap px-3 py-2 text-left align-middle text-sm font-medium text-foreground"
                >
                  {row.label}
                </TableHead>
                <TableCell className="px-3 py-2 align-middle text-sm text-foreground/80">
                  <span className="block max-w-[28ch] truncate" title={row.googleValue}>
                    {row.googleValue}
                  </span>
                </TableCell>
                <TableCell className="px-3 py-2 align-middle text-sm font-medium text-foreground">
                  <span className="block max-w-[28ch] truncate" title={row.nabatableValue}>
                    {row.nabatableValue}
                  </span>
                </TableCell>
                <TableCell className="whitespace-nowrap px-3 py-2 align-middle text-right">
                  <div className="inline-flex items-center gap-1">
                    <ComparisonPill status={row.status} />
                    {row.editHref && needsAttention ? (
                      <Button
                        asChild
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                        aria-label={`Edit ${row.label} in Nabatable`}
                      >
                        <Link href={row.editHref}>
                          <ArrowUpRight className="size-3.5" aria-hidden />
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

export function AlignmentCard({
  report,
  connection,
  operatingHours,
  servicePeriods,
  isScheduleDataLoading,
}: AlignmentCardProps) {
  const { totals, groups, warnings, hasAnyData } = report;
  const needsReview = totals.drift + totals.partial;
  const totalTracked = totals.drift + totals.partial + totals.verified;

  const weeklyContext = hasWeeklyScheduleContext(connection, operatingHours);

  const hoursGroupRows = useMemo(() => groups.find((g) => g.id === 'hours')?.rows ?? [], [groups]);
  const overrideRows = useMemo(
    () => groups.find((g) => g.id === 'overrides')?.rows ?? [],
    [groups],
  );

  const serviceDayCounts = useMemo(
    () => servicePeriodsDayCounts(connection.businessInfo.coreNormalization.servicePeriods.periods),
    [connection.businessInfo.coreNormalization.servicePeriods.periods],
  );

  const availabilityCombinedCounts = useMemo(() => {
    const h = countsFor(hoursGroupRows);
    const o = countsFor(overrideRows);
    const s = serviceDayCounts;
    return {
      drift: h.drift + o.drift + s.drift,
      partial: h.partial + o.partial + s.partial,
      verified: h.verified + o.verified + s.verified,
      unavailable: h.unavailable + o.unavailable + s.unavailable,
    };
  }, [hoursGroupRows, overrideRows, serviceDayCounts]);

  const hasServicePeriodsData = useMemo(
    () =>
      connection.businessInfo.coreNormalization.servicePeriods.periods.length > 0 ||
      (servicePeriods?.length ?? 0) > 0,
    [connection.businessInfo.coreNormalization.servicePeriods.periods, servicePeriods],
  );

  const tabsWithData = useMemo(() => {
    const bySource = new Map<DriftGroupSummary['id'], DriftGroupSummary>();
    for (const group of groups) {
      bySource.set(group.id, group);
    }
    return ALIGNMENT_TAB_ORDER.map((meta) => {
      const source = bySource.get(meta.sourceId);
      const rows = source?.rows ?? [];
      const isHoursTab = meta.id === 'hours';
      const hoursDisabled =
        !weeklyContext &&
        !isScheduleDataLoading &&
        overrideRows.length === 0 &&
        !hasServicePeriodsData;
      const disabled = isHoursTab ? hoursDisabled : rows.length === 0;
      const editHref =
        meta.id === 'profile' ? (source?.editHref ?? null) : AVAILABILITY_WORKSPACE_HREF;
      const counts = isHoursTab ? availabilityCombinedCounts : countsFor(rows);
      return {
        meta,
        rows,
        editHref,
        counts,
        disabled,
      };
    });
  }, [
    groups,
    weeklyContext,
    isScheduleDataLoading,
    availabilityCombinedCounts,
    overrideRows.length,
    hasServicePeriodsData,
  ]);

  const dayCards = useMemo(() => {
    const norm = connection.businessInfo.coreNormalization;
    return GBP_ALIGNMENT_DAY_INDICES.map((dayOfWeek) => {
      const googleWeekly =
        norm.operatingHours.weekly.find((w) => w.dayOfWeek === dayOfWeek) ?? null;
      const nabWeekly = operatingHours?.weekly.find((w) => w.dayOfWeek === dayOfWeek);
      const periods = norm.servicePeriods.periods;
      const googleLunch =
        periods.find((p) => p.bookingOption === 'lunch' && p.dayOfWeek === dayOfWeek) ?? null;
      const googleDinner =
        periods.find((p) => p.bookingOption === 'dinner' && p.dayOfWeek === dayOfWeek) ?? null;
      const nabLunch = servicePeriods?.find(
        (p) => p.bookingOption === 'lunch' && p.dayOfWeek === dayOfWeek,
      );
      const nabDinner = servicePeriods?.find(
        (p) => p.bookingOption === 'dinner' && p.dayOfWeek === dayOfWeek,
      );
      return {
        dayOfWeek,
        dayLabel: formatGbpDay(dayOfWeek) ?? `Day ${dayOfWeek}`,
        googleWeekly,
        nabWeekly,
        googleLunch,
        googleDinner,
        nabLunch,
        nabDinner,
      };
    });
  }, [connection.businessInfo.coreNormalization, operatingHours, servicePeriods]);

  const [activeTab, setActiveTab] = useState<AlignmentTabId>(() => {
    const attention = tabsWithData.find((t) => t.counts.drift > 0 || t.counts.partial > 0);
    if (attention && !attention.disabled) return attention.meta.id;
    const firstNonEmpty = tabsWithData.find((t) => t.rows.length > 0 && !t.disabled);
    if (firstNonEmpty) return firstNonEmpty.meta.id;
    const hoursTab = tabsWithData.find((t) => t.meta.id === 'hours');
    if (hoursTab && !hoursTab.disabled) return 'hours';
    return 'profile';
  });

  const summaryTone = needsReview === 0 ? 'success' : 'attention';
  const SummaryIcon = summaryTone === 'success' ? CheckCircle2 : AlertTriangle;

  return (
    <SettingsCard
      title="Alignment"
      description="Compare the Nabatable record with the latest data cached from Google."
      headerAction={
        totalTracked > 0 ? (
          <span
            className={cn(
              'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium',
              summaryTone === 'success'
                ? 'border-primary/30 bg-primary/10 text-primary'
                : 'border-primary/30 bg-primary/10 text-primary',
            )}
          >
            <SummaryIcon className="size-3.5" aria-hidden />
            {summaryTone === 'success' ? (
              <span>
                <span className="font-semibold">{totals.verified}</span> in sync
              </span>
            ) : (
              <span>
                <span className="font-semibold">{needsReview}</span>/{totalTracked} need review
              </span>
            )}
          </span>
        ) : null
      }
    >
      {!hasAnyData ? (
        <OpsEmptyState
          title="Google has not exposed comparable values yet."
          description="Run a sync to refresh the snapshot, then come back here to review alignment."
          className="min-h-[160px] rounded-lg bg-muted/20 p-6"
        />
      ) : (
        <div className="space-y-4">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as AlignmentTabId)}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <TabsList className="h-auto flex-wrap gap-1 p-1">
                {tabsWithData.map(({ meta, rows, counts, disabled }) => {
                  const countLabel =
                    meta.id === 'hours'
                      ? GBP_ALIGNMENT_DAY_INDICES.length + overrideRows.length
                      : rows.length;
                  return (
                    <TabsTrigger
                      key={meta.id}
                      value={meta.id}
                      className="gap-1.5 px-3 py-1 text-xs"
                      disabled={disabled}
                    >
                      <span>{meta.label}</span>
                      <span className="text-muted-foreground">({countLabel})</span>
                      <TabCountDot counts={counts} />
                    </TabsTrigger>
                  );
                })}
              </TabsList>

              {(() => {
                const active = tabsWithData.find((t) => t.meta.id === activeTab);
                return active?.editHref ? (
                  <Button asChild size="sm" variant="ghost" className="h-7 gap-1 px-2 text-xs">
                    <Link href={active.editHref}>
                      Edit in Nabatable
                      <ArrowUpRight className="size-3.5" aria-hidden />
                    </Link>
                  </Button>
                ) : null;
              })()}
            </div>

            {tabsWithData.map(({ meta, rows }) => (
              <TabsContent key={meta.id} value={meta.id} className="mt-3">
                {meta.id === 'hours' ? (
                  isScheduleDataLoading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-28 w-full rounded-xl" />
                      <Skeleton className="h-28 w-full rounded-xl" />
                      <Skeleton className="h-28 w-full rounded-xl" />
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-dashed border-border/70 bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground">
                        <span className="max-w-xl">
                          Mirrors Availability &amp; Occasions: weekly hours, lunch/dinner service
                          windows with{' '}
                          <span className="font-medium text-foreground">Matches GBP</span> badges,
                          plus date overrides below when present.
                        </span>
                        <Button
                          asChild
                          variant="outline"
                          size="sm"
                          className="h-7 shrink-0 text-xs"
                        >
                          <Link href={AVAILABILITY_WORKSPACE_HREF}>
                            Open workspace
                            <ArrowUpRight className="ml-1 size-3.5" aria-hidden />
                          </Link>
                        </Button>
                      </div>
                      <div className="max-h-[min(68vh,560px)] space-y-2 overflow-y-auto pr-1">
                        {dayCards.map((day) => (
                          <GbpReadOnlyScheduleDayCard
                            key={day.dayOfWeek}
                            dayLabel={day.dayLabel}
                            googleWeekly={day.googleWeekly}
                            nabWeekly={day.nabWeekly}
                            googleLunch={day.googleLunch}
                            googleDinner={day.googleDinner}
                            nabLunch={day.nabLunch}
                            nabDinner={day.nabDinner}
                          />
                        ))}
                      </div>
                      {overrideRows.length > 0 ? (
                        <div className="space-y-2 border-t border-border/60 pt-4">
                          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                            <h3 className="text-sm font-semibold text-foreground">
                              Date overrides
                            </h3>
                            <p className="text-xs text-muted-foreground">
                              Same tab as Availability → Date overrides · Google vs Nabatable per
                              date.
                            </p>
                          </div>
                          <CompactDriftTable
                            rows={overrideRows}
                            emptyLabel="No date overrides to compare."
                          />
                        </div>
                      ) : null}
                    </div>
                  )
                ) : (
                  <CompactDriftTable
                    rows={rows}
                    emptyLabel={`No ${meta.label.toLowerCase()} data to compare yet.`}
                  />
                )}
              </TabsContent>
            ))}
          </Tabs>

          {warnings.length > 0 ? (
            <div className="flex items-start gap-2 rounded-md border border-border/60 bg-muted/30 px-3 py-2">
              <Info className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <ul className="space-y-0.5 text-xs text-muted-foreground">
                {warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </SettingsCard>
  );
}
