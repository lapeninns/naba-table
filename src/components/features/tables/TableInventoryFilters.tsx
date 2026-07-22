import { SETTINGS_COMPACT_FILTER_BAR_CLASS } from '@/components/features/restaurant-settings/shared';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Text } from '@/components/ui/typography';
import { cn } from '@/lib/utils';

import { ALL_ZONES_VALUE, type TableStatusFilter, type TableZone } from './tableInventoryModel';

export type TableInventoryFiltersProps = {
  selectedZoneId: string;
  tableStatusFilter: TableStatusFilter;
  zoneOptions: Pick<TableZone, 'id' | 'name' | 'active'>[];
  onZoneFilterChange: (zoneId: string) => void;
  onTableStatusFilterChange: (filter: TableStatusFilter) => void;
};

export function TableInventoryFilters({
  selectedZoneId,
  tableStatusFilter,
  zoneOptions,
  onZoneFilterChange,
  onTableStatusFilterChange,
}: TableInventoryFiltersProps) {
  return (
    <div
      className={cn(
        SETTINGS_COMPACT_FILTER_BAR_CLASS,
        'md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]',
      )}
    >
      <div className="md:col-span-2">
        <p className="text-sm font-semibold text-foreground">Inventory filters</p>
        <Text variant="caption">
          Add tables with number and capacity first; zones and classification can come later.
        </Text>
      </div>
      <div className="flex items-center gap-3">
        <Label htmlFor="table-zone-filter" className="text-sm font-medium">
          Zone
        </Label>
        <Select value={selectedZoneId} onValueChange={onZoneFilterChange}>
          <SelectTrigger id="table-zone-filter" className="w-full md:w-[220px]">
            <SelectValue placeholder="All zones" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_ZONES_VALUE}>All zones</SelectItem>
            {zoneOptions.map((zone) => (
              <SelectItem key={zone.id} value={zone.id}>
                {zone.name}
                {zone.active ? '' : ' (inactive)'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-3">
        <Label htmlFor="table-status-filter" className="text-sm font-medium">
          Status
        </Label>
        <Select
          value={tableStatusFilter}
          onValueChange={(value) => onTableStatusFilterChange(value as TableStatusFilter)}
        >
          <SelectTrigger id="table-status-filter" className="w-full md:w-[200px]">
            <SelectValue placeholder="All tables" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active tables only</SelectItem>
            <SelectItem value="inactive">Inactive tables only</SelectItem>
            <SelectItem value="all">All tables</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
