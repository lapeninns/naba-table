'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { scrollToSettingsSection } from '@/components/features/restaurant-settings/shared';
import { useOpsActiveMembership, useOpsSession } from '@/contexts/ops-session';
import { useGlobalShortcuts } from '@/hooks/useGlobalShortcuts';
import { isRestaurantAdminRole } from '@/lib/owner/auth/roles';

import {
  buildServiceCapacityLines,
  buildTableInventoryOverview,
  buildTableZoneLookup,
  DEFAULT_TABLE_LIST_FILTERS,
  filterTableInventory,
  groupTablesByZone,
  type TableListFilters,
} from './tableInventoryDisplayDomain';
import { getDuplicateTableNumberMessage, type ZoneFormPayload } from './tableInventoryFormDomain';
import { ALL_ZONES_VALUE, type TableFormState, type TableZone } from './tableInventoryModel';
import { useTableInventoryDataState } from './useTableInventoryDataState';
import { useTableInventoryDialogState } from './useTableInventoryDialogState';
import { useTableInventoryMutations } from './useTableInventoryMutations';

export const TABLE_INVENTORY_ADD_BUTTON_ID = 'table-inventory-add-table';
const TABLE_INVENTORY_LIST_ID = 'table-inventory';
/** Zones and the tables list sit side by side from this width; below it they stack. */
const SIDE_BY_SIDE_QUERY = '(min-width: 1280px)';

function focusAddTableButton() {
  window.setTimeout(() => {
    document.getElementById(TABLE_INVENTORY_ADD_BUTTON_ID)?.focus();
  }, 0);
}

function scrollToTablesListWhenStacked() {
  if (typeof window.matchMedia === 'function' && window.matchMedia(SIDE_BY_SIDE_QUERY).matches) {
    return;
  }
  scrollToSettingsSection(TABLE_INVENTORY_LIST_ID);
}

