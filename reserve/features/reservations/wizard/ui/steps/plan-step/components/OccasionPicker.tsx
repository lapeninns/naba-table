'use client';

import { SparklesIcon } from 'lucide-react';
import React from 'react';

import { FormDescription, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

import type { ServiceAvailability } from '@reserve/features/reservations/wizard/services';
import type { OccasionKey } from '@reserve/shared/occasions';

const DESCRIPTION = 'Let us know the occasion so we can tailor your experience.';

export type OccasionPickerOption = {
  key: OccasionKey;
  label: string;
  description?: string | null;
};

export type OccasionPickerProps = {
  value: OccasionKey;
  options: OccasionPickerOption[];
  availability: ServiceAvailability;
  availableOptions: OccasionKey[];
  onChange: (value: OccasionKey) => void;
  error?: string;
};

export function OccasionPicker({
  value,
  options,
  availability: _availability,
  availableOptions,
  onChange,
  error,
}: OccasionPickerProps) {
  const allowed = React.useMemo(() => new Set(availableOptions), [availableOptions]);
  const services = React.useMemo(
    () => new Map(Object.entries(_availability.services)),
    [_availability.services],
  );

  return (
    <FormItem className="space-y-3">
      <FormLabel className="flex items-center gap-1.5 text-sm font-semibold sm:text-base">
        <SparklesIcon className="size-4 text-muted-foreground" aria-hidden="true" />
        <span>Occasion</span>
      </FormLabel>
      <ToggleGroup
        type="single"
        className="grid grid-cols-2 gap-2.5 sm:grid-cols-3"
        value={value}
        onValueChange={(next) => {
          if (next) onChange(next as OccasionKey);
        }}
      >
        {options.map((option) => {
          const serviceState = services.get(option.key) ?? 'disabled';
          const enabled = allowed.has(option.key) && serviceState === 'enabled';
          const ariaDisabled = !enabled;
          return (
            <ToggleGroupItem
              key={option.key}
              value={option.key}
              aria-disabled={ariaDisabled}
              disabled={ariaDisabled}
              className="pg-action h-12 text-sm font-medium data-[state=on]:bg-primary data-[state=on]:text-primary-foreground hover:bg-primary/10 active:scale-95"
            >
              {option.label}
            </ToggleGroupItem>
          );
        })}
      </ToggleGroup>
      <FormDescription className="text-xs sm:text-sm">{DESCRIPTION}</FormDescription>
      <FormMessage>{error}</FormMessage>
    </FormItem>
  );
}
