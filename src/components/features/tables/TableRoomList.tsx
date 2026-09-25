'use client';

import { Check, Minus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

import { getTableBookingStatus, type TableZoneLookup } from './tableInventoryDisplayDomain';
import {
  getShortBlockLabel,
  getTableLargestParty,
  isMovableTable,
  matchesRoomFilters,
  type RoomFilters,
} from './tableRoomDomain';
import { BARE_BUTTON_CLASS, LINK_BUTTON_CLASS, LockIcon } from './TableRoomParts';

import type { TableZone } from './tableInventoryModel';
import type { TableInventory } from '@/services/ops/tables';

const CELL = 'whitespace-nowrap border-t border-border px-3 py-2 text-left text-sm font-normal';

/** Every table in one sortable-looking list, zone by zone; rows open the table like tiles. */
export function TableRoomList({
  zones,
  tables,
  lookup,
  filters,
  selectedTableId,
  onSelectTable,
  onClearFilters,
}: {
  zones: TableZone[];
  tables: ReadonlyArray<TableInventory>;
  lookup: TableZoneLookup;
  filters: RoomFilters;
  selectedTableId: string | null;
  onSelectTable: (table: TableInventory) => void;
  onClearFilters: () => void;
}) {
  const rows = zones.flatMap((zone) =>
    tables
      .filter((table) => table.zoneId === zone.id && matchesRoomFilters(table, filters, lookup))
      .sort((a, b) => a.tableNumber.localeCompare(b.tableNumber, 'en-GB', { numeric: true }))
      .map((table) => ({ table, zone })),
  );

  return (
    <div className="rounded-md border border-border bg-background" data-testid="tables-list">
      <Table className="border-collapse">
        <TableCaption className="sr-only">All tables</TableCaption>
        <TableHeader className="[&_tr]:border-b-0">
          <TableRow className="text-xs hover:bg-transparent">
            {['Table', 'Zone', 'Seats', 'Parties', 'Joining', 'Bookings', 'Notes'].map(
              (heading) => (
                <TableHead
                  key={heading}
                  scope="col"
                  className={cn(
                    'h-auto whitespace-nowrap px-3 py-2 text-left text-xs font-medium text-muted-foreground',
                    heading === 'Seats' && 'text-right',
                  )}
                >
                  {heading}
                </TableHead>
              ),
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={7} className={cn(CELL, 'text-muted-foreground')}>
                No tables match.{' '}
                <Button
                  type="button"
                  variant="ghost"
                  onClick={onClearFilters}
                  className={LINK_BUTTON_CLASS}
                >
                  Clear filters
                </Button>
              </TableCell>
            </TableRow>
          ) : (
            rows.map(({ table, zone }) => {
              const status = getTableBookingStatus(table, lookup);
              const selected = selectedTableId === table.id;
              return (
                <TableRow
                  key={table.id}
                  aria-selected={selected}
                  onClick={() => onSelectTable(table)}
                  className="cursor-pointer border-b-0 hover:bg-muted"
                >
                  <TableHead
                    scope="row"
                    className={cn(
                      CELL,
                      'h-auto text-foreground',
                      selected && 'shadow-[inset_3px_0_0_var(--color-primary)]',
                    )}
                  >
                    <Button
                      type="button"
                      variant="ghost"
                      id={`row-${table.id}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        onSelectTable(table);
                      }}
                      className={cn(
                        BARE_BUTTON_CLASS,
                        'min-h-6 font-semibold text-foreground hover:bg-transparent',
                      )}
                    >
                      {table.tableNumber}
                    </Button>
                  </TableHead>
                  <TableCell className={CELL}>{zone.name}</TableCell>
                  <TableCell className={cn(CELL, 'text-right tabular-nums')}>
                    {table.capacity}
                  </TableCell>
                  <TableCell className={cn(CELL, 'tabular-nums')}>
                    {table.minPartySize || 1}–{getTableLargestParty(table)}
                  </TableCell>
                  <TableCell className={CELL}>
                    {isMovableTable(table) ? (
                      'Movable'
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        <LockIcon /> Fixed
                      </span>
                    )}
                  </TableCell>
                  <TableCell className={CELL}>
                    {status.bookable ? (
                      <span className="inline-flex items-center gap-1">
                        <Check className="size-4" aria-hidden /> Bookable
                      </span>
                    ) : (
                      <b className="inline-flex items-center gap-1">
                        <Minus className="size-4" aria-hidden />
                        {getShortBlockLabel(status.reason)}
                      </b>
                    )}
                  </TableCell>
                  <TableCell
                    className={cn(CELL, 'whitespace-normal text-xs text-muted-foreground')}
                  >
                    {table.notes?.trim() || '—'}
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
