'use client';

import { Plus } from 'lucide-react';

import {
  SETTINGS_COMPACT_CARD_CLASS,
  SETTINGS_COMPACT_CARD_CONTENT_CLASS,
  SETTINGS_COMPACT_CARD_HEADER_CLASS,
} from '@/components/features/restaurant-settings/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

import { TableInventoryDesktopTable } from './TableInventoryDesktopTable';
import {
  countLabel,
  getTableListEmptyState,
  hasActiveTableFilters,
  type TableBookableFilter,
  type TableListFilters,
  type TableZoneGroup,
  type TableZoneLookup,
} from './tableInventoryDisplayDomain';
import { TableInventoryFilters } from './TableInventoryFilters';
import { TableInventoryMobileCards } from './TableInventoryMobileCards';
import { TABLE_TOUCH_TARGET_CLASS } from './TableInventoryParts';

import type { TableZone } from './tableInventoryModel';
import type { TableInventory } from '@/services/ops/tables';

const TABLE_LIST_HEADING_ID = 'table-inventory-heading';

export type TableInventorySectionProps = {
  isLoading: boolean;
  isDeletePending: boolean;
  canDeleteTables: boolean;
  filters: TableListFilters;
  zoneOptions: Pick<TableZone, 'id' | 'name' | 'active'>[];
  zoneLookup: TableZoneLookup;
  totalTables: number;
  shownTables: number;
  groups: TableZoneGroup<TableInventory>[];
  onAddTable: () => void;
  onClearFilters: () => void;
  onEditTable: (table: TableInventory) => void;
  onDeleteTable: (table: TableInventory) => void;
  onSearchChange: (query: string) => void;
  onZoneFilterChange: (zoneId: string) => void;
  onBookableFilterChange: (filter: TableBookableFilter) => void;
};

export function TableInventorySection({
  isLoading,
  isDeletePending,
  canDeleteTables,
  filters,
  zoneOptions,
  zoneLookup,
  totalTables,
  shownTables,
  groups,
  onAddTable,
  onClearFilters,
  onEditTable,
  onDeleteTable,
  onSearchChange,
  onZoneFilterChange,
  onBookableFilterChange,
}: TableInventorySectionProps) {
  const countLine =
    shownTables === totalTables || !hasActiveTableFilters(filters)
      ? countLabel(totalTables, 'table')
      : `Showing ${shownTables.toLocaleString('en-GB')} of ${totalTables.toLocaleString('en-GB')}`;

  return (
    <section
      id="table-inventory"
      aria-labelledby={TABLE_LIST_HEADING_ID}
      className="min-w-0 scroll-mt-28"
    >
      <Card className={cn('w-full overflow-hidden', SETTINGS_COMPACT_CARD_CLASS)}>
        <CardHeader
          className={cn(
            SETTINGS_COMPACT_CARD_HEADER_CLASS,
            'flex flex-col gap-1 space-y-0 border-b border-border/60 bg-muted/30',
          )}
        >
          <h2 id={TABLE_LIST_HEADING_ID} className="text-base font-semibold leading-6">
            Tables
          </h2>
          <p className="text-xs leading-5 text-muted-foreground tabular-nums" aria-live="polite">
            {isLoading ? 'Loading tables' : countLine}
          </p>
          {canDeleteTables ? null : (
            <p className="text-xs leading-5 text-muted-foreground">
              Only owners and managers can delete tables.
            </p>
          )}
        </CardHeader>
        <CardContent
          className={cn(SETTINGS_COMPACT_CARD_CONTENT_CLASS, 'flex min-w-0 flex-col gap-4 pt-4')}
        >
          <TableInventoryFilters
            filters={filters}
            zoneOptions={zoneOptions}
            onSearchChange={onSearchChange}
            onZoneFilterChange={onZoneFilterChange}
            onBookableFilterChange={onBookableFilterChange}
          />

          {isLoading ? (
            <div className="flex flex-col gap-2" aria-busy="true">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : groups.length === 0 ? (
            <TableListEmpty
              totalTables={totalTables}
              zoneCount={zoneOptions.length}
              onAddTable={onAddTable}
              onClearFilters={onClearFilters}
            />
          ) : (
            <>
              <TableInventoryDesktopTable
                groups={groups}
                zoneLookup={zoneLookup}
                canDeleteTables={canDeleteTables}
                isDeletePending={isDeletePending}
                onEditTable={onEditTable}
                onDeleteTable={onDeleteTable}
              />
              <TableInventoryMobileCards
                groups={groups}
                zoneLookup={zoneLookup}
                canDeleteTables={canDeleteTables}
                isDeletePending={isDeletePending}
                onEditTable={onEditTable}
                onDeleteTable={onDeleteTable}
              />
            </>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function TableListEmpty({
  totalTables,
  zoneCount,
  onAddTable,
  onClearFilters,
}: {
  totalTables: number;
  zoneCount: number;
  onAddTable: () => void;
  onClearFilters: () => void;
}) {
  const empty = getTableListEmptyState(totalTables, zoneCount);
  return (
    <div
      className="flex flex-col items-start gap-2 rounded-lg border border-dashed p-4"
      role="status"
    >
      <p className="text-sm font-semibold">{empty.title}</p>
      <p className="text-sm text-muted-foreground">{empty.description}</p>
      {empty.action === 'clear-filters' ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onClearFilters}
          className={TABLE_TOUCH_TARGET_CLASS}
        >
          Clear filters
        </Button>
      ) : empty.action === 'add-table' ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onAddTable}
          className={TABLE_TOUCH_TARGET_CLASS}
        >
          <Plus data-icon="inline-start" aria-hidden />
          Add table
        </Button>
      ) : null}
    </div>
  );
}
