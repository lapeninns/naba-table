'use client';

import { useCallback, useEffect, useState } from 'react';

import type { TableZone } from './tableInventoryModel';
import type { TableInventory } from '@/services/ops/tables';

export type ZoneWithTables = { zone: TableZone; tableCount: number };

export type UseTableInventoryDialogStateParams = {
  activeRestaurantId: string | null;
  tables: TableInventory[];
};

/** Zone dialog and delete confirmations. The table editor lives in `useTableEditorState`. */
export function useTableInventoryDialogState({
  activeRestaurantId,
  tables,
}: UseTableInventoryDialogStateParams) {
  const [isZoneDialogOpen, setIsZoneDialogOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<TableZone | null>(null);
  /** The zone dialog was opened from "Add table" with no zones: continue to the new table. */
  const [zoneDialogContinuesToTable, setZoneDialogContinuesToTable] = useState(false);
  /** Increments per zone dialog opening so the form starts fresh each time. */
  const [zoneDialogSession, setZoneDialogSession] = useState(0);
  const [tableDeleteTarget, setTableDeleteTarget] = useState<TableInventory | null>(null);
  const [zoneDeleteTarget, setZoneDeleteTarget] = useState<TableZone | null>(null);
  const [zoneWithTables, setZoneWithTables] = useState<ZoneWithTables | null>(null);

  useEffect(() => {
    setEditingZone(null);
    setIsZoneDialogOpen(false);
    setZoneDialogContinuesToTable(false);
    setTableDeleteTarget(null);
    setZoneDeleteTarget(null);
    setZoneWithTables(null);
  }, [activeRestaurantId]);

  const openZoneDialog = useCallback((zone: TableZone | null, continueToTable = false) => {
    setEditingZone(zone);
    setZoneDialogContinuesToTable(continueToTable);
    setZoneDialogSession((session) => session + 1);
    setIsZoneDialogOpen(true);
  }, []);

  /** A zone that still has tables can't be deleted; explain why instead of confirming. */
  const handleZoneDelete = useCallback(
    (zone: TableZone) => {
      const tableCount = tables.filter((table) => table.zoneId === zone.id).length;
      if (tableCount > 0) {
        setZoneWithTables({ zone, tableCount });
        return;
      }
      setZoneDeleteTarget(zone);
    },
    [tables],
  );

  const handleTableDeleteOpenChange = useCallback((open: boolean) => {
    if (!open) setTableDeleteTarget(null);
  }, []);

  const handleZoneDialogOpenChange = useCallback((open: boolean) => {
    setIsZoneDialogOpen(open);
    if (!open) {
      setEditingZone(null);
      setZoneDialogContinuesToTable(false);
    }
  }, []);

  const handleZoneDeleteOpenChange = useCallback((open: boolean) => {
    if (!open) setZoneDeleteTarget(null);
  }, []);

  const handleZoneWithTablesOpenChange = useCallback((open: boolean) => {
    if (!open) setZoneWithTables(null);
  }, []);

  return {
    editingZone,
    handleTableDeleteOpenChange,
    handleZoneDelete,
    handleZoneDeleteOpenChange,
    handleZoneDialogOpenChange,
    handleZoneWithTablesOpenChange,
    isZoneDialogOpen,
    openZoneDialog,
    setIsZoneDialogOpen,
    setTableDeleteTarget,
    setZoneDeleteTarget,
    setZoneWithTables,
    tableDeleteTarget,
    zoneDeleteTarget,
    zoneDialogContinuesToTable,
    zoneDialogSession,
    zoneWithTables,
  } as const;
}
