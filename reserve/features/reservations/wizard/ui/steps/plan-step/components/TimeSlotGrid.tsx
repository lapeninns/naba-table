'use client';

import React, { useState } from 'react';

import { Badge } from '@shared/ui/badge';
import { Button } from '@shared/ui/button';
import { FormDescription, FormItem, FormLabel, FormMessage } from '@shared/ui/form';

import type { TimeSlotDescriptor } from '@reserve/features/reservations/wizard/services';

const DESCRIPTION = 'Choose the time that works best for your party.';

export type TimeSlotGridProps = {
  slots: TimeSlotDescriptor[];
  selected: string;
  tooltip: string;
  onSelect: (value: string) => void;
  error?: string;
};

export function TimeSlotGrid({ slots, selected, tooltip, onSelect, error }: TimeSlotGridProps) {
  const [hoveredSlot, setHoveredSlot] = useState<string | null>(null);

  return (
    <FormItem className="space-y-3">
      <FormLabel>Time</FormLabel>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {slots.map((slot) => {
          const isSelected = selected === slot.value;
          const showTooltip = slot.disabled ? tooltip : null;
          const tooltipDelay = hoveredSlot === slot.value ? 0 : 500;

          return (
            <Button
              key={slot.value}
              type="button"
              variant={isSelected ? 'default' : 'outline'}
              className="justify-between"
              disabled={slot.disabled}
              data-state={isSelected ? 'on' : 'off'}
              onMouseEnter={() => setHoveredSlot(slot.value)}
              onMouseLeave={() => setHoveredSlot(null)}
              onFocus={() => setHoveredSlot(slot.value)}
              onBlur={() => setHoveredSlot(null)}
              onClick={() => {
                if (!slot.disabled) {
                  onSelect(slot.value);
                }
              }}
              data-tooltip-id={showTooltip ? 'tooltip' : undefined}
              data-tooltip-content={showTooltip ?? undefined}
              data-tooltip-place={showTooltip ? 'top' : undefined}
              data-tooltip-delay-show={showTooltip ? tooltipDelay : undefined}
            >
              <span>{slot.display}</span>
              <Badge variant="secondary">{slot.label}</Badge>
            </Button>
          );
        })}
      </div>
      <FormDescription>{DESCRIPTION}</FormDescription>
      <FormMessage>{error}</FormMessage>
    </FormItem>
  );
}
