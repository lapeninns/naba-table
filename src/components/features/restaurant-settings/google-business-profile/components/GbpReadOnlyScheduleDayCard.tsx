'use client';

import { Clock3, UtensilsCrossed } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

import { GoogleBusinessProfileComparisonBadge } from '../../GoogleBusinessProfileComparisonBadge';
import { formatGbpTime } from '../lib/formatters';

import type {
  GoogleBusinessProfileCoreNormalization,
  OperatingHoursRow,
  ServicePeriodRow,
} from '@/services/ops/restaurants';

type GoogleWeekly = GoogleBusinessProfileCoreNormalization['operatingHours']['weekly'][number];
type GooglePeriod = GoogleBusinessProfileCoreNormalization['servicePeriods']['periods'][number];

function formatTime(value: string | null | undefined): string {
  if (!value || !value.trim()) return '—';
  return formatGbpTime(value) ?? value;
}

function SectionVerificationPill({ matchesCore }: { matchesCore: boolean | null }) {
  if (matchesCore === null) {
    return (
      <Badge
        variant="outline"
        className="h-5 shrink-0 gap-1 rounded-full px-2 text-[10px] font-semibold uppercase tracking-wide border-border/60 bg-muted/40 text-muted-foreground"
      >
        No data
      </Badge>
    );
  }
  return (
    <GoogleBusinessProfileComparisonBadge
      status={matchesCore ? 'verified' : 'drifted'}
      verifiedLabel="Matches GBP"
      driftedLabel="Drifted from GBP"
    />
  );
}

function CompareCell({
  google,
  nabatable,
  drifted,
}: {
  google: string;
  nabatable: string;
  drifted: boolean;
}) {
  return (
    <div
      className={cn(
        'grid grid-cols-2 gap-x-3 gap-y-0.5 text-sm',
        drifted && 'rounded-md bg-amber-50/60 px-2 py-1',
      )}
    >
      <div>
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Google
        </p>
        <p className="font-medium text-foreground/90">{google}</p>
      </div>
      <div>
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Nabatable
        </p>
        <p className="font-semibold text-foreground">{nabatable}</p>
      </div>
    </div>
  );
}

