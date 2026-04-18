'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

import { SettingsCard, SettingsSectionHeader } from './shared';

import type {
  GoogleBusinessProfileBusinessInfo,
  GoogleBusinessProfileCoreMatchStatus,
} from '@/services/ops/restaurants';

const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function formatDate(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(parsed);
}

function formatTime(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const match = value.match(/^(\d{2}):(\d{2})$/);
  if (!match) {
    return value;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) {
    return value;
  }

  const meridiem = hours >= 12 ? 'PM' : 'AM';
  const baseHour = hours % 12 || 12;
  const minuteText = String(minutes).padStart(2, '0');
  return `${baseHour}:${minuteText} ${meridiem}`;
}

function formatDay(day: number | null): string | null {
  if (day === null || day < 0 || day >= DAY_LABELS.length) {
    return null;
  }

  return DAY_LABELS[day] ?? null;
}

function countMatches(items: Array<{ matchesCore: boolean | null }>): string {
  if (items.length === 0) {
    return 'No normalized rows';
  }

  const matched = items.filter((item) => item.matchesCore === true).length;
  return `${matched}/${items.length} rows match core`;
}

function CoreMatchStatusBadge(props: { status: GoogleBusinessProfileCoreMatchStatus }) {
  const statusLabel =
    props.status === 'matched'
      ? 'Verified'
      : props.status === 'drifted'
        ? 'Drifted'
        : props.status === 'partial'
          ? 'Partial'
          : 'Unavailable';

  const statusClasses =
    props.status === 'matched'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : props.status === 'drifted'
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : props.status === 'partial'
          ? 'border-sky-200 bg-sky-50 text-sky-700'
          : 'border-slate-200 bg-slate-50 text-slate-600';

  return (
    <Badge
      variant="outline"
      className={cn(
        'h-5 rounded-full px-2 text-[10px] font-semibold uppercase tracking-wide',
        statusClasses,
      )}
    >
      {statusLabel}
    </Badge>
  );
}

