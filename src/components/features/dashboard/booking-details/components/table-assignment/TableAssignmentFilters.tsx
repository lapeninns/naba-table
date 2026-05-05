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
    <Card className="border-border/60 bg-background shadow-sm ring-1 ring-border/5">
      <CardContent className="space-y-4 p-3.5">
        <div className="flex items-center justify-between gap-2 border-b border-border/40 pb-2">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
            <Filter className="h-3 w-3" />
            Inventory Filters
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onResetFilters}
            className="h-6 px-1.5 text-[9px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground"
          >
            Reset
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-2">
          <div className="grid grid-cols-2 gap-2">
            <Select value={zoneFilter} onValueChange={onZoneFilterChange}>
              <SelectTrigger className="h-8 bg-muted/20 text-[11px] font-bold uppercase tracking-wider">
                <SelectValue placeholder="Zone" />
              </SelectTrigger>
              <SelectContent>
                {zoneOptions.map((zone) => (
                  <SelectItem key={zone} value={zone} className="text-xs">
                    {zone === 'all' ? 'All zones' : zone}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={(value) => onSortByChange(value as SortOption)}>
              <SelectTrigger className="h-8 bg-muted/20 text-[11px] font-bold uppercase tracking-wider">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="best" className="text-xs">
                  Best fit
                </SelectItem>
                <SelectItem value="capacity" className="text-xs">
                  Capacity
                </SelectItem>
                <SelectItem value="table" className="text-xs">
                  Number
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between gap-2 rounded-md border border-border/40 bg-muted/5 px-2.5 py-1.5">
            <Label
              htmlFor="availability-only"
              className="cursor-pointer text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80"
            >
              Available Only
            </Label>
            <Switch
              id="availability-only"
              checked={availabilityOnly}
              onCheckedChange={onAvailabilityOnlyChange}
              className="scale-75"
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/50">
            Capacity Fit
          </div>
          <ToggleGroup
            type="single"
            value={fitFilter}
            onValueChange={(value) => {
              if (!value) return;
              onFitFilterChange(value as FitFilter);
            }}
            className="flex flex-wrap justify-start gap-1"
          >
            {FIT_OPTIONS.map((opt) => (
              <ToggleGroupItem
                key={opt.value}
                value={opt.value}
                className="h-7 px-2 text-[10px] font-bold uppercase tracking-tighter"
                variant="outline"
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
