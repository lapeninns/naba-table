'use client';

import { Search, X } from 'lucide-react';

import { Input } from '@/components/ui/input';

import { StatusFilterGroup, type StatusOption } from './StatusFilterGroup';

import type { StatusFilter } from '@/hooks/useBookingsTableState';

export type BookingsHeaderProps = {
  title?: string;
  statusFilter: StatusFilter;
  onStatusFilterChange: (status: StatusFilter) => void;
  statusOptions: StatusOption[];
  searchTerm: string;
  onSearchChange: (value: string) => void;
  isSearching?: boolean;
};

export function BookingsHeader({
  title = 'Bookings',
  statusFilter,
  onStatusFilterChange,
  statusOptions,
  searchTerm,
  onSearchChange,
  isSearching = false,
}: BookingsHeaderProps) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <h2 className="text-lg font-medium text-foreground">{title}</h2>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={searchTerm}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search by guest name or email"
            className="h-9 w-full pl-9 pr-10"
            aria-label="Search bookings"
            aria-busy={isSearching}
          />
          {searchTerm ? (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Clear search"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          ) : null}
        </div>
        <StatusFilterGroup value={statusFilter} options={statusOptions} onChange={onStatusFilterChange} />
      </div>
    </div>
  );
}