function ReadOnlyMealCard({
  label,
  description,
  google,
  nab,
}: {
  label: string;
  description: string;
  google: GooglePeriod | null;
  nab: ServicePeriodRow | undefined;
}) {
  const gStart = google ? formatTime(google.startTime) : '—';
  const gEnd = google ? formatTime(google.endTime) : '—';
  const nStart = nab ? formatTime(nab.startTime) : '—';
  const nEnd = nab ? formatTime(nab.endTime) : '—';
  const gActive = Boolean(google && (google.startTime || google.endTime));
  const nActive = Boolean(nab && (nab.startTime || nab.endTime));
  const blockDrift =
    google?.matchesCore === false || gActive !== nActive;

  return (
    <div
      className={cn(
        'rounded-lg border border-border/60 bg-background/80 p-3',
        blockDrift && 'border-amber-200/80 bg-amber-50/30',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-foreground">{label}</p>
            {google ? (
              <SectionVerificationPill matchesCore={google.matchesCore} />
            ) : (
              <SectionVerificationPill matchesCore={null} />
            )}
          </div>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Active
          </p>
          <div className="mt-0.5 flex justify-end gap-2 text-xs tabular-nums">
            <span className={cn(!gActive && 'text-muted-foreground')}>
              G: {gActive ? 'Yes' : 'No'}
            </span>
            <span className={cn(!nActive && 'text-muted-foreground')}>
              N: {nActive ? 'Yes' : 'No'}
            </span>
          </div>
        </div>
      </div>
      <div className="mt-3 space-y-2">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Start
          </p>
          <CompareCell
            google={gStart}
            nabatable={nStart}
            drifted={
              google?.matchesCore === false ||
              Boolean(google && nab && google.startTime !== nab.startTime)
            }
          />
        </div>
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            End
          </p>
          <CompareCell
            google={gEnd}
            nabatable={nEnd}
            drifted={
              google?.matchesCore === false ||
              Boolean(google && nab && google.endTime !== nab.endTime)
            }
          />
        </div>
      </div>
    </div>
  );
}

export type GbpReadOnlyScheduleDayCardProps = {
  dayLabel: string;
  googleWeekly: GoogleWeekly | null;
  nabWeekly: OperatingHoursRow | undefined;
  googleLunch: GooglePeriod | null;
  googleDinner: GooglePeriod | null;
  nabLunch: ServicePeriodRow | undefined;
  nabDinner: ServicePeriodRow | undefined;
};

export function GbpReadOnlyScheduleDayCard({
  dayLabel,
  googleWeekly,
  nabWeekly,
  googleLunch,
  googleDinner,
  nabLunch,
  nabDinner,
}: GbpReadOnlyScheduleDayCardProps) {
  const gClosed = googleWeekly?.isClosed ?? true;
  const nabClosed = nabWeekly?.isClosed ?? gClosed;
  const bothClosed = gClosed && nabClosed;
  const dayMismatch = Boolean(
    nabWeekly && googleWeekly && nabWeekly.isClosed !== googleWeekly.isClosed,
  );
  const primaryOpen = nabWeekly ? !nabWeekly.isClosed : !gClosed;
  const openDayOn = nabWeekly ? !nabWeekly.isClosed : !gClosed;

  return (
    <div
      className={cn(
        'rounded-xl border border-border/70 bg-card/30 p-3 shadow-sm',
        !primaryOpen && 'bg-muted/15',
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-foreground">{dayLabel}</p>
            <Badge variant={primaryOpen ? 'outline' : 'secondary'} className="text-xs">
              {primaryOpen ? 'Open' : 'Closed'}
            </Badge>
            {dayMismatch ? (
              <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">
                Day mismatch
              </Badge>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            Read-only · mirrors Availability &amp; Occasions (weekly schedule tab).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Open day
          </span>
          <Badge variant={openDayOn ? 'outline' : 'secondary'} className="h-6 px-2 text-[10px]">
            {openDayOn ? 'On' : 'Off'}
          </Badge>
        </div>
      </div>

      {bothClosed ? (
        <div className="mt-3 rounded-lg border border-dashed border-border/70 bg-background/70 px-3 py-2 text-xs text-muted-foreground">
          Closed this day in both Google and Nabatable.
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <div className="rounded-lg border border-border/60 bg-background/80 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-medium text-foreground">
              <div className="flex items-center gap-2">
                <Clock3 className="size-3.5 text-muted-foreground" />
                Operating hours
              </div>
              {googleWeekly ? (
                <SectionVerificationPill matchesCore={googleWeekly.matchesCore} />
              ) : (
                <SectionVerificationPill matchesCore={null} />
              )}
            </div>
            <div className="mt-3 space-y-2">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Opens
                </p>
                <CompareCell
                  google={formatTime(googleWeekly?.opensAt ?? null)}
                  nabatable={formatTime(nabWeekly?.opensAt ?? null)}
                  drifted={
                    googleWeekly?.matchesCore === false ||
                    Boolean(
                      googleWeekly &&
                        nabWeekly &&
                        (googleWeekly.opensAt ?? '') !== (nabWeekly.opensAt ?? ''),
                    )
                  }
                />
              </div>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Closes
                </p>
                <CompareCell
                  google={formatTime(googleWeekly?.closesAt ?? null)}
                  nabatable={formatTime(nabWeekly?.closesAt ?? null)}
                  drifted={
                    googleWeekly?.matchesCore === false ||
                    Boolean(
                      googleWeekly &&
                        nabWeekly &&
                        (googleWeekly.closesAt ?? '') !== (nabWeekly.closesAt ?? ''),
                    )
                  }
                />
              </div>
            </div>
          </div>

          <div className="space-y-2 border-l-2 border-border/60 pl-3">
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-foreground">
              <UtensilsCrossed className="size-3.5 text-muted-foreground" />
              Service windows
              <span className="text-[11px] font-normal text-muted-foreground">
                (lunch &amp; dinner · verified vs GBP)
              </span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <ReadOnlyMealCard
                label="Lunch"
                description="Booked inside the operating window."
                google={googleLunch}
                nab={nabLunch}
              />
              <ReadOnlyMealCard
                label="Dinner"
                description="Booked inside the operating window."
                google={googleDinner}
                nab={nabDinner}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
