'use client';

import Link from 'next/link';

import {
  AVAILABILITY_ANCHORS,
  availabilityHash,
} from '@/components/features/restaurant-settings/availabilityAnchors';
import {
  SETTINGS_CARD_CLASS,
  SETTINGS_INLINE_LINK_CLASS,
} from '@/components/features/restaurant-settings/shared';
import { Card } from '@/components/ui/card';
import { opsHref } from '@/lib/url/opsHref';
import { cn } from '@/lib/utils';

import { countLabel, type ServiceCapacityLine } from './tableInventoryDisplayDomain';
import { CapacityBar, JoinIcon, JOIN_BAR_CLASS, LegendSwatch } from './TableRoomParts';

import type { PartyCoverage, SeatStats } from './tableRoomDomain';

const MEAL_TIMES_HREF = opsHref(
  `/settings/restaurant/availability${availabilityHash(AVAILABILITY_ANCHORS.serviceWindows)}`,
);
const BOOKING_RULES_HREF = opsHref(
  `/settings/restaurant/availability${availabilityHash(AVAILABILITY_ANCHORS.bookingRules)}`,
);
/** Parties above this are assumed to call rather than book online, so no policy nudge. */
const LARGE_PARTY_NUDGE_LIMIT = 30;

/** Subsection title inside a capacity card. */
export function OverviewHeading({ children }: { children: string }) {
  return <h3 className="text-sm font-medium text-foreground">{children}</h3>;
}

