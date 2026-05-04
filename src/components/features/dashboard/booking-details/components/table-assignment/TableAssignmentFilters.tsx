'use client';

import { Filter } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';

type FitFilter = 'all' | 'perfect' | 'exact' | 'within' | 'oversized' | 'too_small';
type SortOption = 'best' | 'capacity' | 'table';

export type TableAssignmentFiltersProps = {
  zoneOptions: string[];
  zoneFilter: string;
  onZoneFilterChange: (value: string) => void;
  sortBy: SortOption;
  onSortByChange: (value: SortOption) => void;
  availabilityOnly: boolean;
  onAvailabilityOnlyChange: (value: boolean) => void;
  fitFilter: FitFilter;
  onFitFilterChange: (value: FitFilter) => void;
  onResetFilters: () => void;
};

const FIT_OPTIONS: Array<{ value: FitFilter; label: string }> = [
  { value: 'all', label: 'All fits' },
  { value: 'perfect', label: 'Perfect' },
  { value: 'exact', label: 'Exact' },
  { value: 'within', label: 'Comfort' },
  { value: 'oversized', label: 'Large' },
  { value: 'too_small', label: 'Small' },
];

export function TableAssignmentFilters({
  zoneOptions,
  zoneFilter,
  onZoneFilterChange,
  sortBy,
  onSortByChange,
  availabilityOnly,
  onAvailabilityOnlyChange,
  fitFilter,
  onFitFilterChange,
  onResetFilters,
}: TableAssignmentFiltersProps) {
  return (
    <Card className="border-border bg-background shadow-sm">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Filter className="h-3.5 w-3.5" aria-hidden />
            Filters
          </div>
          <Button variant="ghost" size="sm" onClick={onResetFilters} className="h-8">
            Reset
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={zoneFilter} onValueChange={onZoneFilterChange}>
            <SelectTrigger
              aria-label="Zone filter"
              className="h-9 w-full sm:w-[140px] text-sm bg-background"
            >
              <SelectValue placeholder="Zone" />
            </SelectTrigger>
            <SelectContent>
              {zoneOptions.map((zone) => (
                <SelectItem key={zone} value={zone} className="text-sm">
                  {zone === 'all' ? 'All zones' : zone}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={(value) => onSortByChange(value as SortOption)}>
            <SelectTrigger
              aria-label="Sort tables"
              className="h-9 w-full sm:w-[140px] text-sm bg-background"
            >
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="best" className="text-sm">
                Best fit
              </SelectItem>
              <SelectItem value="capacity" className="text-sm">
                Capacity
              </SelectItem>
              <SelectItem value="table" className="text-sm">
                Table number
              </SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2">
            <Switch
              id="availability-only"
              checked={availabilityOnly}
              onCheckedChange={onAvailabilityOnlyChange}
            />
            <Label
              htmlFor="availability-only"
              className="text-sm font-medium text-muted-foreground cursor-pointer select-none"
            >
              Available only
            </Label>
          </div>
        </div>

        <div className="overflow-x-auto pb-1">
          <ToggleGroup
            type="single"
            value={fitFilter}
            onValueChange={(value) => {
              if (!value) return;
              onFitFilterChange(value as FitFilter);
            }}
            aria-label="Capacity fit filter"
            className={cn('justify-start flex-nowrap w-max')}
          >
            {FIT_OPTIONS.map((opt) => (
              <ToggleGroupItem
                key={opt.value}
                value={opt.value}
                variant="outline"
                className="h-9 px-3 text-sm"
              >
                {opt.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </CardContent>
    </Card>
  );
}

export default TableAssignmentFilters;
