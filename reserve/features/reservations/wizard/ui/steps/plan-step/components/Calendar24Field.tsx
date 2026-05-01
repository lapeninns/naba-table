'use client';

import { endOfDay } from 'date-fns';
import { CalendarIcon, ChevronDownIcon, ClockIcon } from 'lucide-react';
import React, { useCallback, useEffect, useId, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatDateForInput, formatReservationDateShort } from '@reserve/shared/formatting/booking';
import { cn } from '@shared/lib/cn';

import type { TimeSlotDescriptor } from '@reserve/features/reservations/wizard/services';

const DATE_DESCRIPTION = 'Pick a date to see available times.';
const TIME_DESCRIPTION = 'Choose the time that works best for your party.';

export type Calendar24FieldProps = {
  date: {
    value: string;
    minDate: Date;
    onSelect: (value: Date | undefined | null) => void;
    onBlur?: () => void;
    error?: string;
  };
  time: {
    value: string;
    onChange: (value: string, options?: { commit?: boolean }) => void;
    onBlur?: () => void;
    error?: string;
  };
  suggestions?: TimeSlotDescriptor[];
  intervalMinutes?: number;
  isDateUnavailable?: (date: Date) => boolean;
  isTimeDisabled?: boolean;
  unavailableMessage?: string;
  onMonthChange?: (month: Date) => void;
  loadingDates?: Set<string>;
  isTimeLoading?: boolean;
};

export function Calendar24Date({
  date,
  onMonthChange,
  isDateUnavailable,
  loadingDates,
  idPrefix,
}: {
  date: Calendar24FieldProps['date'];
  onMonthChange?: Calendar24FieldProps['onMonthChange'];
  isDateUnavailable?: Calendar24FieldProps['isDateUnavailable'];
  loadingDates?: Calendar24FieldProps['loadingDates'];
  idPrefix?: string;
}) {
  const [open, setOpen] = useState(false);
  const baseId = useId();
  const finalId = idPrefix ?? baseId;
  const dateButtonId = `${finalId}-date`;
  const dateLabelId = `${finalId}-date-label`;
  const dateValueId = `${finalId}-date-value`;
  const dateDescriptionId = `${finalId}-date-description`;
  const dateErrorId = date.error ? `${finalId}-date-error` : undefined;

  const label = useMemo(
    () => (date.value ? formatReservationDateShort(date.value) : 'Select date'),
    [date.value],
  );
  const selectedDate = useMemo(() => (date.value ? new Date(date.value) : undefined), [date.value]);
  const initialMonth = useMemo(() => {
    const base = selectedDate ?? date.minDate;
    return new Date(base.getFullYear(), base.getMonth(), 1);
  }, [date.minDate, selectedDate]);
  const initialMonthTime = initialMonth.getTime();

  useEffect(() => {
    if (!onMonthChange) {
      return;
    }
    onMonthChange(new Date(initialMonthTime));
  }, [initialMonthTime, onMonthChange]);

  const disabledMatcher = useCallback(
    (day?: Date) => {
      if (!day) {
        return false;
      }
      if (endOfDay(day) < date.minDate) {
        return true;
      }
      const dayKey = formatDateForInput(day);
      if (loadingDates?.has(dayKey)) {
        return true;
      }
      if (typeof isDateUnavailable === 'function') {
        return isDateUnavailable(day);
      }
      return false;
    },
    [date.minDate, isDateUnavailable, loadingDates],
  );

  const calendarModifiers = useMemo(() => {
    if (!loadingDates || loadingDates.size === 0) {
      return undefined;
    }

    return {
      loading: (day: Date) => loadingDates.has(formatDateForInput(day)),
    } satisfies React.ComponentProps<typeof Calendar>['modifiers'];
  }, [loadingDates]);

  const calendarModifiersClassNames = useMemo(() => {
    if (!loadingDates || loadingDates.size === 0) {
      return undefined;
    }

    return {
      loading:
        'relative after:absolute after:left-1/2 after:top-1/2 after:h-1.5 after:w-1.5 after:-translate-x-1/2 after:-translate-y-1/2 after:rounded-full after:bg-primary after:animate-pulse',
    } satisfies React.ComponentProps<typeof Calendar>['modifiersClassNames'];
  }, [loadingDates]);

  return (
    <div className="flex flex-col gap-3">
      <div
        id={dateLabelId}
        className="flex items-center gap-1.5 px-1 text-sm font-semibold sm:text-base"
      >
        <CalendarIcon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <span>Date</span>
      </div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={dateButtonId}
            variant="outline"
            className={cn(
              'w-full justify-between font-normal h-12 text-base',
              !date.value && 'text-muted-foreground',
              date.error && 'border-destructive focus-visible:ring-destructive',
            )}
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-invalid={Boolean(date.error)}
            aria-labelledby={`${dateLabelId} ${dateValueId}`}
            aria-describedby={
              [dateDescriptionId, dateErrorId].filter(Boolean).join(' ') || undefined
            }
          >
            <span id={dateValueId} className="truncate">
              {label}
            </span>
            <ChevronDownIcon className="h-4 w-4 shrink-0 opacity-50" aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto overflow-hidden p-0" align="start">
          <Calendar
            mode="single"
            selected={selectedDate}
            defaultMonth={initialMonth}
            fromDate={date.minDate}
            onSelect={(next) => {
              date.onSelect(next);
              date.onBlur?.();
              setOpen(false);
            }}
            onMonthChange={(month) => {
              onMonthChange?.(month);
            }}
            disabled={disabledMatcher}
            modifiers={calendarModifiers}
            modifiersClassNames={calendarModifiersClassNames}
            initialFocus
          />
        </PopoverContent>
      </Popover>
      <p id={dateDescriptionId} className="px-1 text-xs text-muted-foreground sm:text-[0.8rem]">
        {DATE_DESCRIPTION}
      </p>
      {date.error ? (
        <div
          id={dateErrorId}
          className="flex items-start gap-1.5 rounded-md bg-destructive/10 px-3 py-2 animate-fade-in"
          role="alert"
        >
          <span className="text-destructive text-sm font-medium leading-tight">{date.error}</span>
        </div>
      ) : null}
    </div>
  );
}