export function useTableInventoryController() {
  const { memberships, activeRestaurantId } = useOpsSession();
  const activeMembership = useOpsActiveMembership();
  const dataState = useTableInventoryDataState(activeRestaurantId);
  const [filters, setFilters] = useState<TableListFilters>(DEFAULT_TABLE_LIST_FILTERS);

  const canDeleteTables = Boolean(activeMembership && isRestaurantAdminRole(activeMembership.role));
  const { summary, tables, zones, zoneOptions, tablesQueryKey, zonesQueryKey } = dataState;
  const dialogs = useTableInventoryDialogState({ activeRestaurantId, tables });
  const {
    closeOpenDialogs,
    editingTable,
    editingZone,
    isDialogOpen,
    isZoneDialogOpen,
    openTableDialog,
    openZoneDialog,
    setIsDialogOpen,
    setIsZoneDialogOpen,
    setTableDeleteTarget,
    setTableNumberConflict,
    setZoneDeleteTarget,
    setZoneWithTables,
    tableDeleteTarget,
    zoneDeleteTarget,
    zoneDialogContinuesToTable,
    zoneWithTables,
  } = dialogs;

  useEffect(() => {
    setFilters(DEFAULT_TABLE_LIST_FILTERS);
  }, [activeRestaurantId]);

  const zoneLookup = useMemo(() => buildTableZoneLookup(zones), [zones]);
  const filteredTables = useMemo(
    () => filterTableInventory(tables, filters, zoneLookup),
    [filters, tables, zoneLookup],
  );
  const tableGroups = useMemo(
    () => groupTablesByZone(filteredTables, zones),
    [filteredTables, zones],
  );
  const overview = useMemo(() => buildTableInventoryOverview(tables, zones), [tables, zones]);
  const serviceCapacityLines = useMemo(() => buildServiceCapacityLines(summary), [summary]);

  /** With no zones, "Add table" first asks for a zone, then continues to the table. */
  const openAddTable = useCallback(() => {
    if (!activeRestaurantId || dataState.isLoading || dataState.isLoadingZones) return;
    if (zones.length === 0) {
      openZoneDialog(null, true);
      return;
    }
    openTableDialog(null);
  }, [
    activeRestaurantId,
    dataState.isLoading,
    dataState.isLoadingZones,
    openTableDialog,
    openZoneDialog,
    zones.length,
  ]);

  const tableShortcuts = useMemo(
    () => [
      {
        key: 'n',
        metaOrCtrl: true,
        preventDefault: true,
        enabled: Boolean(activeRestaurantId),
        handler: openAddTable,
      },
      {
        key: 'escape',
        preventDefault: false,
        enabled: isDialogOpen || isZoneDialogOpen,
        handler: closeOpenDialogs,
      },
    ],
    [activeRestaurantId, closeOpenDialogs, isDialogOpen, isZoneDialogOpen, openAddTable],
  );

  useGlobalShortcuts(tableShortcuts);

  const {
    createMutation,
    deleteMutation,
    updateMutation,
    zoneCreateMutation,
    zoneDeleteMutation,
    zoneUpdateMutation,
  } = useTableInventoryMutations({
    tablesQueryKey,
    zonesQueryKey,
    onTableSaved: () => {
      setIsDialogOpen(false);
    },
    onTableNumberConflict: (tableNumber) => {
      setTableNumberConflict(getDuplicateTableNumberMessage(tableNumber));
    },
    onTableDeleted: () => {
      setTableDeleteTarget(null);
      focusAddTableButton();
    },
    onZoneCreated: (zone) => {
      setIsZoneDialogOpen(false);
      if (zoneDialogContinuesToTable) {
        openTableDialog(null, zone.id);
      }
    },
    onZoneSaved: () => {
      setIsZoneDialogOpen(false);
    },
    onZoneDeleted: (zoneId) => {
      setZoneDeleteTarget(null);
      setFilters((current) =>
        current.zoneId === zoneId ? { ...current, zoneId: ALL_ZONES_VALUE } : current,
      );
    },
  });

  const setSearchQuery = useCallback((query: string) => {
    setFilters((current) => ({ ...current, query }));
  }, []);

  const setZoneFilter = useCallback((zoneId: string) => {
    setFilters((current) => ({ ...current, zoneId }));
  }, []);

  const setBookableFilter = useCallback((bookable: TableListFilters['bookable']) => {
    setFilters((current) => ({ ...current, bookable }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(DEFAULT_TABLE_LIST_FILTERS);
  }, []);

  /** Zone name buttons toggle the zone filter; on stacked layouts they also jump to the list. */
  const toggleZoneFilter = useCallback((zoneId: string) => {
    setFilters((current) => ({
      ...current,
      zoneId: current.zoneId === zoneId ? ALL_ZONES_VALUE : zoneId,
    }));
    scrollToTablesListWhenStacked();
  }, []);

  const showZoneTables = useCallback(
    (zoneId: string) => {
      setZoneWithTables(null);
      setFilters({ ...DEFAULT_TABLE_LIST_FILTERS, zoneId });
      window.setTimeout(() => scrollToSettingsSection(TABLE_INVENTORY_LIST_ID), 0);
    },
    [setZoneWithTables],
  );

  const handleTableSubmit = useCallback(
    (payload: TableFormState) => {
      if (!activeRestaurantId) return;
      setTableNumberConflict(null);

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
    [activeRestaurantId, createMutation, editingTable, setTableNumberConflict, updateMutation],
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

  const toggleZoneActive = useCallback(
    (zone: TableZone, active: boolean) => {
      zoneUpdateMutation.mutate({ zoneId: zone.id, active, zoneName: zone.name });
    },
    [zoneUpdateMutation],
  );

  const handleConfirmTableDelete = useCallback(() => {
    if (!tableDeleteTarget || deleteMutation.isPending) {
      return;
    }
    deleteMutation.mutate({ table: tableDeleteTarget });
  }, [deleteMutation, tableDeleteTarget]);

  const handleConfirmZoneDelete = useCallback(() => {
    if (!zoneDeleteTarget || zoneDeleteMutation.isPending) {
      return;
    }
    zoneDeleteMutation.mutate({ zoneId: zoneDeleteTarget.id });
  }, [zoneDeleteMutation, zoneDeleteTarget]);

  const savingZoneDetails =
    zoneCreateMutation.isPending ||
    (zoneUpdateMutation.isPending &&
      zoneUpdateMutation.variables !== undefined &&
      zoneUpdateMutation.variables.name !== undefined);

  return {
    ...dataState,
    ...dialogs,
    activeRestaurantId,
    canDeleteTables,
    clearFilters,
    filteredTables,
    filters,
    handleConfirmTableDelete,
    handleConfirmZoneDelete,
    handleTableSubmit,
    handleZoneSubmit,
    isSavingTable: createMutation.isPending || updateMutation.isPending,
    isSavingZone: savingZoneDetails,
    isTableDeletePending: deleteMutation.isPending,
    isZoneDeletePending: zoneDeleteMutation.isPending,
    memberships,
    openAddTable,
    overview,
    serviceCapacityLines,
    setBookableFilter,
    setSearchQuery,
    setZoneFilter,
    showZoneTables,
    tableGroups,
    toggleZoneActive,
    toggleZoneFilter,
    zoneLookup,
    zoneOptions,
    zoneWithTables,
  };
}
