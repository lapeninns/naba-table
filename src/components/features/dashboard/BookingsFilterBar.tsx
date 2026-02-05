'use client';

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

export type BookingFilter = 'all' | 'upcoming' | 'seated' | 'finished' | 'completed' | 'no_show' | 'attention';

const FILTERS: Array<{ value: BookingFilter; label: string; description: string }> = [
  { value: 'all', label: 'All', description: 'All bookings' },
  { value: 'upcoming', label: 'Upcoming', description: 'Expected or pending arrivals' },
  { value: 'seated', label: 'Seated', description: 'Currently seated guests' },
  { value: 'finished', label: 'Finished', description: 'Completed or closed bookings' },
  { value: 'no_show', label: 'No shows', description: 'Marked as no show' },
];

type BookingsFilterBarProps = {
  value: BookingFilter;
  onChange: (value: BookingFilter) => void;
  counts?: Partial<Record<BookingFilter, number>>;
};

export function BookingsFilterBar({ value, onChange, counts }: BookingsFilterBarProps) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(next) => {
        if (!next) return;
        onChange(next as BookingFilter);
      }}
      className="w-full flex-wrap gap-2 py-2 sm:gap-3"
    >
      {FILTERS.map((filter) => (
        <ToggleGroupItem
          key={filter.value}
          value={filter.value}
          className="h-10 w-auto touch-manipulation gap-2 rounded-full border border-border/40 bg-muted/30 px-3 text-xs font-medium text-foreground/70 transition-colors sm:px-4 sm:text-sm data-[state=on]:border-foreground/20 data-[state=on]:bg-foreground/5 data-[state=on]:text-foreground"
          aria-label={filter.description}
        >
          <span>{filter.label}</span>
          {counts && typeof counts[filter.value] === 'number' && counts[filter.value]! > 0 ? (
            <span className="inline-flex min-w-[20px] items-center justify-center rounded-full bg-foreground/10 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-foreground/70">
              {counts[filter.value]}
            </span>
          ) : null}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
