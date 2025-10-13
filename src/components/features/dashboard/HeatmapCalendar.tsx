'use client';

import { useMemo, type ComponentProps } from 'react';
import { Calendar, CalendarDayButton } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { formatDateKey, formatDateReadable } from '@/lib/utils/datetime';
import type { OpsBookingHeatmap, OpsTodayBookingsSummary } from '@/types/ops';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

const HEATMAP_CLASSES: Record<HeatIntensity, string> = {
  none: '',
  faint: 'bg-emerald-100/70 text-emerald-900 hover:bg-emerald-100/90',
  low: 'bg-emerald-200/70 text-emerald-950 hover:bg-emerald-200/90',
  medium: 'bg-emerald-400/80 text-white hover:bg-emerald-400/90',
  high: 'bg-emerald-600/80 text-white hover:bg-emerald-600/90',
};

type HeatIntensity = 'none' | 'faint' | 'low' | 'medium' | 'high';

type HeatmapCalendarProps = {
  summary: OpsTodayBookingsSummary;
  heatmap?: OpsBookingHeatmap;
  selectedDate: string;
  onSelectDate: (date: string) => void;
  isLoading?: boolean;
};

type HeatmapMeta = {
  bookings: number;
  covers: number;
  intensity: HeatIntensity;
};

export function HeatmapCalendar({ summary, heatmap, selectedDate, onSelectDate, isLoading }: HeatmapCalendarProps) {
  const selectedDateObj = useMemo(() => {
    const next = new Date(`${selectedDate}T00:00:00`);
    return Number.isNaN(next.getTime()) ? undefined : next;
  }, [selectedDate]);

  const heatmapMeta = useMemo(() => deriveHeatmapMeta(heatmap), [heatmap]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-foreground">Select service date</p>
          <p className="text-xs text-muted-foreground">Heatmap highlights busier days over the current calendar view.</p>
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" disabled={isLoading} className="gap-2">
              <CalendarIcon className="h-4 w-4" aria-hidden />
              {formatDateReadable(selectedDate, summary.timezone)}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="p-2">
            <Calendar
              mode="single"
              selected={selectedDateObj}
              onSelect={(date) => {
                if (!date) return;
                onSelectDate(formatDateKey(date));
              }}
              components={{
                DayButton: (props) => {
                  const dateKey = formatDateKey(props.day.date);
                  const meta = heatmapMeta.get(dateKey);
                  const intensity = meta?.intensity ?? 'none';
                  const ariaLabel = meta
                    ? `${meta.bookings} bookings, ${meta.covers} covers`
                    : `No bookings`;

                  return (
                    <HeatmapDayButton
                      {...props}
                      aria-label={ariaLabel}
                      className={cn(props.className, HEATMAP_CLASSES[intensity])}
                    />
                  );
                },
              }}
            />
          </PopoverContent>
        </Popover>
      </div>

      <HeatmapLegend />
    </div>
  );
}

type HeatmapDayButtonProps = ComponentProps<typeof CalendarDayButton>;

function HeatmapDayButton(props: HeatmapDayButtonProps) {
  return <CalendarDayButton {...props} />;
}

function deriveHeatmapMeta(heatmap?: OpsBookingHeatmap): Map<string, HeatmapMeta> {
  if (!heatmap) {
    return new Map();
  }

  const entries = Object.entries(heatmap);
  if (entries.length === 0) {
    return new Map();
  }

  const maxCovers = entries.reduce((acc, [, value]) => Math.max(acc, value.covers), 0);
  const result = new Map<string, HeatmapMeta>();

  for (const [date, value] of entries) {
    result.set(date, {
      bookings: value.bookings,
      covers: value.covers,
      intensity: computeIntensity(value.covers, maxCovers),
    });
  }

  return result;
}

function computeIntensity(covers: number, max: number): HeatIntensity {
  if (!covers || max <= 0) {
    return 'none';
  }

  const ratio = covers / max;

  if (ratio < 0.25) return 'faint';
  if (ratio < 0.5) return 'low';
  if (ratio < 0.75) return 'medium';
  return 'high';
}

function HeatmapLegend() {
  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground">
      <span className="text-xs font-medium uppercase tracking-wide">Legend:</span>
      <span className={cn('h-2 w-6 rounded-full border border-border/60 bg-transparent')} aria-hidden />
      <span className="text-xs">No bookings</span>
      <span className={cn('h-2 w-6 rounded-full bg-emerald-200/70')} aria-hidden />
      <span className="text-xs">Moderate</span>
      <span className={cn('h-2 w-6 rounded-full bg-emerald-600/80')} aria-hidden />
      <span className="text-xs">Busy</span>
    </div>
  );
}
