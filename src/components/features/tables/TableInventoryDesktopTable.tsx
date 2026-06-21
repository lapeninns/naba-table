import { Edit, Loader2, Trash2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import {
  formatTablePartySize,
  formatTableSeatingType,
  formatTableStatus,
  getTableAvailabilityLabel,
} from './tableInventoryDisplayDomain';

import type { TableInventory } from '@/services/ops/tables';

export type TableInventoryDesktopTableProps = {
  isLoading: boolean;
  canDeleteTables: boolean;
  isDeletePending: boolean;
  emptyMessage: string;
  filteredTables: TableInventory[];
  onEditTable: (table: TableInventory) => void;
  onDeleteTable: (table: TableInventory) => void;
};

export function TableInventoryDesktopTable({
  isLoading,
  canDeleteTables,
  isDeletePending,
  emptyMessage,
  filteredTables,
  onEditTable,
  onDeleteTable,
}: TableInventoryDesktopTableProps) {
  return (
    <div className="hidden rounded-lg border md:block">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Table</TableHead>
            <TableHead>Zone</TableHead>
            <TableHead>Capacity</TableHead>
            <TableHead>Party size</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Seating</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Active</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableInventoryLoadingRow />
          ) : filteredTables.length === 0 ? (
            <TableInventoryEmptyRow message={emptyMessage} />
          ) : (
            filteredTables.map((table) => (
              <TableInventoryDesktopRow
                key={table.id}
                canDeleteTables={canDeleteTables}
                isDeletePending={isDeletePending}
                onDeleteTable={onDeleteTable}
                onEditTable={onEditTable}
                table={table}
              />
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function TableInventoryLoadingRow() {
  return (
    <TableRow>
      <TableCell colSpan={9} className="py-6 text-center text-muted-foreground">
        <div className="flex items-center justify-center gap-2">
          <Loader2 className="size-4 animate-spin" />
          <span>Loading tables…</span>
        </div>
      </TableCell>
    </TableRow>
  );
}

function TableInventoryEmptyRow({ message }: { message: string }) {
  return (
    <TableRow>
      <TableCell colSpan={9} className="py-10 text-center text-muted-foreground">
        {message}
      </TableCell>
    </TableRow>
  );
}

function TableInventoryDesktopRow({
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
  const availabilityLabel = getTableAvailabilityLabel(table);

  return (
    <TableRow key={table.id} className={table.zoneActive ? undefined : 'bg-muted/60'}>
      <TableCell className="font-medium">
        <span>{table.tableNumber}</span>
      </TableCell>
      <TableCell className="flex items-center gap-2">
        <span>{table.zoneName ?? '—'}</span>
        {table.zoneActive === false && <Badge variant="secondary">Zone off</Badge>}
      </TableCell>
      <TableCell>{table.capacity}</TableCell>
      <TableCell>{formatTablePartySize(table)}</TableCell>
      <TableCell className="capitalize">{table.category}</TableCell>
      <TableCell className="capitalize">
        {formatTableSeatingType(table.seatingType)}
        <span className="text-muted-foreground"> · {table.mobility}</span>
      </TableCell>
      <TableCell>
        <Badge variant={table.status === 'available' ? 'default' : 'secondary'}>
          {formatTableStatus(table.status)}
        </Badge>
      </TableCell>
      <TableCell>
        {availabilityLabel === 'Active' ? (
          <Badge variant="outline">Active</Badge>
        ) : (
          <Badge variant="secondary">{availabilityLabel}</Badge>
        )}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => onEditTable(table)}>
            <Edit data-icon="inline-start" aria-hidden />
            <span className="sr-only">Edit table</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!canDeleteTables || isDeletePending}
            onClick={() => onDeleteTable(table)}
          >
            <Trash2 data-icon="inline-start" className="text-destructive" aria-hidden />
            <span className="sr-only">Delete table</span>
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
