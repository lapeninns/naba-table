import { MinusCircle, Pencil, Trash2 } from 'lucide-react';

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
  formatTableDetails,
  formatTablePartySize,
  getTableBookingStatus,
  type TableZoneGroup,
  type TableZoneLookup,
} from './tableInventoryDisplayDomain';
import {
  TABLE_TOUCH_TARGET_CLASS,
  TableBookingStatusLabel,
  TableIconButton,
} from './TableInventoryParts';

import type { TableInventory } from '@/services/ops/tables';

export type TableInventoryRowActions = {
  canDeleteTables: boolean;
  isDeletePending: boolean;
  onEditTable: (table: TableInventory) => void;
  onDeleteTable: (table: TableInventory) => void;
};

export type TableInventoryDesktopTableProps = TableInventoryRowActions & {
  groups: TableZoneGroup<TableInventory>[];
  zoneLookup: TableZoneLookup;
};

const COLUMN_COUNT = 6;

export function TableInventoryDesktopTable({
  groups,
  zoneLookup,
  ...actions
}: TableInventoryDesktopTableProps) {
  return (
    <div className="hidden min-w-0 overflow-x-auto rounded-lg border md:block">
      <Table>
        <caption className="sr-only">Tables grouped by zone</caption>
        <TableHeader>
          <TableRow>
            <TableHead scope="col">Table</TableHead>
            <TableHead scope="col" className="text-right">
              Seats
            </TableHead>
            <TableHead scope="col">Party size</TableHead>
            <TableHead scope="col">Details</TableHead>
            <TableHead scope="col">Bookings</TableHead>
            <TableHead scope="col">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {groups.map((group) => (
            <TableZoneGroupRows
              key={group.zoneId}
              group={group}
              zoneLookup={zoneLookup}
              actions={actions}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function TableZoneGroupRows({
  group,
  zoneLookup,
  actions,
}: {
  group: TableZoneGroup<TableInventory>;
  zoneLookup: TableZoneLookup;
  actions: TableInventoryRowActions;
}) {
  return (
    <>
      <TableRow className="bg-muted/40 hover:bg-muted/40">
        <TableCell colSpan={COLUMN_COUNT} className="py-2 text-xs font-semibold">
          <span className="inline-flex flex-wrap items-center gap-2">
            {group.zoneName}
            {group.zoneActive ? null : (
              <span className="inline-flex items-center gap-1 font-medium text-muted-foreground">
                <MinusCircle className="size-3" aria-hidden />
                Out of service
              </span>
            )}
          </span>
        </TableCell>
      </TableRow>
      {group.tables.map((table) => (
        <TableRow key={table.id} data-testid={`table-row-${table.id}`}>
          <TableHead scope="row" className="text-sm font-medium text-foreground">
            {table.tableNumber}
          </TableHead>
          <TableCell className="text-right tabular-nums">{table.capacity}</TableCell>
          <TableCell className="tabular-nums">{formatTablePartySize(table)}</TableCell>
          <TableCell className="max-w-64 whitespace-normal text-xs text-muted-foreground">
            {formatTableDetails(table) || '—'}
          </TableCell>
          <TableCell className="whitespace-normal">
            <TableBookingStatusLabel status={getTableBookingStatus(table, zoneLookup)} />
          </TableCell>
          <TableCell>
            <TableRowActions table={table} actions={actions} />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

export function TableRowActions({
  table,
  actions,
}: {
  table: TableInventory;
  actions: TableInventoryRowActions;
}) {
  return (
    <div className="flex items-center justify-end gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => actions.onEditTable(table)}
        aria-label={`Edit table ${table.tableNumber}`}
        className={TABLE_TOUCH_TARGET_CLASS}
      >
        <Pencil data-icon="inline-start" aria-hidden />
        Edit
      </Button>
      {actions.canDeleteTables ? (
        <TableIconButton
          label={`Delete table ${table.tableNumber}`}
          tooltip="Delete table"
          Icon={Trash2}
          destructive
          disabled={actions.isDeletePending}
          onClick={() => actions.onDeleteTable(table)}
        />
      ) : null}
    </div>
  );
}
