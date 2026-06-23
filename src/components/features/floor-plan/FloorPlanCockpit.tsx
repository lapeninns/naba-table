'use client';

import { useId } from 'react';

import { OPS_CARD_CLASS } from '@/components/features/ops-shell/patterns/opsDensityClasses';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

import type { FloorPlanStats } from './useFloorPlanState';

export type FloorPlanCockpitProps = {
  stats: FloorPlanStats;
};

/** Service-summary metric tiles, built from the ops Card primitive. */
export function FloorPlanCockpit({ stats }: FloorPlanCockpitProps) {
  const baseId = useId();
  const tiles = [
    {
      label: 'Covers seated',
      value: stats.seatedCovers,
      detail: `of ${stats.capacity} · ${stats.occupancyPct}% capacity`,
    },
    {
      label: 'Booked ahead',
      value: stats.bookedCovers,
      detail: `${stats.bookedTables} tables held`,
    },
    {
      label: 'Tables open',
      value: stats.openTables,
      detail: 'ready to seat',
    },
  ];

  return (
    // The cockpit is a named group so assistive tech reads the three metrics as one "Service
    // summary" unit; each tile is its own group labelled by its metric name, which ties the
    // number + label + detail together (the audit flagged them as loose, ungrouped StaticText).
    // Mobile redesign: a compact 3-up "dashboard strip" (not stacked full-width cards) so the
    // three metrics cost ~one short row instead of ~285px — the floor map then sits near the top
    // of the phone instead of below the fold. From sm+ the tiles relax into roomier cards and the
    // detail line appears; on mobile the detail stays in the a11y tree (sr-only) so screen-reader
    // users still get "of 46 · 61% capacity" while sighted users get a tighter glance.
    <div role="group" aria-label="Service summary" className="grid grid-cols-3 gap-2 sm:gap-4">
      {tiles.map((tile, index) => {
        const labelId = `${baseId}-stat-${index}`;
        return (
          <Card
            key={tile.label}
            role="group"
            aria-labelledby={labelId}
            className={cn(OPS_CARD_CLASS, 'bg-muted/10')}
          >
            <div className="px-2.5 py-2.5 sm:px-5 sm:py-3">
              <div className="text-xl font-semibold tabular-nums text-foreground sm:text-2xl">
                {tile.value}
              </div>
              <div
                id={labelId}
                className="mt-0.5 text-xs font-medium leading-tight text-foreground sm:mt-1 sm:text-sm"
              >
                {tile.label}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground sr-only sm:not-sr-only">
                {tile.detail}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
