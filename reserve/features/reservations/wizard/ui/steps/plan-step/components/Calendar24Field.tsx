'use client';

import { endOfDay } from 'date-fns';
import { CalendarIcon, ChevronDownIcon, ClockIcon } from 'lucide-react';
import React, { useCallback, useEffect, useId, useMemo, useState } from 'react';

import { formatDateForInput, formatReservationDateShort } from '@reserve/shared/formatting/booking';
import { cn } from '@shared/lib/cn';
import { Button } from '@shared/ui/button';
import { Calendar } from '@shared/ui/calendar';
import { Input } from '@shared/ui/input';
import { Label } from '@shared/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@shared/ui/popover';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@shared/ui/select';

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
      <Label
        id={dateLabelId}
        className="flex items-center gap-1.5 px-1 text-sm font-semibold sm:text-base"
      >
        <CalendarIcon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <span>Date</span>
      </Label>
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
            aria-labelledby={dateLabelId}
            aria-describedby={
              [dateDescriptionId, dateErrorId].filter(Boolean).join(' ') || undefined
            }
          >
            <span className="truncate">{label}</span>
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
  const selectValue = inputValue;
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
              name="time"
              value={selectValue}
              onValueChange={(val) => time.onChange(val, { commit: true })}
              disabled={isTimeDisabled || isTimeLoading}
            >
              <SelectTrigger
                id={timeInputId}
                className={cn(
                  'h-12 w-full text-base font-normal bg-background',
                  !inputValue && 'text-muted-foreground',
                  time.error && 'border-destructive focus:ring-destructive',
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
                className="max-h-[20rem] w-[var(--radix-select-trigger-width)] min-w-[var(--radix-select-trigger-width)]"
                position="popper"
              >
                {[...groupedSuggestions.entries()].map(([label, slots], index) => {
                  // Determine icon based on label keywords
                  const lowerLabel = label.toLowerCase();
                  let icon = '🕒'; // Default clock
                  if (lowerLabel.includes('lunch')) icon = '☀️';
                  else if (lowerLabel.includes('dinner')) icon = '🌙';
                  else if (lowerLabel.includes('breakfast') || lowerLabel.includes('brunch'))
                    icon = '🍳';
                  else if (lowerLabel.includes('happy')) icon = '🍸';
                  else if (lowerLabel.includes('morning')) icon = '🌅';
                  else if (lowerLabel.includes('afternoon')) icon = '🌤️';
                  else if (lowerLabel.includes('evening')) icon = '🌆';

                  return (
                    <React.Fragment key={label}>
                      {index > 0 && <SelectSeparator />}
                      <SelectGroup>
                        <SelectLabel className="flex items-center gap-2 pl-8 text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">
                          <span className="text-base leading-none">{icon}</span>
                          {label}
                        </SelectLabel>
                        {slots.map((slot) => (
                          <SelectItem
                            key={slot.value}
                            value={slot.value}
                            className="pl-8 data-[state=checked]:bg-primary/10 data-[state=checked]:text-primary"
                          >
                            <span className="font-medium font-mono tracking-tight">
                              {slot.display}
                            </span>
                            {/* Optional: Add slight dimming to unselected items for better hierarchy? No, keep clean. */}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </React.Fragment>
                  );
                })}
              </SelectContent>
            </Select>
          ) : (
            <>
              <Input
                id={timeInputId}
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
                aria-labelledby={timeLabelId}
                aria-describedby={
                  [timeDescriptionId, timeErrorId].filter(Boolean).join(' ') || undefined
                }
                placeholder="--:--"
                className={cn(
                  'h-12 bg-background text-base font-normal appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none',
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

        {!showSuggestions && (
          <p className="px-1 text-xs text-muted-foreground sm:text-[0.8rem]" aria-live="polite">
            {resolvedUnavailableMessage}
          </p>
        )}
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
