'use client';

import React from 'react';

import { Badge } from '@shared/ui/badge';
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
        className="grid grid-cols-3 gap-2"
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
            >
              {SERVICE_LABELS[option]}
            </ToggleGroupItem>
          );
        })}
      </ToggleGroup>
      <div className="flex flex-wrap gap-2 text-xs text-srx-ink-soft">
        {availability.labels.happyHour ? (
          <Badge variant="outline">Happy hour selected</Badge>
        ) : null}
        {availability.labels.drinksOnly ? <Badge variant="outline">Drinks only</Badge> : null}
        {availability.labels.kitchenClosed ? (
          <Badge variant="destructive">Kitchen closed</Badge>
        ) : null}
      </div>
      <FormDescription>{DESCRIPTION}</FormDescription>
      <FormMessage>{error}</FormMessage>
    </FormItem>
  );
}
