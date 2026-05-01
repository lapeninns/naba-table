'use client';

import React, { useEffect, useMemo, useRef } from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@shared/lib/cn';
import { ToggleGroup, ToggleGroupItem } from '@shared/ui/toggle-group';

import type { TimeSlotDescriptor } from '@reserve/features/reservations/wizard/services';

type TimeSlotGridProps = {
  slots: TimeSlotDescriptor[];
  value: string;
  onSelect: (value: string) => void;
  scrollToValue?: string | null;
  loading?: boolean;
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

export function TimeSlotGrid({
  slots,
  value,
  onSelect,
  scrollToValue,
  loading,
}: TimeSlotGridProps) {
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
    if (loading) {
      return (
        <section className="pg-card flex flex-col gap-4 p-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2.5">
              <Skeleton className="h-4 w-20" />
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton
                    key={i}
                    className="h-14 rounded-lg"
                    style={{ animationDelay: `${i * 50}ms` }}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>
      );
    }
    return null;
  }

  return (
    <section
      aria-label="Available times"
      className={cn(
        'pg-card flex flex-col gap-4 p-4 backdrop-blur-sm transition-all duration-300',
        loading && 'opacity-50 pointer-events-none',
      )}
      ref={containerRef}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground sm:text-base">Pick a time</h3>
        <p className="text-xs text-muted-foreground sm:text-sm" aria-live="polite">
          {slots.length} {slots.length === 1 ? 'option' : 'options'}
        </p>
      </div>
      <ToggleGroup
        type="single"
        value={activeValue}
        onValueChange={(next) => {
          if (next) {
            onSelect(next);
          }
        }}
        className="block space-y-4 overflow-x-auto pb-1"
        aria-label="Available reservation times"
      >
        {[...groupedSlots.entries()].map(([label, entries]) => {
          return (
            <div key={label} className="pg-appear min-w-[280px] space-y-2.5">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground sm:text-[0.7rem]">
                  {label}
                </h4>
              </div>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
                {entries.map((slot) => {
                  const isActive = slot.value === activeValue;
                  return (
                    <ToggleGroupItem
                      key={slot.value}
                      value={slot.value}
                      variant="outline"
                      size="lg"
                      className={cn(
                        'group relative h-14 min-w-[120px] rounded-lg text-sm font-semibold touch-manipulation',
                        'data-[state=on]:scale-[1.02] data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground',
                        slot.disabled &&
                          'cursor-not-allowed border-border/60 bg-muted/40 text-muted-foreground/60',
                        !slot.disabled &&
                          !isActive &&
                          'border-border bg-card hover:border-primary/60 hover:bg-primary/10 active:scale-95',
                        !slot.disabled && 'active:transition-transform active:duration-100',
                      )}
                      aria-label={`${slot.display}, ${label}`}
                      disabled={slot.disabled}
                      data-slot-value={slot.value}
                    >
                      {!slot.disabled && (
                        <span
                          className={cn(
                            'absolute inset-0 rounded-lg opacity-0 transition-opacity duration-200',
                            isActive
                              ? 'bg-gradient-to-br from-primary-foreground/10 to-transparent opacity-100'
                              : 'group-hover:opacity-100 bg-gradient-to-br from-primary/5 to-transparent',
                          )}
                          aria-hidden="true"
                        />
                      )}
                      <span className="relative z-10">{slot.display}</span>
                    </ToggleGroupItem>
                  );
                })}
              </div>
            </div>
          );
        })}
      </ToggleGroup>
    </section>
  );
}