export function PartyCoverageBlock({ coverage }: { coverage: PartyCoverage }) {
  const peak = Math.max(1, ...coverage.sizes.map((size) => size.count));
  const label = coverage.sizes
    .map(
      (size) =>
        `parties of ${size.label}: ${
          size.count > 0
            ? countLabel(size.count, 'table')
            : size.joinOnly
              ? 'only by joining tables'
              : 'none'
        }`,
    )
    .join(', ');
  const { joinTop, largestSingle, reach, gaps } = coverage;

  return (
    <div className="grid gap-2" data-testid="party-coverage">
      <OverviewHeading>Tables by party size</OverviewHeading>
      <div
        role="img"
        aria-label={`Bookable tables for ${label}`}
        className="grid h-18 grid-cols-[repeat(12,minmax(0,1fr))] items-end gap-1"
      >
        {coverage.sizes.map((size) => (
          <span key={size.size} className="grid h-full content-end justify-items-center gap-1">
            <span className="text-xs font-semibold leading-none tabular-nums">
              {size.count > 0 ? (
                size.count
              ) : size.joinOnly ? (
                <JoinIcon className="size-2.5" />
              ) : (
                '0'
              )}
            </span>
            <span
              className={cn(
                'w-full max-w-5 rounded-t-xs',
                size.count > 0
                  ? 'bg-primary'
                  : size.joinOnly
                    ? cn('rounded-none', JOIN_BAR_CLASS)
                    : 'rounded-none border-t-2 border-dashed border-muted-foreground bg-transparent',
              )}
              style={{
                height: `${size.count > 0 ? 5 + (size.count / peak) * 32 : size.joinOnly ? 14 : 3}px`,
              }}
            />
            <span className="whitespace-nowrap text-xs leading-none text-muted-foreground tabular-nums">
              {size.label}
            </span>
          </span>
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <LegendSwatch kind="ok" />
          Single tables
        </span>
        <span className="inline-flex items-center gap-1.5">
          <LegendSwatch kind="join" />
          Only by joining tables
        </span>
      </div>
      <p className="text-xs leading-5">
        One table seats up to <b>{largestSingle}</b>.
        {joinTop && joinTop.maxParty > largestSingle ? (
          <>
            {' '}
            Joining movable tables seats up to <b>{joinTop.maxParty}</b> in {joinTop.zoneName}.
          </>
        ) : null}
        {reach < LARGE_PARTY_NUDGE_LIMIT ? (
          <>
            {' '}
            Parties over {reach} can’t book online.{' '}
            <Link href={BOOKING_RULES_HREF} className={SETTINGS_INLINE_LINK_CLASS}>
              Check your booking policy
            </Link>{' '}
            tells them to call.
          </>
        ) : null}
        {gaps.length > 0 ? (
          <>
            {' '}
            <b>No table takes parties of {gaps.join(', ')}.</b>
          </>
        ) : null}
      </p>
    </div>
  );
}

export function ServiceCapacityNote({
  lines,
  hasSummary,
}: {
  lines: ServiceCapacityLine[];
  hasSummary: boolean;
}) {
  return (
    <p className="border-t border-border/60 pt-3 text-xs leading-5">
      <span className="text-muted-foreground">Service capacity:</span>{' '}
      {lines.length > 0 ? (
        lines.map((line, index) => (
          <span key={line.key}>
            {index > 0 ? ' · ' : null}
            {line.label.toLocaleLowerCase('en-GB')} ≈ <b>{line.value}</b>
          </span>
        ))
      ) : (
        <span>
          {hasSummary
            ? 'set meal times to see covers per service'
            : 'covers per service couldn’t be worked out right now'}
        </span>
      )}
      {' · '}
      <Link href={MEAL_TIMES_HREF} className={SETTINGS_INLINE_LINK_CLASS}>
        Change meal times
      </Link>
    </p>
  );
}

function describeBlocked(reasons: Record<string, number>): string {
  return Object.entries(reasons)
    .map(([reason, count]) => `${count} ${reason.toLocaleLowerCase('en-GB')}`)
    .join(', ');
}

/**
 * Capacity summary strip above the room below the side-panel breakpoint; wider screens show the
 * same facts in the "Room at a glance" side panel.
 */
export function TableCapacityCard({
  stats,
  blockedReasons,
  coverage,
  serviceCapacityLines,
  hasSummary,
}: {
  stats: SeatStats;
  blockedReasons: Record<string, number>;
  coverage: PartyCoverage;
  serviceCapacityLines: ServiceCapacityLine[];
  hasSummary: boolean;
}) {
  const notBookable = stats.totalTables - stats.bookableTables;
  return (
    <Card
      variant="compact"
      data-testid="table-capacity-card"
      className={cn(SETTINGS_CARD_CLASS, 'xl:hidden')}
    >
      <section aria-labelledby="tables-capacity-heading" className="px-4 py-4 sm:px-5">
        <h2 id="tables-capacity-heading" className="sr-only">
          Capacity
        </h2>
        {stats.totalTables === 0 ? (
          <p className="text-sm text-muted-foreground">
            No tables yet. Capacity appears here once you add some.
          </p>
        ) : (
          <div className="grid gap-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <p className="text-sm text-muted-foreground tabular-nums">
                <span className="text-base font-semibold text-foreground">
                  {stats.bookableSeats}
                </span>{' '}
                of {stats.totalSeats} seats bookable now
              </p>
              <p className="text-xs text-muted-foreground tabular-nums">
                {countLabel(stats.bookableTables, 'table')} bookable
                {notBookable > 0 ? ` · ${notBookable} not: ${describeBlocked(blockedReasons)}` : ''}
              </p>
            </div>
            <CapacityBar
              bookable={stats.bookableSeats}
              total={stats.totalSeats}
              className="h-1.5"
              label={`${stats.bookableSeats} of ${stats.totalSeats} seats bookable`}
            />
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <LegendSwatch kind="ok" />
                Bookable seats
              </span>
              <span className="inline-flex items-center gap-1.5">
                <LegendSwatch kind="no" />
                Seats not bookable
              </span>
            </div>
            <PartyCoverageBlock coverage={coverage} />
            <ServiceCapacityNote lines={serviceCapacityLines} hasSummary={hasSummary} />
          </div>
        )}
      </section>
    </Card>
  );
}
