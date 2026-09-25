'use client';

import { Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

import { ALL_ZONES_VALUE, type TableZone } from './tableInventoryModel';
import { TABLE_TOUCH_TARGET_CLASS } from './TableInventoryParts';

import type { TableBookableFilter, TableListFilters } from './tableInventoryDisplayDomain';

const BOOKABLE_OPTIONS: { value: TableBookableFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'bookable', label: 'Bookable' },
  { value: 'not-bookable', label: 'Not bookable' },
];

export type TableInventoryFiltersProps = {
  filters: TableListFilters;
  zoneOptions: Pick<TableZone, 'id' | 'name' | 'active'>[];
  onSearchChange: (query: string) => void;
  onZoneFilterChange: (zoneId: string) => void;
  onBookableFilterChange: (filter: TableBookableFilter) => void;
};

export function TableInventoryFilters({
  filters,
  zoneOptions,
  onSearchChange,
  onZoneFilterChange,
  onBookableFilterChange,
}: TableInventoryFiltersProps) {
  return (
    <div className="grid min-w-0 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,14rem)] 2xl:grid-cols-[minmax(0,1fr)_minmax(0,14rem)_auto]">
      <div className="flex min-w-0 flex-col gap-1.5">
        <Label htmlFor="table-search">Search</Label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            id="table-search"
            type="search"
            value={filters.query}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search table or note"
            autoComplete="off"
            className={cn('pl-9', TABLE_TOUCH_TARGET_CLASS)}
          />
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-1.5">
        <Label htmlFor="table-zone-filter">Zone</Label>
        <Select value={filters.zoneId} onValueChange={onZoneFilterChange}>
          <SelectTrigger id="table-zone-filter" className={cn('w-full', TABLE_TOUCH_TARGET_CLASS)}>
            <SelectValue placeholder="All zones" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_ZONES_VALUE}>All zones</SelectItem>
            {zoneOptions.map((zone) => (
              <SelectItem key={zone.id} value={zone.id}>
                {zone.name}
                {zone.active ? '' : ' (out of service)'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex min-w-0 flex-col gap-1.5 md:col-span-2 2xl:col-span-1">
        <span id="table-bookable-filter-label" className="text-sm font-medium leading-none">
          Show
        </span>
        <div
          role="group"
          aria-labelledby="table-bookable-filter-label"
          className="inline-flex w-full flex-wrap gap-1 rounded-md border bg-muted/40 p-1 sm:w-fit"
        >
          {BOOKABLE_OPTIONS.map((option) => {
            const pressed = filters.bookable === option.value;
            return (
              <Button
                key={option.value}
                type="button"
                size="sm"
                variant={pressed ? 'secondary' : 'ghost'}
                aria-pressed={pressed}
                onClick={() => onBookableFilterChange(option.value)}
                className={cn(
                  'h-7 flex-1 sm:flex-none',
                  pressed && 'bg-background shadow-xs',
                  TABLE_TOUCH_TARGET_CLASS,
                )}
              >
                {option.label}
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
