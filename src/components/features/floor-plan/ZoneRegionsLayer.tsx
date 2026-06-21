'use client';

import type { ZoneRegion } from './domain/zones';

export type ZoneRegionsLayerProps = {
  zones: ZoneRegion[];
};

/** Dashed bounding regions behind the tables, one per zone, with a mono label. */
export function ZoneRegionsLayer({ zones }: ZoneRegionsLayerProps) {
  return (
    <>
      {zones.map((zone) => (
        <div
          key={zone.key}
          aria-hidden
          className="pointer-events-none absolute rounded-lg border border-dashed border-border bg-foreground/[0.02]"
          style={{
            left: `${zone.left}%`,
            top: `${zone.top}%`,
            width: `${zone.width}%`,
            height: `${zone.height}%`,
          }}
        >
          <span className="absolute left-2 top-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {zone.name} · {zone.count}
          </span>
        </div>
      ))}
    </>
  );
}
