import Link from 'next/link';

import {
  AVAILABILITY_ANCHORS,
  availabilityHash,
} from '@/components/features/restaurant-settings/availabilityAnchors';
import { Skeleton } from '@/components/ui/skeleton';
import { opsHref } from '@/lib/url/opsHref';

import {
  countLabel,
  describeNotBookableReasons,
  describeZonesInService,
  type ServiceCapacityLine,
  type TableInventoryOverview,
} from './tableInventoryDisplayDomain';
import { TABLE_TOUCH_TARGET_CLASS } from './TableInventoryParts';

import type { ReactNode } from 'react';

const MEAL_TIMES_HREF = opsHref(
  `/settings/restaurant/availability${availabilityHash(AVAILABILITY_ANCHORS.serviceWindows)}`,
);

function Metric({
  label,
  value,
  children,
}: {
  label: string;
  value: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-lg border border-border/70 bg-card p-3">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="flex min-w-0 flex-col gap-0.5">
        <span className="text-base font-semibold leading-6 text-foreground tabular-nums">
          {value}
        </span>
        {children ? (
          <span className="min-w-0 break-words text-xs leading-5 text-muted-foreground">
            {children}
          </span>
        ) : null}
      </dd>
    </div>
  );
}

export function TableInventoryMetrics({
  isLoading,
  overview,
  serviceCapacityLines,
  hasSummary,
}: {
  isLoading: boolean;
  overview: TableInventoryOverview;
  serviceCapacityLines: ServiceCapacityLine[];
  /** The server capacity summary loaded (it is missing when the API omits it). */
  hasSummary: boolean;
}) {
  if (isLoading) {
    return (
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4" aria-busy="true">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-20 w-full rounded-lg" />
        ))}
        <span className="sr-only">Loading table summary</span>
      </div>
    );
  }

  return (
    <dl
      aria-label="Tables summary"
      className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4"
      data-testid="table-inventory-metrics"
    >
      <Metric label="Bookable now" value={countLabel(overview.bookableTables, 'table')}>
        {countLabel(overview.bookableSeats, 'seat')}
      </Metric>
      <Metric label="Not bookable" value={overview.notBookableTables.toLocaleString('en-GB')}>
        {describeNotBookableReasons(overview)}
      </Metric>
      <Metric label="Zones" value={overview.zoneCount.toLocaleString('en-GB')}>
        {describeZonesInService(overview)}
      </Metric>
      <Metric
        label="Covers per service"
        value={
          serviceCapacityLines.length > 0 ? (
            <span className="flex flex-col">
              {serviceCapacityLines.map((line) => (
                <span key={line.key}>
                  {line.label}: {line.value}
                </span>
              ))}
            </span>
          ) : (
            'Not available'
          )
        }
      >
        <span className="flex flex-col gap-0.5">
          {serviceCapacityLines.length > 0 ? (
            serviceCapacityLines.map((line) => (
              <span key={line.key}>
                {line.label}: {line.description}
              </span>
            ))
          ) : (
            <span>
              {hasSummary
                ? 'Set meal times to see covers per service.'
                : 'Covers per service couldn’t be worked out right now.'}
            </span>
          )}
          <Link
            href={MEAL_TIMES_HREF}
            className={`inline-flex w-fit items-center font-medium text-primary underline underline-offset-2 ${TABLE_TOUCH_TARGET_CLASS}`}
          >
            Change meal times
          </Link>
        </span>
      </Metric>
    </dl>
  );
}
