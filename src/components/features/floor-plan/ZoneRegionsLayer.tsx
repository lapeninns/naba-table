'use client';

import type { ProjectedZone } from './domain/project';

export type ZoneRegionsLayerProps = {
  zones: ProjectedZone[];
};

/** Dashed bounding regions behind the tables, one per zone, with a label. */
export function ZoneRegionsLayer({ zones }: ZoneRegionsLayerProps) {
  return (
    <>
      {zones.map((zone) => (
        <div
          key={zone.key}
          aria-hidden
          className="pointer-events-none absolute box-border rounded-lg border border-dashed border-border/60 bg-muted/20"
          style={{ left: zone.left, top: zone.top, width: zone.width, height: zone.height }}
        >
          <span className="absolute left-3 top-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {zone.name} · {zone.count}
          </span>
        </div>
      ))}
    </>
  );
}
