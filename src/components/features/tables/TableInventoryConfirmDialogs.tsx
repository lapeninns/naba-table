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
  onTakeZoneOutOfService,
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
  onTakeZoneOutOfService: (zone: TableZone) => void;
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
        confirmLabel="Delete table"
        pending={isTableDeletePending}
        pendingLabel="Deleting…"
        tone="destructive"
        onConfirm={onConfirmTableDelete}
      />

      <ConfirmDialog
        open={zoneDeleteTarget !== null}
        onOpenChange={onZoneOpenChange}
        title={zoneDeleteTarget ? `Delete ${zoneDeleteTarget.name}?` : 'Delete zone?'}
        description="It has no tables. This can’t be undone."
        confirmLabel="Delete zone"
        pending={isZoneDeletePending}
        pendingLabel="Deleting…"
        tone="destructive"
        onConfirm={onConfirmZoneDelete}
      />

      <ConfirmDialog
        open={zoneWithTables !== null}
        onOpenChange={onZoneWithTablesOpenChange}
        title={zoneWithTables ? `${zoneWithTables.zone.name} still has tables` : 'Zone has tables'}
        description={
          zoneWithTables
            ? `Move its ${countLabel(
                zoneWithTables.tableCount,
                'table',
              )} to another zone, or delete them, before deleting the zone. To stop bookings for now, turn the zone out of service instead.`
            : undefined
        }
        cancelLabel="Close"
        confirmLabel="Take out of service"
        // A zone already out of service has nothing to take out.
        confirmDisabled={!zoneWithTables?.zone.active}
        onConfirm={() => {
          if (!zoneWithTables) return;
          onZoneWithTablesOpenChange(false);
          onTakeZoneOutOfService(zoneWithTables.zone);
        }}
      />
    </>
  );
}
