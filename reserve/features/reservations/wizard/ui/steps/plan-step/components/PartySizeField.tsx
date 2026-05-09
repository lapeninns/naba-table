'use client';

import { MinusIcon, PlusIcon, UsersIcon } from 'lucide-react';
import React from 'react';

import { Button } from '@/components/ui/button';
import { FormDescription, FormItem, FormMessage } from '@/components/ui/form';
import { MAX_ONLINE_PARTY_SIZE, MIN_ONLINE_PARTY_SIZE } from '@/lib/bookings/partySize';
import { cn } from '@shared/lib/cn';

const DESCRIPTION = "Tables for 12+? Give us a call and we'll help you out.";

export type PartySizeFieldProps = {
  value: number;
  onChange: (direction: 'decrement' | 'increment') => void;
  error?: string;
};

export function PartySizeField({ value, onChange, error }: PartySizeFieldProps) {
  const [isAnimating, setIsAnimating] = React.useState(false);
  const labelId = React.useId();
  const descriptionId = React.useId();
  const canDecrement = value > MIN_ONLINE_PARTY_SIZE;
  const canIncrement = value < MAX_ONLINE_PARTY_SIZE;
  const partyLabel = value === 1 ? 'guest' : 'guests';

  const handleChange = (direction: 'decrement' | 'increment') => {
    if (direction === 'decrement' && !canDecrement) {
      return;
    }
    if (direction === 'increment' && !canIncrement) {
      return;
    }
    setIsAnimating(true);
    onChange(direction);
    setTimeout(() => setIsAnimating(false), 200);
  };

  return (
    <FormItem className="space-y-3">
      <div
        id={labelId}
        className="flex items-center gap-1.5 px-1 text-sm font-semibold sm:text-base"
      >
        <UsersIcon className="size-4 text-muted-foreground" aria-hidden="true" />
        <span>Party size</span>
      </div>
      <div
        className={cn(
          'grid h-12 w-full grid-cols-[44px_minmax(0,1fr)_44px] items-center overflow-hidden rounded-[var(--pg-radius-md)] border border-border bg-background shadow-[var(--pg-shadow-soft)] transition-colors focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/25 sm:grid-cols-[56px_minmax(0,1fr)_56px]',
          error && 'border-destructive ring-1 ring-destructive/20',
        )}
        role="group"
        aria-labelledby={labelId}
        aria-describedby={descriptionId}
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => handleChange('decrement')}
          disabled={!canDecrement}
          aria-label="Decrease guests"
          className="h-full w-full shrink-0 rounded-none border-r border-border/70 text-foreground hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-35 active:scale-95"
        >
          <MinusIcon className="size-5" aria-hidden="true" />
        </Button>
        <div
          className="flex h-8 min-w-0 items-center justify-center gap-1.5 whitespace-nowrap px-1.5"
          aria-live="polite"
          aria-atomic="true"
          aria-label={`${value} ${partyLabel}`}
        >
          <span
            className={`text-[1.35rem] font-semibold leading-none tabular-nums text-foreground transition-transform duration-200 sm:text-2xl ${
              isAnimating ? 'scale-110' : 'scale-100'
            }`}
          >
            {value}
          </span>
          <span className="text-[0.8rem] font-medium leading-none text-muted-foreground sm:text-sm">
            {partyLabel}
          </span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => handleChange('increment')}
          disabled={!canIncrement}
          aria-label="Increase guests"
          className="h-full w-full shrink-0 rounded-none border-l border-border/70 text-foreground hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-35 active:scale-95"
        >
          <PlusIcon className="size-5" aria-hidden="true" />
        </Button>
      </div>
      <FormDescription id={descriptionId} className="px-1 text-xs sm:text-[0.8rem]">
        {DESCRIPTION}
      </FormDescription>
      <FormMessage>{error}</FormMessage>
    </FormItem>
  );
}
