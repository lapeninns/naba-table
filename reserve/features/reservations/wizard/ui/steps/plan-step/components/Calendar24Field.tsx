'use client';

import { ChevronDownIcon } from 'lucide-react';
import React, { useId, useMemo, useState } from 'react';

import { formatReservationDate } from '@reserve/shared/formatting/booking';
import { Button } from '@shared/ui/button';
import { Calendar } from '@shared/ui/calendar';
import { Input } from '@shared/ui/input';
import { Label } from '@shared/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@shared/ui/popover';

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
    onChange: (value: string) => void;
    onBlur?: () => void;
    error?: string;
  };
  suggestions?: TimeSlotDescriptor[];
};

export function Calendar24Field({ date, time, suggestions = [] }: Calendar24FieldProps) {
  const [open, setOpen] = useState(false);
  const baseId = useId();
  const dateButtonId = `${baseId}-date`;
  const timeInputId = `${baseId}-time`;
  const timeListId = `${baseId}-time-options`;
  const dateDescriptionId = `${baseId}-date-description`;
  const timeDescriptionId = `${baseId}-time-description`;
  const dateErrorId = date.error ? `${baseId}-date-error` : undefined;
  const timeErrorId = time.error ? `${baseId}-time-error` : undefined;

  const label = useMemo(
    () => (date.value ? formatReservationDate(date.value) : 'Select date'),
    [date.value],
  );
  const selectedDate = useMemo(() => (date.value ? new Date(date.value) : undefined), [date.value]);

  const enabledSuggestions = useMemo(
    () => suggestions.filter((slot) => !slot.disabled),
    [suggestions],
  );

  return (
    <div className="flex flex-col gap-4 md:flex-row">
      <div className="flex flex-1 flex-col gap-3">
        <Label htmlFor={dateButtonId} className="px-1">
          Date
        </Label>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              id={dateButtonId}
              variant="outline"
              className="w-full justify-between font-normal"
              aria-haspopup="dialog"
              aria-expanded={open}
              aria-invalid={Boolean(date.error)}
              aria-describedby={
                [dateDescriptionId, dateErrorId].filter(Boolean).join(' ') || undefined
              }
            >
              <span>{label}</span>
              <ChevronDownIcon className="h-4 w-4" aria-hidden />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto overflow-hidden p-0" align="start">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(next) => {
                date.onSelect(next);
                date.onBlur?.();
                setOpen(false);
              }}
              disabled={(day) => (day ? day < date.minDate : false)}
              initialFocus
            />
          </PopoverContent>
        </Popover>
        <p id={dateDescriptionId} className="px-1 text-[0.8rem] text-muted-foreground">
          {DATE_DESCRIPTION}
        </p>
        {date.error ? (
          <p id={dateErrorId} className="px-1 text-[0.8rem] font-medium text-destructive">
            {date.error}
          </p>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-3">
        <Label htmlFor={timeInputId} className="px-1">
          Time
        </Label>
        <div className="flex flex-col gap-2">
          <Input
            id={timeInputId}
            type="time"
            value={time.value ?? ''}
            step="60"
            onChange={(event) => {
              const value = event.target.value;
              time.onChange(value);
            }}
            onBlur={time.onBlur}
            aria-invalid={Boolean(time.error)}
            aria-describedby={
              [timeDescriptionId, timeErrorId].filter(Boolean).join(' ') || undefined
            }
            list={enabledSuggestions.length > 0 ? timeListId : undefined}
            className="bg-background text-base font-normal appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
          />
          {enabledSuggestions.length > 0 ? (
            <datalist id={timeListId}>
              {enabledSuggestions.map((slot) => (
                <option
                  key={slot.value}
                  value={slot.value}
                  label={`${slot.display} • ${slot.label}`}
                />
              ))}
            </datalist>
          ) : null}
        </div>
        <p id={timeDescriptionId} className="px-1 text-[0.8rem] text-muted-foreground">
          {TIME_DESCRIPTION}
        </p>
        {time.error ? (
          <p id={timeErrorId} className="px-1 text-[0.8rem] font-medium text-destructive">
            {time.error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
