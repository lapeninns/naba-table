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
    <div className="flex flex-col gap-3">
      {zones.map((zone) => (
        <div key={zone.key}>
          <div className="mb-1.5 flex items-baseline justify-between">
            <span className="text-sm font-medium text-foreground">{zone.name}</span>
            <span className="font-mono text-xs tabular-nums text-muted-foreground">
              {zone.seatedCovers} / {zone.capacity}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${zone.occupancyPct}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
