'use client';

import { MinusIcon, PlusIcon, UsersIcon } from 'lucide-react';
import React from 'react';

import { Button } from '@shared/ui/button';
import { FormDescription, FormItem, FormMessage } from '@shared/ui/form';

const DESCRIPTION = "Tables for 12+? Give us a call and we'll help you out.";

export type PartySizeFieldProps = {
  value: number;
  onChange: (direction: 'decrement' | 'increment') => void;
  error?: string;
};

export function PartySizeField({ value, onChange, error }: PartySizeFieldProps) {
  const labelId = React.useId();
  const isDoubleDigit = value >= 10;

  return (
    <FormItem className="min-w-0 overflow-hidden space-y-2">
      <div id={labelId} className="flex items-center gap-1.5 text-sm font-semibold sm:text-base">
        <UsersIcon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <span>Party size</span>
      </div>
      <div
        className="flex min-w-0 items-center gap-2 rounded-[calc(var(--luminous-radius)+2px)] bg-[var(--luminous-surface-low)] p-2"
        role="group"
        aria-labelledby={labelId}
      >
        <Button
          type="button"
          variant="secondary"
          size="icon"
          onClick={() => onChange('decrement')}
          aria-label="Decrease guests"
          className="luminous-secondary h-10 w-10 shrink-0 rounded-[var(--luminous-radius)] transition-all active:scale-95 sm:h-11 sm:w-11"
        >
          <MinusIcon className="h-5 w-5" aria-hidden="true" />
        </Button>
        <div
          className="flex min-w-0 flex-1 items-center justify-center overflow-hidden text-center"
          aria-live="polite"
          aria-atomic="true"
        >
          <span
            className={`block max-w-full whitespace-nowrap leading-none font-bold tabular-nums text-foreground transition-transform duration-200 ${
              isDoubleDigit ? 'text-[1.55rem] sm:text-[1.9rem]' : 'text-[1.75rem] sm:text-[2.15rem]'
            }`}
          >
            {value}
          </span>
          <span className="sr-only">{value === 1 ? 'guest' : 'guests'}</span>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="icon"
          onClick={() => onChange('increment')}
          aria-label="Increase guests"
          className="luminous-secondary h-10 w-10 shrink-0 rounded-[var(--luminous-radius)] transition-all active:scale-95 sm:h-11 sm:w-11"
        >
          <PlusIcon className="h-5 w-5" aria-hidden="true" />
        </Button>
      </div>
      <FormDescription className="hidden text-xs sm:block sm:text-sm">
        {DESCRIPTION}
      </FormDescription>
      <FormMessage>{error}</FormMessage>
    </FormItem>
  );
}
