'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { TONE_DOT } from './serviceStateStyles';

import type { ServiceState } from './domain/types';
import type { LegendEntry } from './useFloorPlanState';

export type FloorPlanLegendFilterProps = {
  legend: LegendEntry[];
  spotlight: ServiceState | null;
  onToggle: (state: ServiceState) => void;
};

/** State legend that doubles as a filter: tap a state to spotlight it (dim the rest). */
export function FloorPlanLegendFilter({ legend, spotlight, onToggle }: FloorPlanLegendFilterProps) {
  if (legend.length === 0) return null;
  return (
    <div
      className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-card px-3.5 py-3"
      role="group"
      aria-label="Filter tables by state"
    >
      <span className="mr-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
        Filter
      </span>
      {legend.map((entry) => {
        const active = spotlight === entry.state;
        return (
          <Button
            key={entry.state}
            variant="ghost"
            type="button"
            onClick={() => onToggle(entry.state)}
            aria-pressed={active}
            className={cn(
              'inline-flex h-auto items-center gap-1.5 rounded-full border px-2.5 py-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
              active ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/40',
            )}
          >
            <span className={cn('h-2 w-2 rounded-full', TONE_DOT[entry.tone])} />
            <span
              className={cn(
                'font-mono text-[11px] font-semibold uppercase tracking-[0.1em]',
                active ? 'text-primary' : 'text-foreground',
              )}
            >
              {entry.label}
            </span>
            <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
              {entry.count}
            </span>
          </Button>
        );
      })}
    </div>
  );
}
