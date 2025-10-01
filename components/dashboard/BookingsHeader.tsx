'use client';

import { StatusFilterGroup, type StatusOption } from './StatusFilterGroup';
import type { StatusFilter } from '@/hooks/useBookingsTableState';

export type BookingsHeaderProps = {
  title?: string;
  statusFilter: StatusFilter;
  onStatusFilterChange: (status: StatusFilter) => void;
  statusOptions: StatusOption[];
};

export function BookingsHeader({
  title = 'Bookings',
  statusFilter,
  onStatusFilterChange,
  statusOptions,
}: BookingsHeaderProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-lg font-medium text-foreground">{title}</h2>
      <StatusFilterGroup value={statusFilter} options={statusOptions} onChange={onStatusFilterChange} />
    </div>
  );
}
