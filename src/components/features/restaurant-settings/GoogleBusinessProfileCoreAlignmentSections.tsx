'use client';

import { AlertTriangle, CalendarDays, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

import { GoogleBusinessProfilePanel } from '@/components/features/restaurant-settings/GoogleBusinessProfilePanel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { opsHref } from '@/lib/url/opsHref';
import { cn } from '@/lib/utils';

import {
  formatGoogleBusinessProfileDate,
  formatGoogleBusinessProfileDay,
  formatGoogleBusinessProfileTime,
} from './GoogleBusinessProfileUiHelpers';

import type {
  GoogleBusinessProfileBusinessInfo,
  GoogleBusinessProfileCoreMatchStatus,
} from '@/services/ops/restaurants';

type CoreAlignmentSectionsProps = {
  coreNormalization: GoogleBusinessProfileBusinessInfo['coreNormalization'] | null;
};

type ServicePeriodsByDay = Map<
  number,
  {
    lunch?: GoogleBusinessProfileBusinessInfo['coreNormalization']['servicePeriods']['periods'][number];
    dinner?: GoogleBusinessProfileBusinessInfo['coreNormalization']['servicePeriods']['periods'][number];
  }
>;

const DAYS_OF_WEEK = Array.from({ length: 7 }, (_, index) => index);

function getMatchStatusBadgeClasses(status: GoogleBusinessProfileCoreMatchStatus) {
  switch (status) {
    case 'matched':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'partial':
      return 'border-sky-200 bg-sky-50 text-sky-700';
    case 'drifted':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    default:
      return 'border-slate-200 bg-slate-50 text-slate-600';
  }
}

function getMatchStatusLabel(status: GoogleBusinessProfileCoreMatchStatus) {
  switch (status) {
    case 'matched':
      return 'Verified';
    case 'partial':
      return 'Partial';
    case 'drifted':
      return 'Drifted';
    default:
      return 'Unavailable';
  }
}

function MatchStatusBadge({ status }: { status: GoogleBusinessProfileCoreMatchStatus }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'h-6 rounded-full px-2.5 text-[10px] font-semibold uppercase tracking-[0.18em]',
        getMatchStatusBadgeClasses(status),
      )}
    >
      {getMatchStatusLabel(status)}
    </Badge>
  );
}

function AlignmentBadge({ status }: { status: 'verified' | 'drifted' | 'unavailable' }) {
  const tone =
    status === 'verified'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : status === 'drifted'
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : 'border-slate-200 bg-slate-50 text-slate-600';

  return (
    <Badge
      variant="outline"
      className={cn(
        'h-6 rounded-full px-2.5 text-[10px] font-semibold uppercase tracking-wide',
        tone,
      )}
    >
      {status === 'verified' ? 'Verified' : status === 'drifted' ? 'Drifted' : 'Unavailable'}
    </Badge>
  );
}

function formatOperatingWindow(params: {
  opensAt: string | null;
  closesAt: string | null;
  isClosed: boolean;
}) {
  if (params.isClosed) {
    return 'Closed';
  }

  const opensAt = formatGoogleBusinessProfileTime(params.opensAt) ?? params.opensAt ?? null;
  const closesAt = formatGoogleBusinessProfileTime(params.closesAt) ?? params.closesAt ?? null;

  if (!opensAt || !closesAt) {
    return 'Not available';
  }

  return `${opensAt} - ${closesAt}`;
}

function formatServiceWindow(
  period:
    | GoogleBusinessProfileBusinessInfo['coreNormalization']['servicePeriods']['periods'][number]
    | undefined,
) {
  if (!period) {
    return null;
  }

  const start = formatGoogleBusinessProfileTime(period.startTime) ?? period.startTime;
  const end = formatGoogleBusinessProfileTime(period.endTime) ?? period.endTime;
  return `${start} - ${end}`;
}

