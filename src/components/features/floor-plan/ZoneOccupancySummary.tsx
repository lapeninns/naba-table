'use client';

import type { ZoneRegion } from './domain/zones';

export type ZoneOccupancySummaryProps = {
  zones: ZoneRegion[];
};

/** Per-zone occupancy bars shown when no table is selected. */
export function ZoneOccupancySummary({ zones }: ZoneOccupancySummaryProps) {
  if (zones.length === 0) {
    return <p className="text-sm text-muted-foreground">No zones configured yet.</p>;
  }
  return (
    <ul className="flex flex-col gap-3">
      {zones.map((zone) => (
        // Each zone is a labelled group so the name, the X/Y covers, and the bar read as one
        // unit; the bar itself is an accessible progressbar rather than a decorative div.
        <li
          key={zone.key}
          role="group"
          aria-label={`${zone.name}: ${zone.seatedCovers} of ${zone.capacity} covers seated`}
        >
          <div className="mb-1.5 flex items-baseline justify-between gap-2">
            <span className="min-w-0 truncate text-sm font-medium text-foreground">
              {zone.name}
            </span>
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {zone.seatedCovers} / {zone.capacity}
            </span>
          </div>
          <div
            role="progressbar"
            aria-valuenow={zone.occupancyPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${zone.name} occupancy`}
            className="h-1.5 overflow-hidden rounded-full bg-muted"
          >
            <div
              aria-hidden
              className="h-full rounded-full bg-primary"
              style={{ width: `${zone.occupancyPct}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
