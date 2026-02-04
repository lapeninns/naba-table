'use client';

import { Filter, Printer, Search } from 'lucide-react';

import { OpsPageToolbar } from '@/components/features/ops-shell/patterns/OpsPageToolbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { BookingsFilterBar } from './BookingsFilterBar';

import type { BookingFilter } from './BookingsFilterBar';
import type { ChangeEvent } from 'react';

export type OpsDashboardToolbarProps = {
  filter: BookingFilter;
  tabCounts: { all: number; upcoming: number; seated: number; finished: number; no_show: number };
  searchQuery: string;
  onFilterChange: (filter: BookingFilter) => void;
  onSearchChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onPrint: () => void;
};

export function OpsDashboardToolbar({
  filter,
  tabCounts,
  searchQuery,
  onFilterChange,
  onSearchChange,
  onPrint,
}: OpsDashboardToolbarProps) {
  return (
    <OpsPageToolbar
      sticky
      filters={
        <div className="-mx-2 overflow-x-auto px-2 scrollbar-hide md:mx-0 md:px-0">
          <div className="min-w-max">
            <BookingsFilterBar value={filter} onChange={onFilterChange} counts={tabCounts} />
          </div>
        </div>
      }
      actions={
        <>
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10 shrink-0 bg-card touch-manipulation"
            aria-label="Filter bookings"
          >
            <Filter className="h-4 w-4 text-muted-foreground" aria-hidden />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-10 gap-2 bg-card px-3 text-sm"
            onClick={onPrint}
            aria-label="Print bookings"
          >
            <Printer className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">Print</span>
          </Button>
        </>
      }
      search={
        <div className="relative flex-1 md:w-64 md:flex-none">
          <Search
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            placeholder="Search guests by name…"
            id="ops-dashboard-search"
            name="search"
            aria-label="Search guests"
            value={searchQuery}
            onChange={onSearchChange}
            autoComplete="off"
            className="h-10 w-full rounded-lg border border-border bg-background pl-10 pr-4 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 touch-manipulation"
          />
        </div>
      }
    />
  );
}
