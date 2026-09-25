'use client';

import { TableInventoryConfirmDialogs } from './TableInventoryConfirmDialogs';
import { TableInventoryForm } from './TableInventoryForm';
import { type ZoneFormPayload } from './tableInventoryFormDomain';
import { type TableFormState, type TableZone } from './tableInventoryModel';
import { TableZoneDialog } from './TableZoneDialog';

import type { ZoneWithTables } from './useTableInventoryDialogState';
import type { TableInventory } from '@/services/ops/tables';

export function TableInventoryDialogs({
  editingTable,
  editingZone,
  isDialogOpen,
  isSavingTable,
  isSavingZone,
  isTableDeletePending,
  isZoneDeletePending,
  isZoneDialogOpen,
  isZonesLoading,
  nextZoneSortOrder,
  onConfirmTableDelete,
  onConfirmZoneDelete,
  onShowZoneTables,
  onTableDeleteOpenChange,
  onTableDialogOpenChange,
  onTableSubmit,
  onZoneDeleteOpenChange,
  onZoneDialogOpenChange,
  onZoneSubmit,
  onZoneWithTablesOpenChange,
  preferredZoneId,
  tableDeleteTarget,
  tableDialogSession,
  tableNumberConflict,
  zoneDeleteTarget,
  zoneDialogContinuesToTable,
  zoneOptions,
  zoneWithTables,
}: {
  readonly editingTable: TableInventory | null;
  readonly editingZone: TableZone | null;
  readonly isDialogOpen: boolean;
  readonly isSavingTable: boolean;
  readonly isSavingZone: boolean;
  readonly isTableDeletePending: boolean;
  readonly isZoneDeletePending: boolean;
  readonly isZoneDialogOpen: boolean;
  readonly isZonesLoading: boolean;
  readonly nextZoneSortOrder: number;
  readonly onConfirmTableDelete: () => void;
  readonly onConfirmZoneDelete: () => void;
  readonly onShowZoneTables: (zoneId: string) => void;
  readonly onTableDeleteOpenChange: (open: boolean) => void;
  readonly onTableDialogOpenChange: (open: boolean) => void;
  readonly onTableSubmit: (payload: TableFormState) => void;
  readonly onZoneDeleteOpenChange: (open: boolean) => void;
  readonly onZoneDialogOpenChange: (open: boolean) => void;
  readonly onZoneSubmit: (payload: ZoneFormPayload) => void;
  readonly onZoneWithTablesOpenChange: (open: boolean) => void;
  readonly preferredZoneId: string | null;
  readonly tableDeleteTarget: TableInventory | null;
  readonly tableDialogSession: number;
  readonly tableNumberConflict: string | null;
  readonly zoneDeleteTarget: TableZone | null;
  readonly zoneDialogContinuesToTable: boolean;
  readonly zoneOptions: Array<Pick<TableZone, 'id' | 'name' | 'active'>>;
  readonly zoneWithTables: ZoneWithTables | null;
}) {
  return (
    <>
      <TableInventoryForm
        key={tableDialogSession}
        open={isDialogOpen}
        onOpenChange={onTableDialogOpenChange}
        table={editingTable}
        zones={zoneOptions}
        isZonesLoading={isZonesLoading}
        preferredZoneId={preferredZoneId}
        tableNumberError={tableNumberConflict}
        onSubmit={onTableSubmit}
        isSaving={isSavingTable}
      />

      <TableZoneDialog
        open={isZoneDialogOpen}
        editingZone={editingZone}
        isSaving={isSavingZone}
        continuesToTable={zoneDialogContinuesToTable}
        nextSortOrder={nextZoneSortOrder}
        onOpenChange={onZoneDialogOpenChange}
        onSubmit={onZoneSubmit}
      />

      <TableInventoryConfirmDialogs
        tableDeleteTarget={tableDeleteTarget}
        zoneDeleteTarget={zoneDeleteTarget}
        zoneWithTables={zoneWithTables}
        isTableDeletePending={isTableDeletePending}
        isZoneDeletePending={isZoneDeletePending}
        onTableOpenChange={onTableDeleteOpenChange}
        onZoneOpenChange={onZoneDeleteOpenChange}
        onZoneWithTablesOpenChange={onZoneWithTablesOpenChange}
        onConfirmTableDelete={onConfirmTableDelete}
        onConfirmZoneDelete={onConfirmZoneDelete}
        onShowZoneTables={onShowZoneTables}
      />
    </>
  );
}
