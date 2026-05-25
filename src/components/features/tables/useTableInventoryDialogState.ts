'use client';

import { useCallback, useEffect, useState } from 'react';

import type { TableZone } from './tableInventoryModel';
import type { TableInventory } from '@/services/ops/tables';

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
  const [isZoneDialogOpen, setIsZoneDialogOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<TableZone | null>(null);
  const [tableDeleteTarget, setTableDeleteTarget] = useState<TableInventory | null>(null);
  const [zoneDeleteTarget, setZoneDeleteTarget] = useState<TableZone | null>(null);
  const [zoneDeleteBlockedMessage, setZoneDeleteBlockedMessage] = useState<string | null>(null);

  const resetDialogState = useCallback(() => {
    setEditingTable(null);
    setIsDialogOpen(false);
    setEditingZone(null);
    setIsZoneDialogOpen(false);
    setTableDeleteTarget(null);
    setZoneDeleteTarget(null);
    setZoneDeleteBlockedMessage(null);
  }, []);

  useEffect(() => {
    resetDialogState();
  }, [activeRestaurantId, resetDialogState]);

  const openNewTableDialog = useCallback(() => {
    setEditingTable(null);
    setIsDialogOpen(true);
  }, []);

  const closeOpenDialogs = useCallback(() => {
    if (isDialogOpen) setIsDialogOpen(false);
    if (isZoneDialogOpen) setIsZoneDialogOpen(false);
  }, [isDialogOpen, isZoneDialogOpen]);

  const handleZoneDelete = useCallback(
    (zone: TableZone) => {
      const tablesInZone = tables.filter((table) => table.zoneId === zone.id);
      if (tablesInZone.length > 0) {
        setZoneDeleteBlockedMessage(
          `${zone.name} still has ${tablesInZone.length} table${
            tablesInZone.length === 1 ? '' : 's'
          }. Move or delete those tables before deleting the zone.`,
        );
        return;
      }

      setZoneDeleteBlockedMessage(null);
      setZoneDeleteTarget(zone);
    },
    [tables],
  );

  const handleTableDialogOpenChange = useCallback((open: boolean) => {
    setIsDialogOpen(open);
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
    }
  }, []);

  const handleZoneDeleteOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setZoneDeleteTarget(null);
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
    isDialogOpen,
    isZoneDialogOpen,
    openNewTableDialog,
    setEditingTable,
    setEditingZone,
    setIsDialogOpen,
    setIsZoneDialogOpen,
    setTableDeleteTarget,
    setZoneDeleteBlockedMessage,
    setZoneDeleteTarget,
    tableDeleteTarget,
    zoneDeleteBlockedMessage,
    zoneDeleteTarget,
  } as const;
}
