'use client';

import { CalendarIcon, ChevronDownIcon } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

type OperatingHoursOverrideDateFieldProps = {
  value: string;
  disabled?: boolean;
  error?: string;
  onChange: (value: string) => void;
};

const dateLabelFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

function parseDateValue(value: string): Date | undefined {
  if (!value) {
    return undefined;
  }

  const [year, month, day] = value.split('-').map((part) => Number(part));
  if (!year || !month || !day) {
    return undefined;
  }

  const parsed = new Date(year, month - 1, day);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return undefined;
  }

  return parsed;
}

function formatDateValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function OperatingHoursOverrideDateField({
  value,
  disabled = false,
  error,
  onChange,
}: OperatingHoursOverrideDateFieldProps) {
  const [open, setOpen] = useState(false);

  const selectedDate = useMemo(() => parseDateValue(value), [value]);
  const buttonLabel = selectedDate ? dateLabelFormatter.format(selectedDate) : 'Select date';
  const defaultMonth = selectedDate ?? new Date();

  return (
    <div>
      <div className="flex items-center gap-1">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Date</Label>
        <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
      </div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn(
              'mt-1 h-9 w-full justify-between px-3 text-left text-sm font-normal',
              !selectedDate && 'text-muted-foreground',
              error && 'border-destructive focus-visible:ring-destructive',
            )}
            aria-invalid={Boolean(error)}
          >
            <span className="truncate">{buttonLabel}</span>
            <ChevronDownIcon className="h-4 w-4 shrink-0 opacity-50" aria-hidden="true" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto overflow-hidden p-0" align="start">
          <Calendar
            mode="single"
            selected={selectedDate}
            defaultMonth={defaultMonth}
            onSelect={(next) => {
              if (!next) {
                return;
              }
              onChange(formatDateValue(next));
              setOpen(false);
            }}
            initialFocus
          />
        </PopoverContent>
      </Popover>
      {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
