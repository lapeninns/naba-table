'use client';

import { AlertTriangle, ArrowUpRight, CheckCircle2, Info } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { SettingsCard } from '@/components/features/restaurant-settings/shared/SettingsCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { opsHref } from '@/lib/url/opsHref';
import { cn } from '@/lib/utils';

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

type TabId = 'profile' | 'hours';

type TabMeta = {
  id: TabId;
  label: string;
  sourceId: DriftGroupSummary['id'];
};

const TAB_ORDER: TabMeta[] = [
  { id: 'profile', label: 'Profile', sourceId: 'profile' },
  { id: 'hours', label: 'Weekly availability', sourceId: 'hours' },
];

const AVAILABILITY_WORKSPACE_HREF = opsHref('/settings/restaurant/availability');

function hasWeeklyScheduleContext(
  connection: GoogleBusinessProfileConnection,
  operatingHours: OperatingHoursSnapshot | null | undefined,
) {
  const g = connection.businessInfo.coreNormalization.operatingHours.weekly.length;
  const n = operatingHours?.weekly?.length ?? 0;
  return g > 0 || n > 0;
}

const DAY_INDICES = [0, 1, 2, 3, 4, 5, 6] as const;

function countsFor(rows: DriftGroupSummary['rows']) {
  return rows.reduce(
    (acc, row) => {
      if (row.status === 'drift') acc.drift += 1;
      else if (row.status === 'partial') acc.partial += 1;
      else if (row.status === 'verified') acc.verified += 1;
      else acc.unavailable += 1;
      return acc;
    },
    { drift: 0, partial: 0, verified: 0, unavailable: 0 },
  );
}

type TabCounts = ReturnType<typeof countsFor>;

function tabTone(counts: TabCounts): 'drift' | 'partial' | 'verified' | 'muted' {
  if (counts.drift > 0) return 'drift';
  if (counts.partial > 0) return 'partial';
  if (counts.verified > 0) return 'verified';
  return 'muted';
}

function TabCountDot({ counts }: { counts: TabCounts }) {
  const tone = tabTone(counts);
  if (tone === 'muted') return null;
  const count = counts.drift + counts.partial;
  const classes = {
    drift: 'bg-amber-500',
    partial: 'bg-sky-500',
    verified: 'bg-emerald-500',
  }[tone];
  return (
    <span
      className={cn(
        'ml-1.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full px-1 text-[10px] font-semibold text-white',
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

type GoogleServicePeriod =
  GoogleBusinessProfileConnection['businessInfo']['coreNormalization']['servicePeriods']['periods'][number];

const STATUS_RANK: Record<DriftRowStatus, number> = {
  drift: 3,
  partial: 2,
  unavailable: 1,
  verified: 0,
};

function worstDriftStatus(a: DriftRowStatus, b: DriftRowStatus): DriftRowStatus {
  return STATUS_RANK[a] >= STATUS_RANK[b] ? a : b;
}

function mealDriftStatus(google: GoogleServicePeriod | null): DriftRowStatus {
  if (!google) return 'unavailable';
  if (google.matchesCore === null) return 'unavailable';
  return google.matchesCore ? 'verified' : 'drift';
}

function servicePeriodsDayCounts(periods: GoogleServicePeriod[]): TabCounts {
  return DAY_INDICES.reduce(
    (acc, dayOfWeek) => {
      const gLunch =
        periods.find((p) => p.bookingOption === 'lunch' && p.dayOfWeek === dayOfWeek) ?? null;
      const gDinner =
        periods.find((p) => p.bookingOption === 'dinner' && p.dayOfWeek === dayOfWeek) ?? null;
      const dayStatus = worstDriftStatus(mealDriftStatus(gLunch), mealDriftStatus(gDinner));
      if (dayStatus === 'drift') acc.drift += 1;
      else if (dayStatus === 'partial') acc.partial += 1;
      else if (dayStatus === 'verified') acc.verified += 1;
      else acc.unavailable += 1;
      return acc;
    },
    { drift: 0, partial: 0, verified: 0, unavailable: 0 },
  );
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
      <div className="rounded-lg border border-dashed border-border/60 bg-muted/20 px-4 py-6 text-center text-xs text-muted-foreground">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border/60">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border/70">
          <thead className="bg-muted/50 text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th scope="col" className="px-3 py-1.5 text-left font-medium">
                Item
              </th>
              <th scope="col" className="px-3 py-1.5 text-left font-medium">
                Google
              </th>
              <th scope="col" className="px-3 py-1.5 text-left font-medium">
                Nabatable
              </th>
              <th scope="col" className="w-px px-3 py-1.5 text-right font-medium">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60 text-sm">
            {rows.map((row) => {
              const needsAttention = row.status === 'drift' || row.status === 'partial';
              return (
                <tr
                  key={row.id}
                  className={cn(needsAttention ? 'bg-amber-50/40' : 'bg-background')}
                >
                  <th
                    scope="row"
                    className="whitespace-nowrap px-3 py-2 text-left align-middle text-sm font-medium text-foreground"
                  >
                    {row.label}
                  </th>
                  <td className="px-3 py-2 align-middle text-sm text-foreground/80">
                    <span className="block max-w-[28ch] truncate" title={row.googleValue}>
                      {row.googleValue}
                    </span>
                  </td>
                  <td className="px-3 py-2 align-middle text-sm font-medium text-foreground">
                    <span className="block max-w-[28ch] truncate" title={row.nabatableValue}>
                      {row.nabatableValue}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 align-middle text-right">
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
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
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
    return TAB_ORDER.map((meta) => {
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
    return DAY_INDICES.map((dayOfWeek) => {
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

  const [activeTab, setActiveTab] = useState<TabId>(() => {
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
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-amber-200 bg-amber-50 text-amber-800',
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
        <div className="rounded-lg border border-dashed border-border/60 bg-muted/20 p-6 text-center">
          <p className="text-sm font-medium text-foreground">
            Google has not exposed comparable values yet.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Run a sync to refresh the snapshot, then come back here to review alignment.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabId)}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <TabsList className="h-auto flex-wrap gap-1 p-1">
                {tabsWithData.map(({ meta, rows, counts, disabled }) => {
                  const countLabel =
                    meta.id === 'hours' ? DAY_INDICES.length + overrideRows.length : rows.length;
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