function groupServicePeriodsByDay(
  periods: GoogleBusinessProfileBusinessInfo['coreNormalization']['servicePeriods']['periods'],
): ServicePeriodsByDay {
  const grouped: ServicePeriodsByDay = new Map();

  for (const period of periods) {
    if (period.dayOfWeek === null) {
      continue;
    }

    const current = grouped.get(period.dayOfWeek) ?? {};
    current[period.bookingOption] = period;
    grouped.set(period.dayOfWeek, current);
  }

  return grouped;
}

function getOperatingHoursSourceLabel(
  source: GoogleBusinessProfileBusinessInfo['coreNormalization']['operatingHours']['source'],
) {
  switch (source) {
    case 'kitchen':
      return 'GBP kitchen more hours';
    case 'public':
      return 'GBP regular hours';
    default:
      return 'No usable GBP hours source';
  }
}

function getServicePeriodsSourceLabel(
  source: GoogleBusinessProfileBusinessInfo['coreNormalization']['servicePeriods']['source'],
) {
  return source === 'more_hours' ? 'GBP more hours' : 'No usable GBP service source';
}

function getCombinedMatchStatus(
  coreNormalization: GoogleBusinessProfileBusinessInfo['coreNormalization'],
): GoogleBusinessProfileCoreMatchStatus {
  const statuses = [
    coreNormalization.operatingHours.matchStatus,
    coreNormalization.servicePeriods.matchStatus,
  ];

  if (statuses.every((status) => status === 'matched')) {
    return 'matched';
  }

  if (statuses.some((status) => status === 'drifted')) {
    return 'drifted';
  }

  if (statuses.some((status) => status === 'partial')) {
    return 'partial';
  }

  return 'unavailable';
}

function getOverrideStatusLabel(isClosed: boolean) {
  return isClosed ? 'Closed' : 'Open';
}

