'use client';

import React from 'react';

import { FormDescription, FormItem, FormLabel, FormMessage } from '@shared/ui/form';
import { ToggleGroup, ToggleGroupItem } from '@shared/ui/toggle-group';

import type {
  BookingOption,
  ServiceAvailability,
} from '@reserve/features/reservations/wizard/services';

const DESCRIPTION = 'Let us know the occasion so we can tailor the experience.';

const SERVICE_LABELS: Record<BookingOption, string> = {
  lunch: 'Lunch',
  dinner: 'Dinner',
  drinks: 'Drinks & cocktails',
};

export type OccasionPickerProps = {
  value: BookingOption;
  order: BookingOption[];
  availability: ServiceAvailability;
  onChange: (value: BookingOption) => void;
  error?: string;
};

export function OccasionPicker({
  value,
  order,
  availability,
  onChange,
  error,
}: OccasionPickerProps) {
  return (
    <FormItem className="space-y-3">
      <FormLabel>Occasion</FormLabel>
      <ToggleGroup
        type="single"
        className="grid grid-cols-2 gap-2 sm:grid-cols-3"
        value={value}
        onValueChange={(next) => {
          if (next) onChange(next as BookingOption);
        }}
      >
        {order.map((option) => {
          const enabled = availability.services[option] === 'enabled';
          return (
            <ToggleGroupItem
              key={option}
              value={option}
              aria-disabled={!enabled}
              disabled={!enabled}
              className="h-11"
            >
              {SERVICE_LABELS[option]}
            </ToggleGroupItem>
          );
        })}
      </ToggleGroup>
      <FormDescription>{DESCRIPTION}</FormDescription>
      <FormMessage>{error}</FormMessage>
    </FormItem>
  );
}
