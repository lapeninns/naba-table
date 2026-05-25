'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { useOpsActiveMembership, useOpsSession } from '@/contexts/ops-session';
import { useGlobalShortcuts } from '@/hooks/useGlobalShortcuts';
import { isRestaurantAdminRole } from '@/lib/owner/auth/roles';

import { buildTableInventorySummaryCards } from './tableInventoryDisplayDomain';
import { type ZoneFormPayload } from './tableInventoryFormDomain';
import {
  ALL_ZONES_VALUE,
  filterTablesByStatus,
  filterZonesByStatus,
  type TableFormState,
  type TableStatusFilter,
  type TableWorkspace,
  type ZoneStatusFilter,
} from './tableInventoryModel';
import { useTableInventoryDataState } from './useTableInventoryDataState';
import { useTableInventoryDialogState } from './useTableInventoryDialogState';
import { useTableInventoryMutations } from './useTableInventoryMutations';

export function useTableInventoryController() {
  const { memberships, activeRestaurantId } = useOpsSession();
  const activeMembership = useOpsActiveMembership();
  const dataState = useTableInventoryDataState(activeRestaurantId);
  const [filterZone, setFilterZone] = useState<string>(ALL_ZONES_VALUE);
  const [zoneStatusFilter, setZoneStatusFilter] = useState<ZoneStatusFilter>('active');
  const [tableStatusFilter, setTableStatusFilter] = useState<TableStatusFilter>('active');
  const [activeWorkspace, setActiveWorkspace] = useState<TableWorkspace>('summary');

  const canDeleteTables = Boolean(activeMembership && isRestaurantAdminRole(activeMembership.role));
  const {
    error,
    isError,
    isFetching,
    isLoading,
    isLoadingZones,
    isZonesError,
    refetch,
    summary,
    tables,
    zoneOptions,
    zones,
    zonesError,
    zonesQueryKey,
  } = dataState;
  const {
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
  } = useTableInventoryDialogState({
    activeRestaurantId,
    tables,
  });

  useEffect(() => {
    setFilterZone(ALL_ZONES_VALUE);
    setZoneStatusFilter('active');
    setTableStatusFilter('active');
  }, [activeRestaurantId]);

  const filteredZones = useMemo(
    () => filterZonesByStatus(zones, zoneStatusFilter),
    [zones, zoneStatusFilter],
  );

  const tableShortcuts = useMemo(
    () => [
      {
        key: 'n',
        metaOrCtrl: true,
        preventDefault: true,
        enabled: Boolean(activeRestaurantId),
        handler: openNewTableDialog,
      },
      {
        key: 'escape',
        preventDefault: false,
        enabled: isDialogOpen || isZoneDialogOpen,
        handler: closeOpenDialogs,
      },
    ],
    [activeRestaurantId, closeOpenDialogs, isDialogOpen, isZoneDialogOpen, openNewTableDialog],
  );

  useGlobalShortcuts(tableShortcuts);

  const isZoneSelectDisabled = zoneOptions.length === 0;

  const selectWorkspace = useCallback((workspace: TableWorkspace) => {
    setActiveWorkspace(workspace);
    const hash =
      workspace === 'summary'
        ? 'table-capacity-summary'
        : workspace === 'zones'
          ? 'table-zones'
          : 'table-inventory';
    window.history.replaceState(null, '', `#${hash}`);
  }, []);

  const filteredTables = useMemo(() => {
    const zoneFiltered =
      filterZone === ALL_ZONES_VALUE
        ? tables
        : tables.filter((table) => table.zoneId === filterZone);
    return filterTablesByStatus(zoneFiltered, tableStatusFilter);
  }, [filterZone, tableStatusFilter, tables]);

  const summaryCards = useMemo(() => {
    if (!summary) {
      return null;
    }
    return buildTableInventorySummaryCards(summary, tables);
  }, [summary, tables]);

  const {
    createMutation,
    deleteMutation,
    updateMutation,
    zoneCreateMutation,
    zoneDeleteMutation,
    zoneUpdateMutation,
  } = useTableInventoryMutations({
    filterZone,
    setEditingTable,
    setEditingZone,
    setFilterZone,
    setIsDialogOpen,
    setIsZoneDialogOpen,
    setTableDeleteTarget,
    setZoneDeleteBlockedMessage,
    setZoneDeleteTarget,
    zonesQueryKey,
  });

  const handleTableSubmit = useCallback(
    (payload: TableFormState) => {
      if (!activeRestaurantId) return;

      if (editingTable) {
        updateMutation.mutate({
          tableId: editingTable.id,
          payload: { ...payload, position: editingTable.position },
        });
      } else {
        createMutation.mutate({
          restaurantId: activeRestaurantId,
          payload: { ...payload, position: null },
        });
      }
    },
    [activeRestaurantId, createMutation, editingTable, updateMutation],
  );

  const handleZoneSubmit = useCallback(
    (payload: ZoneFormPayload) => {
      if (!activeRestaurantId) {
        return;
      }

      if (editingZone) {
        zoneUpdateMutation.mutate({ zoneId: editingZone.id, ...payload });
        return;
      }

      zoneCreateMutation.mutate({ restaurantId: activeRestaurantId, ...payload });
    },
    [activeRestaurantId, editingZone, zoneCreateMutation, zoneUpdateMutation],
  );

  const handleConfirmTableDelete = useCallback(() => {
    if (!tableDeleteTarget || deleteMutation.isPending) {
      return;
    }
    deleteMutation.mutate({ tableId: tableDeleteTarget.id });
  }, [deleteMutation, tableDeleteTarget]);

  const handleConfirmZoneDelete = useCallback(() => {
    if (!zoneDeleteTarget || zoneDeleteMutation.isPending) {
      return;
    }
    zoneDeleteMutation.mutate({ zoneId: zoneDeleteTarget.id });
  }, [zoneDeleteMutation, zoneDeleteTarget]);

  return {
    activeRestaurantId,
    activeWorkspace,
    canDeleteTables,
    editingTable,
    editingZone,
    error,
    filterZone,
    filteredTables,
    filteredZones,
    handleConfirmTableDelete,
    handleConfirmZoneDelete,
    handleTableDeleteOpenChange,
    handleTableDialogOpenChange,
    handleTableSubmit,
    handleZoneDelete,
    handleZoneDeleteOpenChange,
    handleZoneDialogOpenChange,
    handleZoneSubmit,
    isDialogOpen,
    isError,
    isFetching,
    isLoading,
    isLoadingZones,
    isSavingTable: createMutation.isPending || updateMutation.isPending,
    isSavingZone: zoneCreateMutation.isPending || zoneUpdateMutation.isPending,
    isTableDeletePending: deleteMutation.isPending,
    isZoneDeletePending: zoneDeleteMutation.isPending,
    isZoneDialogOpen,
    isZonesError,
    isZoneSelectDisabled,
    memberships,
    openNewTableDialog,
    refetch,
    selectWorkspace,
    setEditingTable,
    setEditingZone,
    setFilterZone,
    setIsDialogOpen,
    setIsZoneDialogOpen,
    setTableDeleteTarget,
    setTableStatusFilter,
    setZoneStatusFilter,
    summary,
    summaryCards,
    tableDeleteTarget,
    tables,
    tableStatusFilter,
    zoneDeleteBlockedMessage,
    zoneDeleteTarget,
    zoneOptions,
    zones,
    zonesError,
    zoneStatusFilter,
    zoneUpdateMutation,
  };
}
