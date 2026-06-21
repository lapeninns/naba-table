'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useMemo, useState, type ComponentProps } from 'react';

import { Button } from '@/components/ui/button';
import { Calendar, CalendarDayButton } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useMinimumDelay } from '@/hooks/use-minimum-delay';
import { cn } from '@/lib/utils';
import {
  dateKeyToCalendarDate,
  formatDateKey,
  formatDateReadable,
  formatDateReadableShort,
} from '@/lib/utils/datetime';

import type { OpsBookingHeatmap, OpsTodayBookingsSummary } from '@/types/ops';

const HEATMAP_CLASSES: Record<HeatIntensity, string> = {
  none: '',
  faint: 'bg-primary/10 text-primary hover:bg-primary/10',
  low: 'bg-primary/10 text-primary hover:bg-primary/10',
  medium: 'bg-primary/10 text-primary hover:bg-primary/10',
  high: 'bg-primary/10 text-primary hover:bg-primary/10',
};

type HeatIntensity = 'none' | 'faint' | 'low' | 'medium' | 'high';

type HeatmapCalendarProps = {
  summary: OpsTodayBookingsSummary;
  heatmap?: OpsBookingHeatmap;
  selectedDate: string;
  onSelectDate: (date: string) => void;
  onShiftDate?: (days: number) => void;
  isLoading?: boolean;
  onOpenChange?: (open: boolean) => void;
};

type HeatmapMeta = {
  bookings: number;
  covers: number;
  intensity: HeatIntensity;
};

export function HeatmapCalendar({
  summary,
  heatmap,
  selectedDate,
  onSelectDate,
  onShiftDate,
  isLoading,
  onOpenChange,
}: HeatmapCalendarProps) {
  const selectedDateObj = useMemo(() => dateKeyToCalendarDate(selectedDate), [selectedDate]);

  const heatmapMeta = useMemo(() => deriveHeatmapMeta(heatmap), [heatmap]);
  const showLoading = useMinimumDelay(Boolean(isLoading), { delayMs: 120, minDurationMs: 250 });
  const shortLabel = useMemo(
    () => formatDateReadableShort(selectedDate, summary.timezone),
    [selectedDate, summary.timezone],
  );

  const [open, setOpen] = useState(false);
  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    onOpenChange?.(nextOpen);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          aria-busy={showLoading}
          className={cn(
            'h-auto whitespace-nowrap px-2 text-xs font-medium text-foreground hover:text-primary sm:text-sm',
            showLoading && 'opacity-70',
          )}
        >
          <span className="sm:hidden">{shortLabel}</span>
          <span className="hidden sm:inline">
            {formatDateReadable(selectedDate, summary.timezone)}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="center" className="p-0 w-auto">
        {/* Navigation header inside popover */}
        {onShiftDate && (
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => {
                onShiftDate(-1);
                handleOpenChange(false);
              }}
              className="text-muted-foreground hover:text-foreground active:scale-95 motion-reduce:active:scale-100"
              aria-label="Previous day"
            >
              <ChevronLeft aria-hidden />
            </Button>
            <span className="text-sm font-medium text-foreground">
              {formatDateReadable(selectedDate, summary.timezone)}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => {
                onShiftDate(1);
                handleOpenChange(false);
              }}
              className="text-muted-foreground hover:text-foreground active:scale-95 motion-reduce:active:scale-100"
              aria-label="Next day"
            >
              <ChevronRight aria-hidden />
            </Button>
          </div>
        )}

        {/* Calendar picker */}
        <div className="p-2">
          <Calendar
            mode="single"
            selected={selectedDateObj}
            onSelect={(date) => {
              if (!date) return;
              onSelectDate(formatDateKey(date));
              handleOpenChange(false);
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
        </div>
      </PopoverContent>
    </Popover>
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
