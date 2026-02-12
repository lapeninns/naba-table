import { Minus, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

import { formatMinutes } from '../lib/timeline';

export function TimeScrubber({
  time,
  min,
  max,
  step,
  bars,
  onChange,
  onStep,
  className,
}: {
  time: number;
  min: number;
  max: number;
  step: number;
  bars: number[];
  onChange: (next: number) => void;
  onStep: (delta: number) => void;
  className?: string;
}) {
  const formatted = formatMinutes(time);
  const range = Math.max(1, max - min);
  const playhead = Math.max(0, Math.min(100, ((time - min) / range) * 100));

  return (
    <Card
      className={cn('w-full max-w-2xl', className)}
      data-prevent-canvas-pan
      onPointerDownCapture={(event) => {
        // The floor canvas listens for pointer down to start panning; timeline drag should not trigger it.
        event.stopPropagation();
      }}
    >
      <CardContent className="flex h-20 items-center gap-4 px-6">
        <div className="flex flex-col items-center min-w-[60px]">
          <span className="text-xl font-bold text-slate-900 tabular-nums">{formatted}</span>
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Timeline</span>
        </div>

        <div className="flex-1 relative h-12 flex items-end gap-1 group cursor-crosshair rounded-md focus-within:ring-2 focus-within:ring-primary/30 focus-within:ring-offset-2 ring-offset-background">
          {bars.map((height, i) => (
            <div
              key={i}
              className={cn(
                'flex-1 rounded-t-sm transition-[height,background-color] duration-300',
                i > bars.length * 0.55 && i < bars.length * 0.75 ? 'bg-primary/60' : 'bg-muted',
              )}
              style={{ height: `${height}%` }}
            />
          ))}

          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={time}
            onChange={(e) => onChange(Number(e.target.value))}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            aria-label="Select time"
            aria-valuetext={formatted}
          />

          <div
            className="absolute top-0 bottom-0 w-0.5 bg-primary pointer-events-none transition-[left] duration-75"
            style={{ left: `${playhead}%` }}
          >
            <div className="absolute -top-1 -left-1.5 w-3 h-3 bg-primary rounded-full shadow-sm" />
          </div>
        </div>

        <div className="flex gap-2">
          <Button type="button" variant="ghost" size="icon" onClick={() => onStep(-step)} aria-label="Step time backward">
            <Minus className="w-4 h-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon" onClick={() => onStep(step)} aria-label="Step time forward">
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
