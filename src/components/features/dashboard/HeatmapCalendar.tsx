'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DateTime } from 'luxon';
import { useMemo, useState, type ComponentProps } from 'react';

import { Calendar, CalendarDayButton } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useMinimumDelay } from '@/hooks/use-minimum-delay';
import { cn } from '@/lib/utils';
import { formatDateKey, formatDateReadable } from '@/lib/utils/datetime';

import type { OpsBookingHeatmap, OpsTodayBookingsSummary } from '@/types/ops';

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
  const selectedDateObj = useMemo(() => {
    const parsed = DateTime.fromISO(selectedDate, { zone: summary.timezone });
    if (!parsed.isValid) return undefined;
    // Build a local date from restaurant calendar parts to avoid timezone drift.
    return new Date(parsed.year, parsed.month - 1, parsed.day, 12);
  }, [selectedDate, summary.timezone]);

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
        <button
          type="button"
          aria-busy={showLoading}
          className={cn(
            'px-2 text-xs font-medium text-foreground transition-colors hover:text-primary whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:text-sm',
            showLoading && 'opacity-70',
          )}
        >
          <span className="sm:hidden">{shortLabel}</span>
          <span className="hidden sm:inline">{formatDateReadable(selectedDate, summary.timezone)}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="center" className="p-0 w-auto">
        {/* Navigation header inside popover */}
        {onShiftDate && (
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <button
              type="button"
              onClick={() => {
                onShiftDate(-1);
                handleOpenChange(false);
              }}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-95 motion-reduce:active:scale-100"
              aria-label="Previous day"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </button>
            <span className="text-sm font-medium text-foreground">
              {formatDateReadable(selectedDate, summary.timezone)}
            </span>
            <button
              type="button"
              onClick={() => {
                onShiftDate(1);
                handleOpenChange(false);
              }}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-95 motion-reduce:active:scale-100"
              aria-label="Next day"
            >
              <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
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

function formatDateReadableShort(value: string | Date, timeZone: string): string {
  const date = value instanceof Date ? value : new Date(`${value}T00:00:00`);
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const parts = formatter.formatToParts(date);
  const weekday = parts.find((part) => part.type === 'weekday')?.value ?? '';
  const day = parts.find((part) => part.type === 'day')?.value ?? '';
  const month = parts.find((part) => part.type === 'month')?.value ?? '';
  const year = parts.find((part) => part.type === 'year')?.value ?? '';

  return [weekday, day, month, year].filter(Boolean).join(' ').trim();
}
