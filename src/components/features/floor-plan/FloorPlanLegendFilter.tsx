'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { nodeDotClass } from './serviceStateStyles';
import { FLOOR_FOCUS_RING } from './styles';

import type { ServiceState } from './domain/types';
import type { LegendEntry } from './useFloorPlanState';

export type FloorPlanLegendFilterProps = {
  legend: LegendEntry[];
  spotlight: ServiceState | null;
  onToggle: (state: ServiceState) => void;
  className?: string;
};

/** State legend that doubles as a filter: tap a state to spotlight it (dim the rest). */
export function FloorPlanLegendFilter({
  legend,
  spotlight,
  onToggle,
  className,
}: FloorPlanLegendFilterProps) {
  if (legend.length === 0) return null;
  return (
    <div
      className={cn('flex flex-wrap items-center gap-2', className)}
      role="group"
      aria-label="Filter tables by status"
    >
      <span className="mr-1 text-[10px] uppercase tracking-wide text-muted-foreground">Filter</span>
      {legend.map((entry) => {
        const active = spotlight === entry.state;
        return (
          <Button
            key={entry.state}
            variant="outline"
            size="sm"
            type="button"
            onClick={() => onToggle(entry.state)}
            aria-pressed={active}
            className={cn(
              'h-8 gap-1.5 px-2.5',
              FLOOR_FOCUS_RING,
              active && 'border-primary/30 bg-primary/10 text-primary',
            )}
          >
            <span className={cn('h-2 w-2 rounded-full', nodeDotClass(entry.state))} />
            <span className="text-xs font-medium">{entry.label}</span>
            <span className="text-xs tabular-nums text-muted-foreground">{entry.count}</span>
          </Button>
        );
      })}
    </div>
  );
}
