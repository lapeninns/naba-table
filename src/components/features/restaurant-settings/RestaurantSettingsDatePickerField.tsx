'use client';

import { CalendarIcon, ChevronDownIcon } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

type RestaurantSettingsDatePickerFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  description?: string;
  disabled?: boolean;
  error?: string;
  id?: string;
  placeholder?: string;
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

export function RestaurantSettingsDatePickerField({
  label,
  value,
  onChange,
  className,
  description,
  disabled = false,
  error,
  id,
  placeholder = 'Select date',
}: RestaurantSettingsDatePickerFieldProps) {
  const [open, setOpen] = useState(false);

  const selectedDate = useMemo(() => parseDateValue(value), [value]);
  const buttonLabel = selectedDate ? dateLabelFormatter.format(selectedDate) : placeholder;
  const defaultMonth = selectedDate ?? new Date();
  const fieldId = id ?? `restaurant-settings-date-${label.toLowerCase().replace(/\W+/g, '-')}`;
  const descriptionId = description ? `${fieldId}-description` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;

  return (
    <div className={className}>
      <div className="flex items-center gap-1">
        <Label htmlFor={fieldId} className="text-xs uppercase tracking-wide text-muted-foreground">
          {label}
        </Label>
        <CalendarIcon className="size-3.5 text-muted-foreground" aria-hidden="true" />
      </div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={fieldId}
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn(
              'mt-1 h-9 w-full justify-between px-3 text-left text-sm font-normal',
              !selectedDate && 'text-muted-foreground',
              error && 'border-destructive focus-visible:ring-destructive',
            )}
            aria-invalid={Boolean(error)}
            aria-describedby={cn(descriptionId, errorId) || undefined}
          >
            <span className="truncate">{buttonLabel}</span>
            <ChevronDownIcon data-icon="inline-end" className="shrink-0 opacity-50" aria-hidden />
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
      {description ? (
        <p id={descriptionId} className="mt-1 text-xs leading-5 text-muted-foreground">
          {description}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="mt-1 text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
