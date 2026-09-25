'use client';

import { useCallback, useEffect, useState } from 'react';

import type { TableZone } from './tableInventoryModel';
import type { TableInventory } from '@/services/ops/tables';

export type ZoneWithTables = { zone: TableZone; tableCount: number };

export type UseTableInventoryDialogStateParams = {
  activeRestaurantId: string | null;
  tables: TableInventory[];
};

export function useTableInventoryDialogState({
  activeRestaurantId,
  tables,
}: UseTableInventoryDialogStateParams) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<TableInventory | null>(null);
  /** Zone to preselect in a new table, e.g. the zone just added from "Add table". */
  const [preferredZoneId, setPreferredZoneId] = useState<string | null>(null);
  /** Increments per table dialog opening so the form starts fresh each time. */
  const [tableDialogSession, setTableDialogSession] = useState(0);
  const [tableNumberConflict, setTableNumberConflict] = useState<string | null>(null);
  const [isZoneDialogOpen, setIsZoneDialogOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<TableZone | null>(null);
  /** The zone dialog was opened from "Add table" with no zones: continue to the table dialog. */
  const [zoneDialogContinuesToTable, setZoneDialogContinuesToTable] = useState(false);
  const [tableDeleteTarget, setTableDeleteTarget] = useState<TableInventory | null>(null);
  const [zoneDeleteTarget, setZoneDeleteTarget] = useState<TableZone | null>(null);
  const [zoneWithTables, setZoneWithTables] = useState<ZoneWithTables | null>(null);

  const resetDialogState = useCallback(() => {
    setEditingTable(null);
    setIsDialogOpen(false);
    setPreferredZoneId(null);
    setTableNumberConflict(null);
    setEditingZone(null);
    setIsZoneDialogOpen(false);
    setZoneDialogContinuesToTable(false);
    setTableDeleteTarget(null);
    setZoneDeleteTarget(null);
    setZoneWithTables(null);
  }, []);

  useEffect(() => {
    resetDialogState();
  }, [activeRestaurantId, resetDialogState]);

  const openTableDialog = useCallback(
    (table: TableInventory | null, zoneId: string | null = null) => {
      setEditingTable(table);
      setPreferredZoneId(zoneId);
      setTableNumberConflict(null);
      setTableDialogSession((session) => session + 1);
      setIsDialogOpen(true);
    },
    [],
  );

  const openZoneDialog = useCallback((zone: TableZone | null, continueToTable = false) => {
    setEditingZone(zone);
    setZoneDialogContinuesToTable(continueToTable);
    setIsZoneDialogOpen(true);
  }, []);

  const closeOpenDialogs = useCallback(() => {
    if (isDialogOpen) setIsDialogOpen(false);
    if (isZoneDialogOpen) setIsZoneDialogOpen(false);
  }, [isDialogOpen, isZoneDialogOpen]);

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

  const handleTableDialogOpenChange = useCallback((open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      setTableNumberConflict(null);
    }
  }, []);

  const handleTableDeleteOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setTableDeleteTarget(null);
    }
  }, []);

  const handleZoneDialogOpenChange = useCallback((open: boolean) => {
    setIsZoneDialogOpen(open);
    if (!open) {
      setEditingZone(null);
      setZoneDialogContinuesToTable(false);
    }
  }, []);

  const handleZoneDeleteOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setZoneDeleteTarget(null);
    }
  }, []);

  const handleZoneWithTablesOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setZoneWithTables(null);
    }
  }, []);

  return {
    closeOpenDialogs,
    editingTable,
    editingZone,
    handleTableDeleteOpenChange,
    handleTableDialogOpenChange,
    handleZoneDelete,
    handleZoneDeleteOpenChange,
    handleZoneDialogOpenChange,
    handleZoneWithTablesOpenChange,
    isDialogOpen,
    isZoneDialogOpen,
    openTableDialog,
    openZoneDialog,
    preferredZoneId,
    setIsDialogOpen,
    setIsZoneDialogOpen,
    setTableDeleteTarget,
    setTableNumberConflict,
    setZoneDeleteTarget,
    setZoneWithTables,
    tableDeleteTarget,
    tableDialogSession,
    tableNumberConflict,
    zoneDeleteTarget,
    zoneDialogContinuesToTable,
    zoneWithTables,
  } as const;
}
