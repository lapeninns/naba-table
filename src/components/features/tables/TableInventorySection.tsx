'use client';

import { Plus } from 'lucide-react';

import { SettingsCard } from '@/components/features/restaurant-settings/shared';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { TableInventoryDesktopTable } from './TableInventoryDesktopTable';
import {
  getTableInventoryDesktopEmptyMessage,
  getTableInventoryEmptyMessage,
} from './tableInventoryDisplayDomain';
import { TableInventoryFilters } from './TableInventoryFilters';
import { TableInventoryMobileCards } from './TableInventoryMobileCards';
import { type TableStatusFilter, type TableZone } from './tableInventoryModel';

import type { TableInventory } from '@/services/ops/tables';

export type TableInventorySectionProps = {
  isActive: boolean;
  isLoading: boolean;
  isFetching: boolean;
  isAddTableDisabled: boolean;
  isDeletePending: boolean;
  canDeleteTables: boolean;
  selectedZoneId: string;
  tableStatusFilter: TableStatusFilter;
  zoneOptions: Pick<TableZone, 'id' | 'name' | 'active'>[];
  tables: TableInventory[];
  filteredTables: TableInventory[];
  onAddTable: () => void;
  onEditTable: (table: TableInventory) => void;
  onDeleteTable: (table: TableInventory) => void;
  onZoneFilterChange: (zoneId: string) => void;
  onTableStatusFilterChange: (filter: TableStatusFilter) => void;
};

export function TableInventorySection({
  isActive,
  isLoading,
  isFetching,
  isAddTableDisabled,
  isDeletePending,
  canDeleteTables,
  selectedZoneId,
  tableStatusFilter,
  zoneOptions,
  tables,
  filteredTables,
  onAddTable,
  onEditTable,
  onDeleteTable,
  onZoneFilterChange,
  onTableStatusFilterChange,
}: TableInventorySectionProps) {
  const listLoading = isLoading || isFetching;
  const mobileEmptyMessage = getTableInventoryEmptyMessage(tables.length);
  const desktopEmptyMessage = getTableInventoryDesktopEmptyMessage(tables.length);

  return (
    <div
      id="table-inventory"
      hidden={!isActive}
      className={cn('scroll-mt-28', !isActive && 'hidden')}
    >
      <SettingsCard
        title="Table inventory"
        description="Tables tell the booking system how many guests you can seat."
        headerAction={
          <Button size="sm" onClick={onAddTable} disabled={isAddTableDisabled}>
            <Plus data-icon="inline-start" aria-hidden />
            Add table
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          <TableInventoryFilters
            selectedZoneId={selectedZoneId}
            tableStatusFilter={tableStatusFilter}
            zoneOptions={zoneOptions}
            onZoneFilterChange={onZoneFilterChange}
            onTableStatusFilterChange={onTableStatusFilterChange}
          />

          <TableInventoryMobileCards
            canDeleteTables={canDeleteTables}
            emptyMessage={mobileEmptyMessage}
            filteredTables={filteredTables}
            isDeletePending={isDeletePending}
            isLoading={listLoading}
            onDeleteTable={onDeleteTable}
            onEditTable={onEditTable}
          />

          <TableInventoryDesktopTable
            canDeleteTables={canDeleteTables}
            emptyMessage={desktopEmptyMessage}
            filteredTables={filteredTables}
            isDeletePending={isDeletePending}
            isLoading={listLoading}
            onDeleteTable={onDeleteTable}
            onEditTable={onEditTable}
          />
        </div>
      </SettingsCard>
    </div>
  );
}
