'use client';

import { MinusIcon, PlusIcon, UsersIcon } from 'lucide-react';
import React from 'react';

import { Button } from '@shared/ui/button';
import { FormDescription, FormItem, FormMessage } from '@shared/ui/form';
import { Label } from '@shared/ui/label';

const DESCRIPTION = "Tables for 12+? Give us a call and we'll help you out.";

export type PartySizeFieldProps = {
  value: number;
  onChange: (direction: 'decrement' | 'increment') => void;
  error?: string;
};

export function PartySizeField({ value, onChange, error }: PartySizeFieldProps) {
  const [isAnimating, setIsAnimating] = React.useState(false);
  const labelId = React.useId();

  const handleChange = (direction: 'decrement' | 'increment') => {
    setIsAnimating(true);
    onChange(direction);
    setTimeout(() => setIsAnimating(false), 200);
  };

  return (
    <FormItem className="space-y-3">
      <Label id={labelId} className="flex items-center gap-1.5 text-sm font-semibold sm:text-base">
        <UsersIcon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <span>Party size</span>
      </Label>
      <div className="flex items-center gap-4 sm:gap-5" role="group" aria-labelledby={labelId}>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => handleChange('decrement')}
          aria-label="Decrease guests"
          className="h-12 w-12 shrink-0 transition-all hover:bg-primary/10 hover:border-primary/60 active:scale-95"
        >
          <MinusIcon className="h-5 w-5" aria-hidden="true" />
        </Button>
        <div
          className="flex min-w-[60px] items-center justify-center"
          aria-live="polite"
          aria-atomic="true"
        >
          <span
            className={`text-2xl font-bold text-foreground tabular-nums transition-transform duration-200 sm:text-3xl ${
              isAnimating ? 'scale-110' : 'scale-100'
            }`}
          >
            {value}
          </span>
          <span className="ml-2 text-sm text-muted-foreground font-normal sm:text-base">
            {value === 1 ? 'guest' : 'guests'}
          </span>
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => handleChange('increment')}
          aria-label="Increase guests"
          className="h-12 w-12 shrink-0 transition-all hover:bg-primary/10 hover:border-primary/60 active:scale-95"
        >
          <PlusIcon className="h-5 w-5" aria-hidden="true" />
        </Button>
      </div>
      <FormDescription className="text-xs sm:text-sm">{DESCRIPTION}</FormDescription>
      <FormMessage>{error}</FormMessage>
    </FormItem>
  );
}
