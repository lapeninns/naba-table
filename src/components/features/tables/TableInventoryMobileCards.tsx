import { TableRowActions, type TableInventoryRowActions } from './TableInventoryDesktopTable';
import {
  formatTableDetails,
  formatTablePartySize,
  getTableBookingStatus,
  type TableZoneGroup,
  type TableZoneLookup,
} from './tableInventoryDisplayDomain';
import { TableBookingStatusLabel } from './TableInventoryParts';

import type { TableInventory } from '@/services/ops/tables';

export type TableInventoryMobileCardsProps = TableInventoryRowActions & {
  groups: TableZoneGroup<TableInventory>[];
  zoneLookup: TableZoneLookup;
};

export function TableInventoryMobileCards({
  groups,
  zoneLookup,
  ...actions
}: TableInventoryMobileCardsProps) {
  return (
    <div className="flex min-w-0 flex-col gap-4 md:hidden">
      {groups.map((group) => (
        <section key={group.zoneId} aria-label={group.zoneName} className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold text-muted-foreground">
            {group.zoneName}
            {group.zoneActive ? '' : ' · out of service'}
          </h3>
          <ul className="flex flex-col gap-2">
            {group.tables.map((table) => {
              const details = formatTableDetails(table);
              return (
                <li
                  key={table.id}
                  className="flex min-w-0 flex-col gap-2 rounded-lg border bg-card p-3"
                  data-testid={`table-card-${table.id}`}
                >
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <p className="text-sm font-semibold">Table {table.tableNumber}</p>
                    <p className="break-words text-xs leading-5 text-muted-foreground tabular-nums">
                      {table.capacity} {table.capacity === 1 ? 'seat' : 'seats'} · parties of{' '}
                      {formatTablePartySize(table)}
                      {details ? ` · ${details}` : ''}
                    </p>
                  </div>
                  <TableBookingStatusLabel status={getTableBookingStatus(table, zoneLookup)} />
                  <TableRowActions table={table} actions={actions} />
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
