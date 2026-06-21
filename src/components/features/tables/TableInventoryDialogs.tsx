'use client';

import { Dialog, DialogContent } from '@/components/ui/dialog';

import { TableInventoryConfirmDialogs } from './TableInventoryConfirmDialogs';
import { TableInventoryForm } from './TableInventoryForm';
import { type ZoneFormPayload } from './tableInventoryFormDomain';
import { type TableFormState, type TableZone } from './tableInventoryModel';
import { TableZoneDialog } from './TableZoneDialog';

import type { TableInventory } from '@/services/ops/tables';

export function TableInventoryDialogs({
  editingTable,
  editingZone,
  isDialogOpen,
  isFirstTable,
  isSavingTable,
  isSavingZone,
  isTableDeletePending,
  isZoneDeletePending,
  isZoneDialogOpen,
  isZonesLoading,
  onConfirmTableDelete,
  onConfirmZoneDelete,
  onTableDeleteOpenChange,
  onTableDialogOpenChange,
  onTableSubmit,
  onZoneDeleteOpenChange,
  onZoneDialogOpenChange,
  onZoneSubmit,
  tableDeleteTarget,
  zoneDeleteTarget,
  zoneOptions,
}: {
  readonly editingTable: TableInventory | null;
  readonly editingZone: TableZone | null;
  readonly isDialogOpen: boolean;
  readonly isFirstTable: boolean;
  readonly isSavingTable: boolean;
  readonly isSavingZone: boolean;
  readonly isTableDeletePending: boolean;
  readonly isZoneDeletePending: boolean;
  readonly isZoneDialogOpen: boolean;
  readonly isZonesLoading: boolean;
  readonly onConfirmTableDelete: () => void;
  readonly onConfirmZoneDelete: () => void;
  readonly onTableDeleteOpenChange: (open: boolean) => void;
  readonly onTableDialogOpenChange: (open: boolean) => void;
  readonly onTableSubmit: (payload: TableFormState) => void;
  readonly onZoneDeleteOpenChange: (open: boolean) => void;
  readonly onZoneDialogOpenChange: (open: boolean) => void;
  readonly onZoneSubmit: (payload: ZoneFormPayload) => void;
  readonly tableDeleteTarget: TableInventory | null;
  readonly zoneDeleteTarget: TableZone | null;
  readonly zoneOptions: Array<{ id: string; name: string; active: boolean }>;
}) {
  return (
    <>
      <Dialog open={isDialogOpen} onOpenChange={onTableDialogOpenChange}>
        <DialogContent className="sm:max-w-xl">
          <TableInventoryForm
            table={editingTable}
            zones={zoneOptions}
            isZonesLoading={isZonesLoading}
            onClose={() => onTableDialogOpenChange(false)}
            onSubmit={onTableSubmit}
            isSaving={isSavingTable}
            isFirstTable={isFirstTable}
          />
        </DialogContent>
      </Dialog>

      <TableZoneDialog
        open={isZoneDialogOpen}
        editingZone={editingZone}
        isSaving={isSavingZone}
        onOpenChange={onZoneDialogOpenChange}
        onSubmit={onZoneSubmit}
      />

      <TableInventoryConfirmDialogs
        tableDeleteTarget={tableDeleteTarget}
        zoneDeleteTarget={zoneDeleteTarget}
        isTableDeletePending={isTableDeletePending}
        isZoneDeletePending={isZoneDeletePending}
        onTableOpenChange={onTableDeleteOpenChange}
        onZoneOpenChange={onZoneDeleteOpenChange}
        onConfirmTableDelete={onConfirmTableDelete}
        onConfirmZoneDelete={onConfirmZoneDelete}
      />
    </>
  );
}
