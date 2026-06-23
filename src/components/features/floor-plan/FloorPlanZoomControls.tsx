'use client';

import { Maximize, Minus, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { FLOOR_FOCUS_RING } from './styles';

export type FloorPlanZoomControlsProps = {
  scale: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
};

const ZOOM_BUTTON_CLASS = cn(
  'border-0 bg-transparent shadow-none hover:bg-muted',
  FLOOR_FOCUS_RING,
);

/**
 * Zoom in / out / fit-to-view controls overlaid on the floor map. Grouped into one ELEVATED
 * cluster (bordered, shadowed, translucent backdrop) so it reads as a floating control surface
 * rather than loose buttons sitting on top of — and hiding — tables; the zoom-percent chip is
 * dropped below `sm` to shrink the cluster on the narrowest canvases.
 */
export function FloorPlanZoomControls({
  scale,
  onZoomIn,
  onZoomOut,
  onReset,
}: FloorPlanZoomControlsProps) {
  return (
    <div className="absolute right-3 top-3 z-20 flex flex-col items-stretch gap-0.5 rounded-lg border border-border bg-card/95 p-1 shadow-md backdrop-blur-sm">
      <Button
        variant="ghost"
        size="icon-sm"
        type="button"
        aria-label="Zoom in"
        onClick={onZoomIn}
        className={ZOOM_BUTTON_CLASS}
      >
        <Plus className="size-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        type="button"
        aria-label="Zoom out"
        onClick={onZoomOut}
        className={ZOOM_BUTTON_CLASS}
      >
        <Minus className="size-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        type="button"
        aria-label="Fit to view"
        onClick={onReset}
        className={ZOOM_BUTTON_CLASS}
      >
        <Maximize className="size-3.5" />
      </Button>
      <span className="hidden text-center text-[10px] tabular-nums text-muted-foreground sm:block">
        {Math.round(scale * 100)}%
      </span>
    </div>
  );
}