function NotesBlock({ warnings }: { warnings: string[] }) {
  if (warnings.length === 0) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-amber-200/80 bg-amber-50/70 p-4">
      <p className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700">
        <AlertTriangle className="size-3.5" />
        Normalization notes
      </p>
      <ul className="space-y-2">
        {warnings.map((warning) => (
          <li key={warning} className="text-sm leading-6 text-amber-900">
            {warning}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function GoogleBusinessProfileCoreAlignmentSections({
  coreNormalization,
}: CoreAlignmentSectionsProps) {
  if (!coreNormalization) {
    return (
      <GoogleBusinessProfilePanel
        title="Availability verification"
        description="Run the first GBP sync to review Google hours, service windows, and override alignment."
      >
        <p className="text-sm text-muted-foreground">
          No normalized Google Business Profile data has been fetched yet.
        </p>
      </GoogleBusinessProfilePanel>
    );
  }

  const combinedStatus = getCombinedMatchStatus(coreNormalization);
  const groupedServicePeriods = groupServicePeriodsByDay(coreNormalization.servicePeriods.periods);
  const normalizationWarnings = [
    ...coreNormalization.operatingHours.warnings,
    ...coreNormalization.servicePeriods.warnings,
  ];

  return (
    <div className="space-y-6">
      <GoogleBusinessProfilePanel
        title="Availability verification"
        description="Read-only normalization of Google operating hours and service windows into Nabatable's availability structures."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className="hidden rounded-full px-3 py-1 text-[11px] sm:inline-flex"
            >
              Source: {getOperatingHoursSourceLabel(coreNormalization.operatingHours.source)}
            </Badge>
            <Badge
              variant="outline"
              className="hidden rounded-full px-3 py-1 text-[11px] xl:inline-flex"
            >
              Services: {getServicePeriodsSourceLabel(coreNormalization.servicePeriods.source)}
            </Badge>
            <MatchStatusBadge status={combinedStatus} />
          </div>
        }
        contentClassName="space-y-6"
      >
        <div className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-muted/20 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <ShieldCheck className="size-4 text-emerald-600" />
              Review here, edit in Nabatable
            </div>
            <p className="max-w-3xl text-sm text-muted-foreground">
              Compare Google&apos;s normalized schedule against the core availability rules that
              drive bookings, then use the canonical settings pages for edits.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" asChild>
              <Link href={opsHref('/settings/restaurant/availability#availability-hours')}>
                Edit availability
              </Link>
            </Button>
            <Button type="button" variant="outline" size="sm" asChild>
              <Link href={opsHref('/settings/restaurant/availability#service-periods')}>
                Edit service periods
              </Link>
            </Button>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border/70">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow className="hover:bg-transparent">
                <TableHead className="px-4 py-3 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  Day
                </TableHead>
                <TableHead className="px-4 py-3 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  Operating hours
                </TableHead>
                <TableHead className="px-4 py-3 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  Lunch service
                </TableHead>
                <TableHead className="px-4 py-3 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  Dinner service
                </TableHead>
                <TableHead className="px-4 py-3 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  Alignment
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {DAYS_OF_WEEK.map((dayOfWeek) => {
                const operatingRow = coreNormalization.operatingHours.weekly.find(
                  (row) => row.dayOfWeek === dayOfWeek,
                );
                const periods = groupedServicePeriods.get(dayOfWeek);
                const lunchWindow = formatServiceWindow(periods?.lunch);
                const dinnerWindow = formatServiceWindow(periods?.dinner);
                const isClosed = operatingRow?.isClosed ?? false;
                const isDrifted =
                  operatingRow?.matchesCore === false ||
                  periods?.lunch?.matchesCore === false ||
                  periods?.dinner?.matchesCore === false;
                const hasComparableData =
                  Boolean(operatingRow) || Boolean(periods?.lunch) || Boolean(periods?.dinner);
                const alignmentStatus = !hasComparableData
                  ? 'unavailable'
                  : isDrifted
                    ? 'drifted'
                    : 'verified';

                return (
                  <TableRow
                    key={dayOfWeek}
                    className={cn(isClosed && 'bg-muted/20', 'hover:bg-muted/10')}
                  >
                    <TableCell className="px-4 py-3 font-medium text-foreground">
                      {formatGoogleBusinessProfileDay(dayOfWeek) ?? 'Unknown day'}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm text-muted-foreground">
                      {operatingRow ? (
                        isClosed ? (
                          <Badge variant="outline" className="rounded-full">
                            Closed
                          </Badge>
                        ) : (
                          formatOperatingWindow(operatingRow)
                        )
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm text-muted-foreground">
                      {isClosed ? '—' : (lunchWindow ?? '—')}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm text-muted-foreground">
                      {isClosed ? '—' : (dinnerWindow ?? '—')}
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <AlignmentBadge status={alignmentStatus} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {coreNormalization.operatingHours.overrides.length > 0 ? (
          <div className="space-y-4 border-t border-border/70 pt-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <CalendarDays className="size-4 text-muted-foreground" />
                  Special date overrides
                </h4>
                <p className="text-sm text-muted-foreground">
                  Google-dated overrides normalized against Nabatable&apos;s override calendar.
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" asChild>
                <Link href={opsHref('/settings/restaurant/availability#availability-hours')}>
                  Add or edit override
                </Link>
              </Button>
            </div>

            <div className="overflow-hidden rounded-2xl border border-border/70">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="px-4 py-3 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                      Date
                    </TableHead>
                    <TableHead className="px-4 py-3 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                      GBP hours
                    </TableHead>
                    <TableHead className="px-4 py-3 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                      Status
                    </TableHead>
                    <TableHead className="px-4 py-3 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                      Match
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {coreNormalization.operatingHours.overrides.map((row) => (
                    <TableRow key={row.effectiveDate} className="hover:bg-muted/10">
                      <TableCell className="px-4 py-3 font-medium text-foreground">
                        {formatGoogleBusinessProfileDate(row.effectiveDate) ?? row.effectiveDate}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm text-muted-foreground">
                        {formatOperatingWindow(row)}
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <Badge variant="outline" className="rounded-full">
                          {getOverrideStatusLabel(row.isClosed)}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <AlignmentBadge
                          status={
                            row.matchesCore === null
                              ? 'unavailable'
                              : row.matchesCore
                                ? 'verified'
                                : 'drifted'
                          }
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        ) : null}

        <NotesBlock warnings={normalizationWarnings} />
      </GoogleBusinessProfilePanel>
    </div>
  );
}
