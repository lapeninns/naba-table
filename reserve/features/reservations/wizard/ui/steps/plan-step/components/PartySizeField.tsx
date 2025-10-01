'use client';

import React from 'react';

import { Button } from '@shared/ui/button';
import { FormDescription, FormItem, FormLabel, FormMessage } from '@shared/ui/form';

const DESCRIPTION = 'Tables of more than 12? Call us and we’ll help.';

export type PartySizeFieldProps = {
  value: number;
  onChange: (direction: 'decrement' | 'increment') => void;
  error?: string;
};

export function PartySizeField({ value, onChange, error }: PartySizeFieldProps) {
  return (
    <FormItem className="space-y-3">
      <FormLabel>Party size</FormLabel>
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => onChange('decrement')}
          aria-label="Decrease guests"
        >
          -
        </Button>
        <div className="text-lg font-semibold" aria-live="polite">
          {value}
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => onChange('increment')}
          aria-label="Increase guests"
        >
          +
        </Button>
      </div>
      <FormDescription>{DESCRIPTION}</FormDescription>
      <FormMessage>{error}</FormMessage>
    </FormItem>
  );
}
