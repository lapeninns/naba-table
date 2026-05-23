'use client';

import { ConfirmDialog } from '@/components/features/restaurant-settings/ConfirmDialog';

import type { TableZone } from './tableInventoryModel';
import type { TableInventory } from '@/services/ops/tables';

export function TableInventoryConfirmDialogs({
  tableDeleteTarget,
  zoneDeleteTarget,
  isTableDeletePending,
  isZoneDeletePending,
  onTableOpenChange,
  onZoneOpenChange,
  onConfirmTableDelete,
  onConfirmZoneDelete,
}: {
  tableDeleteTarget: TableInventory | null;
  zoneDeleteTarget: TableZone | null;
  isTableDeletePending: boolean;
  isZoneDeletePending: boolean;
  onTableOpenChange: (open: boolean) => void;
  onZoneOpenChange: (open: boolean) => void;
  onConfirmTableDelete: () => void;
  onConfirmZoneDelete: () => void;
}) {
  return (
    <>
      <ConfirmDialog
        open={tableDeleteTarget !== null}
        onOpenChange={onTableOpenChange}
        title="Delete table?"
        description={
          tableDeleteTarget
            ? `Table ${tableDeleteTarget.tableNumber} will be removed from inventory and can no longer be assigned to bookings. This cannot be undone.`
            : undefined
        }
        confirmLabel={isTableDeletePending ? 'Deleting…' : 'Delete table'}
        cancelLabel="Keep table"
        tone="destructive"
        onConfirm={onConfirmTableDelete}
      />

      <ConfirmDialog
        open={zoneDeleteTarget !== null}
        onOpenChange={onZoneOpenChange}
        title="Delete zone?"
        description={
          zoneDeleteTarget
            ? `${zoneDeleteTarget.name} will be removed from the floor-plan groups. This cannot be undone.`
            : undefined
        }
        confirmLabel={isZoneDeletePending ? 'Deleting…' : 'Delete zone'}
        cancelLabel="Keep zone"
        tone="destructive"
        onConfirm={onConfirmZoneDelete}
      />
    </>
  );
}
