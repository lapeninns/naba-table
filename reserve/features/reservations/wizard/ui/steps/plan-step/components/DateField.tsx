'use client';

import React, { useMemo, useState } from 'react';

import { formatReservationDate } from '@reserve/shared/formatting/booking';
import { Icon } from '@reserve/shared/ui/icons';
import { Button } from '@shared/ui/button';
import { Calendar } from '@shared/ui/calendar';
import { FormControl, FormDescription, FormItem, FormLabel, FormMessage } from '@shared/ui/form';
import { Popover, PopoverContent, PopoverTrigger } from '@shared/ui/popover';

const DESCRIPTION = 'Pick a date to see available times.';

export type DateFieldProps = {
  value: string;
  minDate: Date;
  onSelect: (value: Date | undefined | null) => void;
  error?: string;
};

export function DateField({ value, minDate, onSelect, error }: DateFieldProps) {
  const [open, setOpen] = useState(false);
  const label = useMemo(() => (value ? formatReservationDate(value) : 'Select a date'), [value]);
  const selectedDate = useMemo(() => (value ? new Date(value) : undefined), [value]);

  return (
    <FormItem className="space-y-3">
      <FormLabel>Date</FormLabel>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <FormControl>
            <Button
              variant="outline"
              className="w-full justify-between"
              aria-label="Choose reservation date"
            >
              <span>{label}</span>
              <Icon.Calendar className="ml-2 h-4 w-4" aria-hidden />
            </Button>
          </FormControl>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(date) => {
              onSelect(date);
              setOpen(false);
            }}
            disabled={(day) => (day ? day < minDate : false)}
            initialFocus
          />
        </PopoverContent>
      </Popover>
      <FormDescription>{DESCRIPTION}</FormDescription>
      <FormMessage>{error}</FormMessage>
    </FormItem>
  );
}
