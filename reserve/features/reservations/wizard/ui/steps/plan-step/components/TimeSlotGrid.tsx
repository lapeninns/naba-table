'use client';

import React, { useEffect, useMemo, useRef } from 'react';

import { cn } from '@shared/lib/cn';
import { Badge } from '@shared/ui/badge';

import type { TimeSlotDescriptor } from '@reserve/features/reservations/wizard/services';

type TimeSlotGridProps = {
  slots: TimeSlotDescriptor[];
  value: string;
  onSelect: (value: string) => void;
  scrollToValue?: string | null;
};

function buildGroups(slots: TimeSlotDescriptor[]) {
  const groups = new Map<string, TimeSlotDescriptor[]>();
  slots.forEach((slot) => {
    const existing = groups.get(slot.label);
    if (existing) {
      existing.push(slot);
    } else {
      groups.set(slot.label, [slot]);
    }
  });
  return groups;
}

export function TimeSlotGrid({ slots, value, onSelect, scrollToValue }: TimeSlotGridProps) {
  const groupedSlots = useMemo(() => buildGroups(slots), [slots]);
  const activeValue = value;
  const containerRef = useRef<HTMLDivElement>(null);
  const lastScrolledValueRef = useRef<string | null>(null);

  useEffect(() => {
    if (!scrollToValue) {
      return;
    }
    if (lastScrolledValueRef.current === scrollToValue) {
      return;
    }
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const target = container.querySelector<HTMLElement>(`[data-slot-value="${scrollToValue}"]`);
    if (!target) {
      return;
    }
    lastScrolledValueRef.current = scrollToValue;
    target.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
  }, [scrollToValue, slots]);

  if (slots.length === 0) {
    return null;
  }

  return (
    <section
      aria-label="Available times"
      className="flex flex-col gap-3 rounded-xl border border-border bg-card/80 p-4 shadow-sm"
      ref={containerRef}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Pick a time</h3>
        <p className="text-xs text-muted-foreground" aria-live="polite">
          Showing {slots.length} {slots.length === 1 ? 'option' : 'options'}
        </p>
      </div>
      {[...groupedSlots.entries()].map(([label, entries]) => (
        <div key={label} className="space-y-2">
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              {label}
            </h4>
            {entries[0]?.availability.labels.happyHour ? (
              <Badge variant="secondary" className="text-[11px] font-medium">
                Happy hour
              </Badge>
            ) : null}
            {entries[0]?.availability.labels.drinksOnly ? (
              <Badge variant="outline" className="text-[11px] font-medium">
                Drinks only
              </Badge>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {entries.map((slot) => {
              const isActive = slot.value === activeValue;
              return (
                <button
                  key={slot.value}
                  type="button"
                  className={cn(
                    'flex h-12 items-center justify-center rounded-lg border text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                    'touch-manipulation',
                    slot.disabled
                      ? 'cursor-not-allowed border-border/60 bg-muted text-muted-foreground'
                      : isActive
                        ? 'border-primary bg-primary text-primary-foreground hover:bg-primary/90'
                        : 'border-border bg-card hover:border-primary/60 hover:bg-primary/10',
                  )}
                  aria-pressed={isActive}
                  aria-label={`${slot.display}, ${label}`}
                  disabled={slot.disabled}
                  onClick={() => onSelect(slot.value)}
                  data-slot-value={slot.value}
                  style={{ WebkitTapHighlightColor: 'rgba(0,0,0,0)', touchAction: 'manipulation' }}
                >
                  {slot.display}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </section>
  );
}
