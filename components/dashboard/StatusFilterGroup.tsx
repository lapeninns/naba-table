'use client';

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

import type { StatusFilter } from '@/hooks/useBookingsTableState';

export type StatusOption = {
  value: StatusFilter;
  label: string;
};

export type StatusFilterGroupProps = {
  value: StatusFilter;
  options: StatusOption[];
  onChange: (value: StatusFilter) => void;
};

export function StatusFilterGroup({ value, options, onChange }: StatusFilterGroupProps) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      aria-label="Filter by status"
      onValueChange={(next) => {
        if (next) {
          onChange(next as StatusFilter);
        }
      }}
      className="flex flex-wrap items-center gap-1.5 sm:gap-2"
    >
      {options.map((option) => (
        <ToggleGroupItem
          key={option.value}
          value={option.value}
          aria-pressed={option.value === value}
          variant="outline"
          size="sm"
          className="h-11 min-w-[72px] px-3 text-xs sm:h-9 sm:min-w-[72px] sm:text-sm"
        >
          {option.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
