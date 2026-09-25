'use client';

import { ConfirmDialog } from '@/components/features/restaurant-settings/ConfirmDialog';

import { countLabel } from './tableInventoryDisplayDomain';

import type { TableZone } from './tableInventoryModel';
import type { ZoneWithTables } from './useTableInventoryDialogState';
import type { TableInventory } from '@/services/ops/tables';

export function TableInventoryConfirmDialogs({
  tableDeleteTarget,
  zoneDeleteTarget,
  zoneWithTables,
  isTableDeletePending,
  isZoneDeletePending,
  onTableOpenChange,
  onZoneOpenChange,
  onZoneWithTablesOpenChange,
  onConfirmTableDelete,
  onConfirmZoneDelete,
  onShowZoneTables,
}: {
  tableDeleteTarget: TableInventory | null;
  zoneDeleteTarget: TableZone | null;
  zoneWithTables: ZoneWithTables | null;
  isTableDeletePending: boolean;
  isZoneDeletePending: boolean;
  onTableOpenChange: (open: boolean) => void;
  onZoneOpenChange: (open: boolean) => void;
  onZoneWithTablesOpenChange: (open: boolean) => void;
  onConfirmTableDelete: () => void;
  onConfirmZoneDelete: () => void;
  onShowZoneTables: (zoneId: string) => void;
}) {
  return (
    <>
      <ConfirmDialog
        open={tableDeleteTarget !== null}
        onOpenChange={onTableOpenChange}
        title={
          tableDeleteTarget ? `Delete table ${tableDeleteTarget.tableNumber}?` : 'Delete table?'
        }
        description="It can no longer be given to bookings. This can’t be undone. To keep it for later, turn it off instead."
        confirmLabel={isTableDeletePending ? 'Deleting…' : 'Delete table'}
        cancelLabel="Keep table"
        tone="destructive"
        onConfirm={onConfirmTableDelete}
      />

      <ConfirmDialog
        open={zoneDeleteTarget !== null}
        onOpenChange={onZoneOpenChange}
        title={zoneDeleteTarget ? `Delete ${zoneDeleteTarget.name}?` : 'Delete zone?'}
        description="The zone has no tables. This can’t be undone."
        confirmLabel={isZoneDeletePending ? 'Deleting…' : 'Delete zone'}
        cancelLabel="Keep zone"
        tone="destructive"
        onConfirm={onConfirmZoneDelete}
      />

      <ConfirmDialog
        open={zoneWithTables !== null}
        onOpenChange={onZoneWithTablesOpenChange}
        title={zoneWithTables ? `${zoneWithTables.zone.name} still has tables` : 'Zone has tables'}
        description={
          zoneWithTables
            ? `Move or delete its ${countLabel(
                zoneWithTables.tableCount,
                'table',
              )} before deleting the zone. To stop bookings for now, take the zone out of service instead.`
            : undefined
        }
        confirmLabel="Show its tables"
        cancelLabel="Close"
        onConfirm={() => {
          if (zoneWithTables) onShowZoneTables(zoneWithTables.zone.id);
        }}
      />
    </>
  );
}
