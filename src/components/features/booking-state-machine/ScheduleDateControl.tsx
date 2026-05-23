'use client';

import { endOfDay } from 'date-fns';
import { CalendarIcon, ChevronDownIcon } from 'lucide-react';
import { useCallback, useEffect, useId, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { formatDateForInput, formatReservationDateShort } from '@reserve/shared/formatting/booking';

import type { ComponentProps } from 'react';

const DATE_DESCRIPTION = 'Pick a date to see available times.';

export function ScheduleDateControl({
  value,
  minDate,
  onSelect,
  onBlur,
  error,
  onMonthChange,
  isDateUnavailable,
  loadingDates,
}: {
  value: string;
  minDate: Date;
  onSelect: (value: Date | undefined | null) => void;
  onBlur?: () => void;
  error?: string;
  onMonthChange?: (month: Date) => void;
  isDateUnavailable?: (date: Date) => boolean;
  loadingDates?: Set<string>;
}) {
  const [open, setOpen] = useState(false);
  const baseId = useId();
  const dateButtonId = `${baseId}-button`;
  const dateLabelId = `${baseId}-label`;
  const dateValueId = `${baseId}-value`;
  const dateDescriptionId = `${baseId}-description`;
  const dateErrorId = error ? `${baseId}-error` : undefined;
  const selectedDate = useMemo(() => (value ? new Date(value) : undefined), [value]);
  const label = useMemo(() => (value ? formatReservationDateShort(value) : 'Select date'), [value]);
  const initialMonth = useMemo(() => {
    const base = selectedDate ?? minDate;
    return new Date(base.getFullYear(), base.getMonth(), 1);
  }, [minDate, selectedDate]);
  const initialMonthTime = initialMonth.getTime();

  useEffect(() => {
    onMonthChange?.(new Date(initialMonthTime));
  }, [initialMonthTime, onMonthChange]);

  const disabledMatcher = useCallback(
    (day?: Date) => {
      if (!day) {
        return false;
      }
      if (endOfDay(day) < minDate) {
        return true;
      }
      const dayKey = formatDateForInput(day);
      if (loadingDates?.has(dayKey)) {
        return true;
      }
      return isDateUnavailable?.(day) ?? false;
    },
    [isDateUnavailable, loadingDates, minDate],
  );

  const calendarModifiers = useMemo(() => {
    if (!loadingDates || loadingDates.size === 0) {
      return undefined;
    }

    return {
      loading: (day: Date) => loadingDates.has(formatDateForInput(day)),
    } satisfies ComponentProps<typeof Calendar>['modifiers'];
  }, [loadingDates]);

  const calendarModifiersClassNames = useMemo(() => {
    if (!loadingDates || loadingDates.size === 0) {
      return undefined;
    }

    return {
      loading:
        'relative after:absolute after:left-1/2 after:top-1/2 after:size-1.5 after:-translate-x-1/2 after:-translate-y-1/2 after:rounded-full after:bg-primary after:animate-pulse',
    } satisfies ComponentProps<typeof Calendar>['modifiersClassNames'];
  }, [loadingDates]);

  return (
    <div className="flex flex-col gap-3">
      <div id={dateLabelId} className="flex items-center gap-1.5 px-1 text-sm font-semibold">
        <CalendarIcon className="size-4 text-muted-foreground" aria-hidden="true" />
        <span>Date</span>
      </div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={dateButtonId}
            variant="outline"
            className={cn(
              'h-12 w-full justify-between text-base font-normal',
              !value && 'text-muted-foreground',
              error && 'border-destructive focus-visible:ring-destructive',
            )}
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-invalid={Boolean(error)}
            aria-labelledby={`${dateLabelId} ${dateValueId}`}
            aria-describedby={
              [dateDescriptionId, dateErrorId].filter(Boolean).join(' ') || undefined
            }
          >
            <span id={dateValueId} className="truncate">
              {label}
            </span>
            <ChevronDownIcon data-icon="inline-end" aria-hidden="true" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto overflow-hidden p-0" align="start">
          <Calendar
            mode="single"
            selected={selectedDate}
            defaultMonth={initialMonth}
            fromDate={minDate}
            onSelect={(next) => {
              onSelect(next);
              onBlur?.();
              setOpen(false);
            }}
            onMonthChange={(month) => onMonthChange?.(month)}
            disabled={disabledMatcher}
            modifiers={calendarModifiers}
            modifiersClassNames={calendarModifiersClassNames}
            initialFocus
          />
        </PopoverContent>
      </Popover>
      <p id={dateDescriptionId} className="px-1 text-xs text-muted-foreground">
        {DATE_DESCRIPTION}
      </p>
      {error ? (
        <p
          id={dateErrorId}
          className="rounded-md bg-destructive/10 px-3 py-2 text-sm font-medium leading-tight text-destructive"
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
