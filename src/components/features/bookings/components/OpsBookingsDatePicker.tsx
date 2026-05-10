'use client';

import { CalendarDays, X } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import {
  dateKeyToCalendarDate,
  formatDateKey,
  formatDateReadable,
  getTodayInTimezone,
} from '@/lib/utils/datetime';

export type OpsBookingsDatePickerProps = {
  value: string | null;
  timezone: string;
  onSelectDate: (date: string) => void;
  onClear: () => void;
  onToday: () => void;
  className?: string;
};

export function OpsBookingsDatePicker({
  value,
  timezone,
  onSelectDate,
  onClear,
  onToday,
  className,
}: OpsBookingsDatePickerProps) {
  const selectedDateObj = useMemo(() => dateKeyToCalendarDate(value), [value]);

  const label = useMemo(() => {
    if (!value) return 'Date: All';
    return formatDateReadable(value, timezone);
  }, [timezone, value]);

  const [open, setOpen] = useState(false);

  const todayLabel = useMemo(() => getTodayInTimezone(timezone), [timezone]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn('h-11 gap-2 sm:h-9', className)}
          aria-label="Select service date"
        >
          <CalendarDays className="size-4" aria-hidden />
          <span className="truncate">{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Service date
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 px-2 text-xs"
              onClick={() => {
                onToday();
                setOpen(false);
              }}
            >
              Today ({todayLabel})
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 px-2 text-xs"
              onClick={() => {
                onClear();
                setOpen(false);
              }}
              disabled={!value}
              aria-label="Clear selected date"
            >
              <X className="mr-1 size-4" aria-hidden />
              Clear
            </Button>
          </div>
        </div>

        <div className="p-2">
          <Calendar
            mode="single"
            selected={selectedDateObj}
            onSelect={(date) => {
              if (!date) return;
              onSelectDate(formatDateKey(date));
              setOpen(false);
            }}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
