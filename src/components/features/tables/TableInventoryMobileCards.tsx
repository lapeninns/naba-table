import { Edit, Loader2, Trash2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import {
  formatTablePartySize,
  formatTableSeatingType,
  formatTableStatus,
  getTableAvailabilityLabel,
} from './tableInventoryDisplayDomain';

import type { TableInventory } from '@/services/ops/tables';

export type TableInventoryMobileCardsProps = {
  isLoading: boolean;
  canDeleteTables: boolean;
  isDeletePending: boolean;
  emptyMessage: string;
  filteredTables: TableInventory[];
  onEditTable: (table: TableInventory) => void;
  onDeleteTable: (table: TableInventory) => void;
};

export function TableInventoryMobileCards({
  isLoading,
  canDeleteTables,
  isDeletePending,
  emptyMessage,
  filteredTables,
  onEditTable,
  onDeleteTable,
}: TableInventoryMobileCardsProps) {
  if (isLoading) {
    return (
      <div className="grid gap-3 md:hidden">
        <div className="rounded-lg border p-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            <span>Loading tables…</span>
          </div>
        </div>
      </div>
    );
  }

  if (filteredTables.length === 0) {
    return (
      <div className="grid gap-3 md:hidden">
        <div className="rounded-lg border p-4 text-sm text-muted-foreground">{emptyMessage}</div>
      </div>
    );
  }

  return (
    <div className="grid gap-3 md:hidden">
      {filteredTables.map((table) => (
        <TableInventoryMobileCard
          key={table.id}
          canDeleteTables={canDeleteTables}
          isDeletePending={isDeletePending}
          onDeleteTable={onDeleteTable}
          onEditTable={onEditTable}
          table={table}
        />
      ))}
    </div>
  );
}

function TableInventoryMobileCard({
  canDeleteTables,
  isDeletePending,
  onDeleteTable,
  onEditTable,
  table,
}: {
  canDeleteTables: boolean;
  isDeletePending: boolean;
  onEditTable: (table: TableInventory) => void;
  onDeleteTable: (table: TableInventory) => void;
  table: TableInventory;
}) {
  return (
    <article
      className={cn(
        'rounded-lg border bg-card p-4 shadow-sm',
        table.zoneActive === false && 'bg-muted/60',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-foreground">
            Table {table.tableNumber}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {table.zoneName ?? 'No zone'} · {table.capacity} covers
          </p>
        </div>
        <Badge variant={table.status === 'available' ? 'default' : 'secondary'}>
          {formatTableStatus(table.status)}
        </Badge>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <TableInventoryMobileStat label="Party size" value={formatTablePartySize(table)} />
        <TableInventoryMobileStat
          label="Seating"
          value={formatTableSeatingType(table.seatingType)}
          capitalize
        />
        <TableInventoryMobileStat label="Category" value={table.category} capitalize />
        <TableInventoryMobileStat label="Availability" value={getTableAvailabilityLabel(table)} />
      </dl>
      <div className="mt-4 flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={() => onEditTable(table)}
        >
          <Edit data-icon="inline-start" aria-hidden />
          Edit
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="flex-1 text-destructive"
          disabled={!canDeleteTables || isDeletePending}
          onClick={() => onDeleteTable(table)}
        >
          <Trash2 data-icon="inline-start" aria-hidden />
          Delete
        </Button>
      </div>
    </article>
  );
}

function TableInventoryMobileStat({
  label,
  value,
  capitalize = false,
}: {
  label: string;
  value: string;
  capitalize?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn('font-medium text-foreground', capitalize && 'capitalize')}>{value}</dd>
    </div>
  );
}
