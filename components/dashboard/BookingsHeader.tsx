'use client';

import { OpsBookingsSearchInput } from '@/components/features/bookings/components/OpsBookingsSearchInput';

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
    <div className="flex flex-col gap-3 rounded-xl bg-card/40 p-3 md:flex-row md:items-center md:justify-between md:gap-4 md:p-4">
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

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
        {/* Search Input */}
        <OpsBookingsSearchInput
          value={searchTerm}
          onChange={onSearchChange}
          onClear={() => onSearchChange('')}
          isSearching={isSearching}
          placeholder="Search by guest name or email…"
          ariaLabel="Search bookings"
          size="header"
        />

        {/* Filter Tabs */}
        <StatusFilterGroup value={statusFilter} options={statusOptions} onChange={onStatusFilterChange} />
      </div>
    </div>
  );
}