export function Calendar24Time({
  time,
  suggestions = [],
  intervalMinutes,
  isTimeDisabled = false,
  unavailableMessage,
  isTimeLoading = false,
  idPrefix,
}: {
  time: Calendar24FieldProps['time'];
  suggestions?: Calendar24FieldProps['suggestions'];
  intervalMinutes?: Calendar24FieldProps['intervalMinutes'];
  isTimeDisabled?: Calendar24FieldProps['isTimeDisabled'];
  unavailableMessage?: Calendar24FieldProps['unavailableMessage'];
  isTimeLoading?: Calendar24FieldProps['isTimeLoading'];
  idPrefix?: string;
}) {
  const resolvedIntervalMinutes =
    typeof intervalMinutes === 'number' && intervalMinutes > 0 ? intervalMinutes : undefined;
  const [hasHydrated, setHasHydrated] = useState(false);
  const computedStepSeconds = resolvedIntervalMinutes
    ? Math.max(60, Math.round(resolvedIntervalMinutes * 60))
    : 60;
  const timeStepSeconds = hasHydrated ? computedStepSeconds : 60;

  const baseId = useId();
  const finalId = idPrefix ?? baseId;
  const timeInputId = `${finalId}-time`;
  const timeDescriptionId = `${finalId}-time-description`;
  const timeErrorId = time.error ? `${finalId}-time-error` : undefined;
  const timeLabelId = `${finalId}-time-label`;

  const enabledSuggestions = useMemo(
    () => suggestions.filter((slot) => !slot.disabled),
    [suggestions],
  );

  const groupedSuggestions = useMemo(() => {
    const groups = new Map<string, typeof suggestions>();
    enabledSuggestions.forEach((slot) => {
      const existing = groups.get(slot.label);
      if (existing) {
        existing.push(slot);
      } else {
        groups.set(slot.label, [slot]);
      }
    });
    return groups;
  }, [enabledSuggestions]);

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  const showSuggestions = hasHydrated && !isTimeDisabled && enabledSuggestions.length > 0;
  const inputValue = time.value ?? '';
  const resolvedUnavailableMessage =
    unavailableMessage ?? 'No available times for the selected date.';

  return (
    <div
      className={cn(
        'flex flex-col gap-3 transition-opacity duration-300',
        isTimeLoading && 'opacity-50',
      )}
    >
      <Label
        htmlFor={timeInputId}
        id={timeLabelId}
        className="flex items-center gap-1.5 px-1 text-sm font-semibold sm:text-base"
      >
        <ClockIcon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <span>Time</span>
      </Label>
      <div className="flex flex-col gap-2">
        <div className="relative">
          {showSuggestions ? (
            <Select
              name="reservation-time"
              value={inputValue}
              onValueChange={(next) => time.onChange(next, { commit: true })}
              disabled={isTimeDisabled || isTimeLoading}
            >
              <SelectTrigger
                id={timeInputId}
                className={cn(
                  'h-12 w-full rounded-[var(--pg-radius-md)] border-border bg-background px-4 text-base font-semibold text-foreground shadow-[var(--pg-shadow-soft)] hover:bg-muted/40 focus:ring-ring/25',
                  !inputValue && 'text-muted-foreground',
                  time.error && 'border-destructive focus-visible:ring-destructive',
                )}
                aria-invalid={Boolean(time.error)}
                aria-labelledby={timeLabelId}
                aria-describedby={
                  [timeDescriptionId, timeErrorId].filter(Boolean).join(' ') || undefined
                }
              >
                <SelectValue placeholder="--:--" />
              </SelectTrigger>
              <SelectContent
                className="pg-panel max-h-[min(22rem,var(--radix-select-content-available-height))] w-[var(--radix-select-trigger-width)] min-w-[var(--radix-select-trigger-width)] rounded-[var(--pg-radius-lg)] border-border p-1 shadow-[var(--pg-shadow-floating)]"
                position="popper"
                sideOffset={8}
              >
                {[...groupedSuggestions.entries()].map(([label, slots], index) => (
                  <React.Fragment key={label}>
                    {index > 0 ? <SelectSeparator className="my-1 bg-border/70" /> : null}
                    <SelectGroup>
                      <SelectLabel className="px-3 py-2 font-[var(--pg-font-mono)] text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                        {label}
                      </SelectLabel>
                      {slots.map((slot) => (
                        <SelectItem
                          key={slot.value}
                          value={slot.value}
                          className="my-0.5 rounded-[var(--pg-radius-sm)] py-2.5 pl-8 pr-3 font-[var(--pg-font-mono)] text-sm font-semibold focus:bg-muted focus:text-foreground data-[state=checked]:bg-muted data-[state=checked]:text-foreground"
                        >
                          {slot.display}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </React.Fragment>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <>
              <Input
                id={timeInputId}
                name="reservation-time"
                type="time"
                value={isTimeDisabled && unavailableMessage ? '' : inputValue}
                step={timeStepSeconds}
                onChange={(event) => {
                  if (isTimeDisabled) {
                    return;
                  }
                  const value = event.target.value;
                  time.onChange(value, { commit: false });
                }}
                onBlur={(event) => {
                  if (isTimeDisabled) {
                    time.onBlur?.();
                    return;
                  }
                  time.onBlur?.();
                  time.onChange(event.target.value, { commit: true });
                }}
                aria-invalid={Boolean(time.error)}
                aria-label="Time"
                aria-labelledby={timeLabelId}
                aria-describedby={
                  [timeDescriptionId, timeErrorId].filter(Boolean).join(' ') || undefined
                }
                placeholder="--:--"
                className={cn(
                  'h-12 appearance-none bg-background text-base font-normal [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none',
                  !inputValue ? 'text-foreground' : undefined,
                  time.error && 'border-destructive focus-visible:ring-destructive',
                )}
                disabled={isTimeDisabled || isTimeLoading}
              />
              {!inputValue && !isTimeLoading && !isTimeDisabled && (
                <span
                  aria-hidden="true"
                  className={cn(
                    'pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-base text-muted-foreground transition-opacity',
                  )}
                >
                  --:--
                </span>
              )}
            </>
          )}

          {isTimeLoading && !inputValue ? (
            <div className="absolute inset-0 flex items-center px-3 pointer-events-none">
              <div className="h-5 w-20 animate-pulse rounded bg-muted/60" />
            </div>
          ) : null}
        </div>

        {!showSuggestions ? (
          <p className="px-1 text-xs text-muted-foreground sm:text-[0.8rem]" aria-live="polite">
            {resolvedUnavailableMessage}
          </p>
        ) : null}
      </div>
      <p id={timeDescriptionId} className="px-1 text-xs text-muted-foreground sm:text-[0.8rem]">
        {TIME_DESCRIPTION}
      </p>
      {time.error ? (
        <div
          id={timeErrorId}
          className="flex items-start gap-1.5 rounded-md bg-destructive/10 px-3 py-2 animate-fade-in"
          role="alert"
        >
          <span className="text-destructive text-sm font-medium leading-tight">{time.error}</span>
        </div>
      ) : null}
    </div>
  );
}

export function Calendar24Field(props: Calendar24FieldProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:gap-3">
      <div className="flex-1">
        <Calendar24Date
          date={props.date}
          onMonthChange={props.onMonthChange}
          isDateUnavailable={props.isDateUnavailable}
          loadingDates={props.loadingDates}
        />
      </div>

      <div
        className="hidden sm:block sm:w-px sm:bg-border sm:self-stretch sm:my-8"
        aria-hidden="true"
      />

      <div className="flex-1">
        <Calendar24Time
          time={props.time}
          suggestions={props.suggestions}
          intervalMinutes={props.intervalMinutes}
          isTimeDisabled={props.isTimeDisabled}
          unavailableMessage={props.unavailableMessage}
          isTimeLoading={props.isTimeLoading}
        />
      </div>
    </div>
  );
}
