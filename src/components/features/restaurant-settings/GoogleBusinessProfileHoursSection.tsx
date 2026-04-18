import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

import {
  formatGoogleBusinessProfileDate,
  formatGoogleBusinessProfileDateTime,
  formatGoogleBusinessProfileDay,
  formatGoogleBusinessProfileTime,
  getGoogleBusinessProfileConnectionStatusLabel,
  getGoogleBusinessProfileConnectionStatusVariant,
  GoogleBusinessProfileVerificationBadge,
} from './GoogleBusinessProfileUiHelpers';
import { SettingsSectionHeader } from './shared';

import type {
  GoogleBusinessProfileBusinessInfo,
  GoogleBusinessProfileConnection,
} from '@/services/ops/restaurants';

function formatHoursLabel(entry: GoogleBusinessProfileBusinessInfo['hours'][number]): string {
  if (entry.hoursType === 'special') {
    const start =
      formatGoogleBusinessProfileDate(entry.startDate) ?? entry.startDate ?? 'Special date';
    const end = formatGoogleBusinessProfileDate(entry.endDate) ?? entry.endDate ?? null;
    return end && end !== start ? `${start} to ${end}` : start;
  }

  const openDay = formatGoogleBusinessProfileDay(entry.openDay) ?? 'Unknown day';
  const closeDay = formatGoogleBusinessProfileDay(entry.closeDay);
  if (closeDay && closeDay !== openDay) {
    return `${openDay} to ${closeDay}`;
  }
  return openDay;
}

function ClosedBadge({ isClosed }: { isClosed: boolean }) {
  return <Badge variant={isClosed ? 'secondary' : 'outline'}>{isClosed ? 'Closed' : 'Open'}</Badge>;
}

function HoursSummary({
  weeklyCount,
  specialCount,
  moreHoursCount,
}: {
  weeklyCount: number;
  specialCount: number;
  moreHoursCount: number;
}) {
  return (
    <div className="space-y-2 rounded-lg border border-border/70 bg-muted/30 p-4">
      <p className="text-sm font-medium text-foreground">
        Google Business Profile hours are shown as a read-only snapshot in the same rhythm as core
        operating hours.
      </p>
      <p className="text-xs text-muted-foreground">
        Public hours map to the weekly schedule, dated rows behave like overrides, and labelled
        Google more-hours stay grouped separately for operator review.
      </p>
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline">
          {weeklyCount} weekly row{weeklyCount === 1 ? '' : 's'}
        </Badge>
        <Badge variant="outline">
          {specialCount} special row{specialCount === 1 ? '' : 's'}
        </Badge>
        <Badge variant="outline">
          {moreHoursCount} more-hours row{moreHoursCount === 1 ? '' : 's'}
        </Badge>
      </div>
    </div>
  );
}

function HourRowsTable({
  labelColumn,
  rows,
}: {
  labelColumn: string;
  rows: GoogleBusinessProfileBusinessInfo['hours'];
}) {
  return (
    <div className="overflow-hidden rounded-xl border">
      <Table>
        <TableHeader className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
          <TableRow>
            <TableHead className="px-4 py-3">{labelColumn}</TableHead>
            <TableHead className="px-4 py-3">Open</TableHead>
            <TableHead className="px-4 py-3">Close</TableHead>
            <TableHead className="px-4 py-3">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((entry) => (
            <TableRow key={entry.id} className={cn(entry.isClosed && 'bg-muted/30')}>
              <TableCell className="px-4 py-3">
                <div className="flex flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-foreground">{formatHoursLabel(entry)}</span>
                    <GoogleBusinessProfileVerificationBadge
                      verification={entry.verificationStatus}
                    />
                  </div>
                  {entry.periodLabel ? (
                    <span className="text-xs text-muted-foreground">{entry.periodLabel}</span>
                  ) : null}
                </div>
              </TableCell>
              <TableCell className="px-4 py-3 text-muted-foreground">
                {entry.isClosed
                  ? '—'
                  : (formatGoogleBusinessProfileTime(entry.openTime) ??
                    entry.openTime ??
                    'Not set')}
              </TableCell>
              <TableCell className="px-4 py-3 text-muted-foreground">
                {entry.isClosed
                  ? '—'
                  : (formatGoogleBusinessProfileTime(entry.closeTime) ??
                    entry.closeTime ??
                    'Not set')}
              </TableCell>
              <TableCell className="px-4 py-3">
                <ClosedBadge isClosed={entry.isClosed} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function groupMoreHoursByLabel(hours: GoogleBusinessProfileBusinessInfo['hours']) {
  const groups = new Map<string, GoogleBusinessProfileBusinessInfo['hours']>();

  for (const entry of hours) {
    const label = entry.periodLabel ?? 'Additional hours';
    const current = groups.get(label) ?? [];
    current.push(entry);
    groups.set(label, current);
  }

  return [...groups.entries()].map(([label, rows]) => ({ label, rows }));
}

export function GoogleBusinessProfileHoursSection({
  hours,
  syncStatus,
  lastPullAt,
  isSyncing,
}: {
  hours: GoogleBusinessProfileBusinessInfo['hours'];
  syncStatus: GoogleBusinessProfileConnection['status'];
  lastPullAt: string | null;
  isSyncing?: boolean;
}) {
  const weeklyRows = hours.filter((entry) => entry.hoursType === 'public');
  const specialRows = hours.filter((entry) => entry.hoursType === 'special');
  const moreHoursRows = hours.filter((entry) => entry.hoursType === 'service');
  const moreHoursGroups = groupMoreHoursByLabel(moreHoursRows);
  const syncTimestamp = formatGoogleBusinessProfileDateTime(lastPullAt);
  const syncLabel = isSyncing
    ? 'Syncing'
    : getGoogleBusinessProfileConnectionStatusLabel(syncStatus);

  return (
    <section className="space-y-6">
      <SettingsSectionHeader
        title="Hours from Google"
        description="See the hours Google currently has for this location, then compare that snapshot to Nabatable's operating setup below."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant={
                isSyncing
                  ? 'secondary'
                  : getGoogleBusinessProfileConnectionStatusVariant(syncStatus)
              }
              className="whitespace-nowrap"
            >
              {syncLabel}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {syncTimestamp ? `Last sync ${syncTimestamp}` : 'Not yet synced'}
            </span>
          </div>
        }
        className="pb-0"
      />

      <HoursSummary
        weeklyCount={weeklyRows.length}
        specialCount={specialRows.length}
        moreHoursCount={moreHoursRows.length}
      />

      {weeklyRows.length > 0 ? (
        <div className="space-y-3">
          <SettingsSectionHeader
            title="Weekly Schedule"
            description="Default public hours from Google Business Profile."
            className="pb-0"
          />
          <HourRowsTable labelColumn="Day" rows={weeklyRows} />
        </div>
      ) : null}

      {specialRows.length > 0 ? (
        <div className="space-y-3">
          <SettingsSectionHeader
            title="Special Overrides"
            description="Dated special-hour rows from Google Business Profile."
            className="pb-0"
          />
          <HourRowsTable labelColumn="Date" rows={specialRows} />
        </div>
      ) : null}

      {moreHoursGroups.length > 0 ? (
        <div className="space-y-4">
          <SettingsSectionHeader
            title="More Hours"
            description="Additional labelled Google windows, grouped the way operators review meal/service windows elsewhere in settings."
            className="pb-0"
          />
          {moreHoursGroups.map((group) => (
            <div key={group.label} className="space-y-3">
              <h4 className="text-sm font-semibold text-foreground">{group.label}</h4>
              <HourRowsTable labelColumn="Day" rows={group.rows} />
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
