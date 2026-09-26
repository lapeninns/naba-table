'use client';

import Link from 'next/link';

import {
  AVAILABILITY_ANCHORS,
  availabilityHash,
} from '@/components/features/restaurant-settings/availabilityAnchors';
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

const LINK_CLASS = 'font-medium text-primary underline underline-offset-2';

export function OverviewHeading({ children }: { children: string }) {
  return <h3 className="text-xs font-semibold text-muted-foreground">{children}</h3>;
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
        className="grid h-[70px] grid-cols-[repeat(12,minmax(0,1fr))] items-end gap-1"
      >
        {coverage.sizes.map((size) => (
          <span key={size.size} className="grid h-full content-end justify-items-center gap-[3px]">
            <span className="text-[11px] font-semibold leading-none tabular-nums">
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
                'w-full max-w-5 rounded-t-[3px]',
                size.count > 0
                  ? 'bg-foreground'
                  : size.joinOnly
                    ? cn('rounded-none', JOIN_BAR_CLASS)
                    : 'rounded-none border-t-2 border-dashed border-muted-foreground bg-transparent',
              )}
              style={{
                height: `${size.count > 0 ? 5 + (size.count / peak) * 32 : size.joinOnly ? 14 : 3}px`,
              }}
            />
            <span className="whitespace-nowrap text-[11px] leading-none text-muted-foreground tabular-nums">
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
          <LegendSwatch kind="no" />
          Only by joining tables
        </span>
      </div>
      <p className="text-xs leading-[1.45]">
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
            <Link href={BOOKING_RULES_HREF} className={LINK_CLASS}>
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
    <p className="border-t border-border pt-2.5 text-xs leading-[1.45]">
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
      <Link href={MEAL_TIMES_HREF} className={LINK_CLASS}>
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

/** Capacity card above the room on narrow screens; wide screens show it in the side panel. */
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
    <section
      aria-labelledby="tables-capacity-heading"
      data-testid="table-capacity-card"
      className="rounded-md border border-border bg-background min-[1100px]:hidden"
    >
      <h2 id="tables-capacity-heading" className="sr-only">
        Capacity
      </h2>
      {stats.totalTables === 0 ? (
        <p className="p-4 text-sm text-muted-foreground sm:px-5">
          No tables yet. Capacity appears here once you add some.
        </p>
      ) : (
        <div className="grid gap-3 p-4 sm:px-5">
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
            <span>
              <span className="text-xl font-semibold tabular-nums">{stats.bookableSeats}</span>{' '}
              <span className="text-muted-foreground">
                of {stats.totalSeats} seats bookable now
              </span>
            </span>
            <span className="text-xs text-muted-foreground">
              {countLabel(stats.bookableTables, 'table')} bookable
              {notBookable > 0 ? ` · ${notBookable} not: ${describeBlocked(blockedReasons)}` : ''}
            </span>
          </div>
          <CapacityBar
            bookable={stats.bookableSeats}
            total={stats.totalSeats}
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
  );
}
