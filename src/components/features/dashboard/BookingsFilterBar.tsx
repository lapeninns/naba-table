'use client';

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

export type BookingFilter = 'all' | 'completed' | 'no_show';

const FILTERS: Array<{ value: BookingFilter; label: string; description: string }> = [
  { value: 'all', label: 'All', description: 'All bookings' },
  { value: 'completed', label: 'Shows', description: 'Completed bookings' },
  { value: 'no_show', label: 'No shows', description: 'Marked as no show' },
];

type BookingsFilterBarProps = {
  value: BookingFilter;
  onChange: (value: BookingFilter) => void;
};

export function BookingsFilterBar({ value, onChange }: BookingsFilterBarProps) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(next) => {
        if (!next) return;
        onChange(next as BookingFilter);
      }}
      className="w-full max-w-md gap-2"
    >
      {FILTERS.map((filter) => (
        <ToggleGroupItem
          key={filter.value}
          value={filter.value}
          className="h-11 flex-1 touch-manipulation gap-2 rounded-full border border-border/60 bg-background text-sm text-muted-foreground transition-colors data-[state=on]:border-primary/40 data-[state=on]:bg-primary/5 data-[state=on]:text-primary data-[state=on]:font-medium"
          aria-label={filter.description}
        >
          {filter.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
