import { ZoomIn, ZoomOut } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

import { FloorPlanTable } from './FloorPlanTable';
import { TimeScrubber } from './TimeScrubber';

import type { FloorPlanTimelineConfig } from '../hooks/useFloorPlanTimelineConfig';
import type { FloorPlanTableInspector } from '../lib/types';

export function FloorCanvas({
  selectedZoneLabel,
  timeString,
  pan,
  zoom,
  isDragging,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onZoomIn,
  onZoomOut,
  onPanBy,
  onResetView,
  tables,
  selectedTableId,
  onTableClick,
  time,
  timelineConfig,
  bars,
  onTimeChange,
  onTimeStep,
  emptySearchQuery,
}: {
  selectedZoneLabel: string;
  timeString: string;
  pan: { x: number; y: number };
  zoom: number;
  isDragging: boolean;
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onPanBy: (dx: number, dy: number) => void;
  onResetView: () => void;
  tables: FloorPlanTableInspector[];
  selectedTableId: string | null;
  onTableClick: (id: string) => void;
  time: number;
  timelineConfig: FloorPlanTimelineConfig;
  bars: number[];
  onTimeChange: (next: number) => void;
  onTimeStep: (delta: number) => void;
  emptySearchQuery: string | null;
}) {
  const helpId = 'floorplan-canvas-help';

  return (
    <Card className="relative overflow-hidden">
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-base">Floor canvas</CardTitle>
          <CardDescription>Drag to pan. Use controls to zoom.</CardDescription>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="secondary" className="rounded-md">
            {selectedZoneLabel}
          </Badge>
          <Badge variant="outline" className="rounded-md">
            {timeString}
          </Badge>
        </div>
      </CardHeader>
      <Separator />
      <CardContent className="relative p-0">
        <div
          className={cn(
            'relative flex h-[65vh] min-h-[520px] w-full items-center justify-center overflow-hidden bg-muted/20 touch-none',
            isDragging ? 'cursor-grabbing' : 'cursor-grab',
          )}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          onPointerCancel={onPointerUp}
          role="region"
          aria-label="Floor plan canvas"
          tabIndex={0}
          aria-describedby={helpId}
          onKeyDown={(event) => {
            // Provide keyboard access for view navigation (pan/zoom) without requiring a pointer device.
            const step = event.shiftKey ? 60 : 20;
            const key = event.key;
            if (key === 'ArrowLeft') {
              event.preventDefault();
              onPanBy(-step, 0);
              return;
            }
            if (key === 'ArrowRight') {
              event.preventDefault();
              onPanBy(step, 0);
              return;
            }
            if (key === 'ArrowUp') {
              event.preventDefault();
              onPanBy(0, -step);
              return;
            }
            if (key === 'ArrowDown') {
              event.preventDefault();
              onPanBy(0, step);
              return;
            }
            if (key === '+' || key === '=') {
              event.preventDefault();
              onZoomIn();
              return;
            }
            if (key === '-' || key === '_') {
              event.preventDefault();
              onZoomOut();
              return;
            }
            if (key === '0' || key === 'Home') {
              event.preventDefault();
              onResetView();
              return;
            }
          }}
        >
          <p id={helpId} className="sr-only">
            Drag to pan. Use plus and minus keys to zoom. Use arrow keys to pan. Press Home or 0 to reset view.
          </p>

          <div
            className="absolute inset-0 opacity-[0.08] pointer-events-none"
            style={{
              backgroundImage: `
                linear-gradient(to right, hsl(var(--border)) 1px, transparent 1px),
                linear-gradient(to bottom, hsl(var(--border)) 1px, transparent 1px)
              `,
              backgroundSize: `${40 * zoom}px ${40 * zoom}px`,
              backgroundPosition: `${pan.x}px ${pan.y}px`,
            }}
          />

          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className="relative transition-transform duration-75 ease-out will-change-transform"
              style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
            >
              <div className="relative w-[90vw] max-w-[900px] aspect-[4/3] rounded-[32px] border border-border/60 bg-background shadow-lg">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-2 bg-muted rounded-b-xl" />
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-64 h-2 bg-muted rounded-t-xl" />

                {tables.map((table) => (
                  <FloorPlanTable
                    key={table.id}
                    table={table}
                    isSelected={selectedTableId === table.id}
                    onClick={onTableClick}
                    zoom={zoom}
                  />
                ))}

                {emptySearchQuery ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="rounded-xl border bg-background/80 px-4 py-3 text-sm text-muted-foreground shadow-sm">
                      No tables match “{emptySearchQuery}”.
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <Card className="absolute right-4 top-4 z-20" data-prevent-canvas-pan>
            <CardContent className="p-1 flex flex-col gap-1">
              <Button type="button" variant="ghost" size="icon" onClick={onZoomIn} aria-label="Zoom in">
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Separator />
              <Button type="button" variant="ghost" size="icon" onClick={onZoomOut} aria-label="Zoom out">
                <ZoomOut className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>

          <div className="absolute bottom-4 left-1/2 z-20 w-full max-w-2xl -translate-x-1/2 px-4">
            <TimeScrubber
              time={time}
              min={timelineConfig.min}
              max={timelineConfig.max}
              step={timelineConfig.interval}
              bars={bars}
              onChange={onTimeChange}
              onStep={onTimeStep}
              className="w-full"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