function MatchBadge(props: { matchesCore: boolean | null }) {
  if (props.matchesCore === null) {
    return (
      <Badge
        variant="outline"
        className="h-5 rounded-full px-2 text-[10px] uppercase tracking-wide"
      >
        Unknown
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className={cn(
        'h-5 rounded-full px-2 text-[10px] uppercase tracking-wide',
        props.matchesCore
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : 'border-amber-200 bg-amber-50 text-amber-700',
      )}
    >
      {props.matchesCore ? 'Verified' : 'Drifted'}
    </Badge>
  );
}

function formatNormalizedHoursValue(params: {
  opensAt: string | null;
  closesAt: string | null;
  isClosed: boolean;
}): string {
  if (params.isClosed) {
    return 'Closed';
  }

  const openTime = formatTime(params.opensAt) ?? params.opensAt ?? null;
  const closeTime = formatTime(params.closesAt) ?? params.closesAt ?? null;
  if (openTime && closeTime) {
    return `${openTime} - ${closeTime}`;
  }

  return 'Not available';
}

function groupNormalizedServicePeriodsByDay(
  periods: GoogleBusinessProfileBusinessInfo['coreNormalization']['servicePeriods']['periods'],
) {
  const grouped = new Map<
    number,
    {
      lunch?: GoogleBusinessProfileBusinessInfo['coreNormalization']['servicePeriods']['periods'][number];
      dinner?: GoogleBusinessProfileBusinessInfo['coreNormalization']['servicePeriods']['periods'][number];
    }
  >();

  for (const period of periods) {
    if (period.dayOfWeek === null) {
      continue;
    }

    const existing = grouped.get(period.dayOfWeek) ?? {};
    existing[period.bookingOption] = period;
    grouped.set(period.dayOfWeek, existing);
  }

  return grouped;
}

type CoreAlignmentSectionsProps = {
  coreNormalization: GoogleBusinessProfileBusinessInfo['coreNormalization'] | null;
};

export function GoogleBusinessProfileCoreAlignmentSections({
  coreNormalization,
}: CoreAlignmentSectionsProps) {
  const normalizedServicePeriodsByDay = coreNormalization
    ? groupNormalizedServicePeriodsByDay(coreNormalization.servicePeriods.periods)
    : null;

  return (
    <>
      <SettingsCard
        title="Operating Hours"
        description="Read-only normalization of GBP hours into Nabatable's operating-hours structure."
      >
        {coreNormalization ? (
          <div className="space-y-6">
            <SettingsSectionHeader
              title="Weekly Schedule"
              description={coreNormalization.operatingHours.summary}
              action={
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="hidden sm:inline-flex">
                    Source:{' '}
                    {coreNormalization.operatingHours.source === 'kitchen'
                      ? 'GBP kitchen more hours'
                      : coreNormalization.operatingHours.source === 'public'
                        ? 'GBP regular public hours'
                        : 'No usable GBP source'}
                  </Badge>
                  <CoreMatchStatusBadge status={coreNormalization.operatingHours.matchStatus} />
                </div>
              }
            />
            <div className="overflow-hidden rounded-xl border">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-border">
                  <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 text-left">Day</th>
                      <th className="px-4 py-3 text-left">GBP hours</th>
                      <th className="px-4 py-3 text-left">Closed</th>
                      <th className="px-4 py-3 text-left">Match</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/70 text-sm">
                    {coreNormalization.operatingHours.weekly.map((row) => (
                      <tr key={row.dayOfWeek} className={cn(row.isClosed && 'bg-muted/40')}>
                        <th
                          scope="row"
                          className="px-4 py-3 whitespace-nowrap font-medium text-foreground"
                        >
                          {formatDay(row.dayOfWeek)}
                        </th>
                        <td className="px-4 py-3 text-muted-foreground">
                          {formatNormalizedHoursValue(row)}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={row.isClosed ? 'secondary' : 'outline'}>
                            {row.isClosed ? 'Closed' : 'Open'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <MatchBadge matchesCore={row.matchesCore} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {coreNormalization.operatingHours.overrides.length > 0 ? (
              <div className="space-y-3">
                <SettingsSectionHeader
                  title="Special Overrides"
                  description="One-off special-hours rows normalized from GBP dated hours."
                  className="pb-0"
                />
                <div className="overflow-hidden rounded-xl border">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-border">
                      <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                        <tr>
                          <th className="px-4 py-3 text-left">Date</th>
                          <th className="px-4 py-3 text-left">GBP hours</th>
                          <th className="px-4 py-3 text-left">Closed</th>
                          <th className="px-4 py-3 text-left">Match</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/70 text-sm">
                        {coreNormalization.operatingHours.overrides.map((row) => (
                          <tr key={row.effectiveDate} className={cn(row.isClosed && 'bg-muted/40')}>
                            <th
                              scope="row"
                              className="px-4 py-3 whitespace-nowrap font-medium text-foreground"
                            >
                              {formatDate(row.effectiveDate) ?? row.effectiveDate}
                            </th>
                            <td className="px-4 py-3 text-muted-foreground">
                              {formatNormalizedHoursValue(row)}
                            </td>
                            <td className="px-4 py-3">
                              <Badge variant={row.isClosed ? 'secondary' : 'outline'}>
                                {row.isClosed ? 'Closed' : 'Open'}
                              </Badge>
                            </td>
                            <td className="px-4 py-3">
                              <MatchBadge matchesCore={row.matchesCore} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : null}

            {coreNormalization.operatingHours.warnings.length > 0 ? (
              <div className="space-y-2 rounded-xl border border-dashed border-border/70 bg-muted/20 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Normalization notes
                </p>
                {coreNormalization.operatingHours.warnings.map((warning) => (
                  <p key={warning} className="text-sm text-muted-foreground">
                    {warning}
                  </p>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Core alignment will appear after a GBP business-information payload with normalized
            hours metadata is available.
          </p>
        )}
      </SettingsCard>

      <SettingsCard
        title="Service Periods"
        description="Read-only normalization of GBP more-hours into Nabatable lunch and dinner windows."
      >
        {coreNormalization ? (
          <div className="space-y-6">
            <SettingsSectionHeader
              title="Daily Service Windows"
              description={coreNormalization.servicePeriods.summary}
              action={
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="hidden sm:inline-flex">
                    Source:{' '}
                    {coreNormalization.servicePeriods.source === 'more_hours'
                      ? 'GBP more hours'
                      : 'No explicit GBP meal periods'}
                  </Badge>
                  <CoreMatchStatusBadge status={coreNormalization.servicePeriods.matchStatus} />
                </div>
              }
            />
            <div className="space-y-4">
              {DAY_LABELS.map((label, dayOfWeek) => {
                const dayPeriods = normalizedServicePeriodsByDay?.get(dayOfWeek) ?? {};

                return (
                  <div
                    key={dayOfWeek}
                    className="rounded-xl border border-border/70 bg-card/30 p-4 shadow-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{label}</p>
                        <p className="text-xs text-muted-foreground">
                          {dayPeriods.lunch || dayPeriods.dinner
                            ? 'Normalized from GBP more-hours rows.'
                            : 'No inferable lunch/dinner periods for this day.'}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      {(['lunch', 'dinner'] as const).map((mealKey) => {
                        const period = dayPeriods[mealKey];
                        return (
                          <div key={mealKey} className="rounded-lg border border-border/60 p-4">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="text-sm font-medium text-foreground">
                                  {mealKey === 'lunch' ? 'Lunch' : 'Dinner'}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {period
                                    ? `${formatTime(period.startTime) ?? period.startTime} - ${formatTime(period.endTime) ?? period.endTime}`
                                    : 'Not available'}
                                </p>
                              </div>
                              {period ? (
                                <MatchBadge matchesCore={period.matchesCore} />
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="h-5 rounded-full px-2 text-[10px] uppercase tracking-wide"
                                >
                                  Missing
                                </Badge>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {countMatches(coreNormalization.servicePeriods.periods)}
            </p>

            {coreNormalization.servicePeriods.warnings.length > 0 ? (
              <div className="space-y-2 rounded-xl border border-dashed border-border/70 bg-muted/20 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Normalization notes
                </p>
                {coreNormalization.servicePeriods.warnings.map((warning) => (
                  <p key={warning} className="text-sm text-muted-foreground">
                    {warning}
                  </p>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Service-period alignment will appear after GBP more-hours data is available.
          </p>
        )}
      </SettingsCard>

      <SettingsCard
        title="Booking Hours"
        description="GBP can inform the outer booking envelope, but booking-rule verification still depends on Nabatable-only settings."
      >
        {coreNormalization ? (
          <div className="space-y-6">
            <SettingsSectionHeader
              title="Coverage"
              description={coreNormalization.bookingHours.summary}
              action={<CoreMatchStatusBadge status={coreNormalization.bookingHours.matchStatus} />}
            />
            <div className="flex flex-wrap gap-2">
              {coreNormalization.bookingHours.missingInputs.map((input) => (
                <Badge
                  key={input}
                  variant="outline"
                  className="text-[10px] uppercase tracking-wide"
                >
                  {input}
                </Badge>
              ))}
            </div>
            {coreNormalization.bookingHours.warnings.length > 0 ? (
              <div className="space-y-2 rounded-xl border border-dashed border-border/70 bg-muted/20 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Verification limits
                </p>
                {coreNormalization.bookingHours.warnings.map((warning) => (
                  <p key={warning} className="text-sm text-muted-foreground">
                    {warning}
                  </p>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Booking-hours verification appears once normalized GBP hour metadata is available.
          </p>
        )}
      </SettingsCard>
    </>
  );
}
