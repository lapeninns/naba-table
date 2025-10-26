'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by status">
      {options.map((option) => (
        <Button
          key={option.value}
          type="button"
          size="sm"
          variant={option.value === value ? 'default' : 'outline'}
          onClick={() => onChange(option.value)}
          aria-pressed={option.value === value}
          className={cn('min-w-[72px]')}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}
