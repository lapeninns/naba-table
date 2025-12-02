'use client';

import { Search, X } from 'lucide-react';

import { Input } from '@/components/ui/input';

import { StatusFilterGroup, type StatusOption } from './StatusFilterGroup';

import type { StatusFilter } from '@/hooks/useBookingsTableState';

export type BookingsHeaderProps = {
  title?: string;
  subtitle?: string;
  total?: number | null;
  showTitle?: boolean;
  statusFilter: StatusFilter;
  onStatusFilterChange: (status: StatusFilter) => void;
  statusOptions: StatusOption[];
  searchTerm: string;
  onSearchChange: (value: string) => void;
  isSearching?: boolean;
};

export function BookingsHeader({
  title = 'Bookings',
  subtitle = 'Search, filter, and paginate without losing your place.',
  total = null,
  showTitle = true,
  statusFilter,
  onStatusFilterChange,
  statusOptions,
  searchTerm,
  onSearchChange,
  isSearching = false,
}: BookingsHeaderProps) {
  const countLabel = typeof total === 'number' ? `${total} result${total === 1 ? '' : 's'}` : null;

  return (
    <div className="flex flex-col gap-2 rounded-xl bg-card/40 p-3 md:flex-row md:items-center md:justify-between md:p-4">
      {showTitle ? (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-foreground">{title}</h2>
            {countLabel ? (
              <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">{countLabel}</span>
            ) : null}
          </div>
          {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
      ) : countLabel ? (
        <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">{countLabel}</span>
      ) : (
        <span className="sr-only">Booking filters</span>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={searchTerm}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search by guest name or email"
            className="h-10 w-full rounded-lg border-muted-foreground/20 bg-background pl-10 pr-11 text-sm"
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
