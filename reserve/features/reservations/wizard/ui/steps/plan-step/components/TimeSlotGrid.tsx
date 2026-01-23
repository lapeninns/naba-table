'use client';

import React, { useEffect, useMemo, useRef } from 'react';

import { cn } from '@shared/lib/cn';

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
        <section className="flex flex-col gap-4 rounded-xl border border-border bg-card/80 p-4 shadow-md">
          <div className="flex items-center justify-between">
            <div className="h-5 w-24 animate-pulse rounded-md bg-muted/60" />
            <div className="h-4 w-32 animate-pulse rounded-md bg-muted/60" />
          </div>
          <div className="space-y-4">
            <div className="space-y-2.5">
              <div className="h-4 w-20 animate-pulse rounded-md bg-muted/60" />
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-14 rounded-lg bg-muted/40 animate-pulse"
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
        'flex flex-col gap-4 rounded-xl border border-border bg-gradient-to-br from-card/95 to-card/80 p-4 shadow-md backdrop-blur-sm transition-all duration-300',
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
      <div className="space-y-4 overflow-x-auto pb-1">
        {[...groupedSlots.entries()].map(([label, entries]) => {
          return (
            <div key={label} className="space-y-2.5 min-w-[280px] animate-fade-in">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground sm:text-[0.7rem]">
                  {label}
                </h4>
              </div>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
                {entries.map((slot) => {
                  const isActive = slot.value === activeValue;
                  return (
                    <button
                      key={slot.value}
                      type="button"
                      className={cn(
                        // Base styles - larger on mobile for better touch targets
                        'group relative flex h-14 min-w-[120px] items-center justify-center rounded-lg border text-sm font-semibold transition-all duration-200',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                        'touch-manipulation select-none',
                        // Disabled state
                        slot.disabled &&
                          'cursor-not-allowed border-border/60 bg-muted/40 text-muted-foreground/60',
                        // Active/selected state - enhanced visual feedback
                        !slot.disabled &&
                          isActive &&
                          'border-primary bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-[1.02]',
                        // Default interactive state
                        !slot.disabled &&
                          !isActive &&
                          'border-border bg-card hover:border-primary/60 hover:bg-primary/10 hover:shadow-md active:scale-95',
                        // Smooth scale animation on tap
                        !slot.disabled && 'active:transition-transform active:duration-100',
                      )}
                      aria-pressed={isActive}
                      aria-label={`${slot.display}, ${label}`}
                      disabled={slot.disabled}
                      onClick={() => onSelect(slot.value)}
                      data-slot-value={slot.value}
                      style={{
                        WebkitTapHighlightColor: 'rgba(0,0,0,0)',
                        touchAction: 'manipulation',
                      }}
                    >
                      {/* Subtle gradient overlay for depth */}
                      {!slot.disabled && (
                        <span
                          className={cn(
                            'absolute inset-0 rounded-lg opacity-0 transition-opacity duration-200',
                            isActive
                              ? 'bg-gradient-to-br from-white/10 to-transparent opacity-100'
                              : 'group-hover:opacity-100 bg-gradient-to-br from-primary/5 to-transparent',
                          )}
                          aria-hidden="true"
                        />
                      )}
                      <span className="relative z-10">{slot.display}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
