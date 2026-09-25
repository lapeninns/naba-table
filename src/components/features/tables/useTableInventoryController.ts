'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { useOpsActiveMembership, useOpsSession } from '@/contexts/ops-session';
import { useGlobalShortcuts } from '@/hooks/useGlobalShortcuts';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { isRestaurantAdminRole } from '@/lib/owner/auth/roles';

import {
  buildServiceCapacityLines,
  buildTableZoneLookup,
  getTableBookingStatus,
} from './tableInventoryDisplayDomain';
import { getDuplicateTableNumberMessage, type ZoneFormPayload } from './tableInventoryFormDomain';
import { type TableZone } from './tableInventoryModel';
import {
  buildNeedsLookItems,
  buildPartyCoverage,
  buildSeatStats,
  DEFAULT_ROOM_FILTERS,
  getJoinPartners,
  planZoneOrder,
  type NeedsLookItem,
  type RoomFilters,
  type RoomShowFilter,
} from './tableRoomDomain';
import { useTableEditorState } from './useTableEditorState';
import { useTableInventoryDataState } from './useTableInventoryDataState';
import { useTableInventoryDialogState } from './useTableInventoryDialogState';
import { useTableInventoryMutations } from './useTableInventoryMutations';

import type { TableInventory } from '@/services/ops/tables';

export const TABLE_INVENTORY_ADD_BUTTON_ID = 'table-inventory-add-table';
/** From this width the table details sit in a side panel; below it they open in a sheet. */
export const TABLE_INSPECTOR_QUERY = '(min-width: 1100px)';

export type TableRoomView = 'room' | 'list';

export function tileDomId(tableId: string) {
  return `tile-${tableId}`;
}
export function zoneDomId(zoneId: string) {
  return `zone-${zoneId}`;
}

function focusElement(id: string) {
  window.setTimeout(() => document.getElementById(id)?.focus({ preventScroll: false }), 0);
}

export function useTableInventoryController() {
  const { memberships, activeRestaurantId } = useOpsSession();
  const activeMembership = useOpsActiveMembership();
  const dataState = useTableInventoryDataState(activeRestaurantId);
  const isWide = useMediaQuery(TABLE_INSPECTOR_QUERY);
  const [filters, setFilters] = useState<RoomFilters>(DEFAULT_ROOM_FILTERS);
  const [view, setView] = useState<TableRoomView>('room');

  const canDeleteTables = Boolean(activeMembership && isRestaurantAdminRole(activeMembership.role));
  const { summary, tables, zones, zoneOptions, tablesQueryKey, zonesQueryKey } = dataState;
  const dialogs = useTableInventoryDialogState({ activeRestaurantId, tables });
  const editorState = useTableEditorState({ activeRestaurantId, tables, zones });
  const { editor } = editorState;

  useEffect(() => {
    setFilters(DEFAULT_ROOM_FILTERS);
    setView('room');
  }, [activeRestaurantId]);

  const zoneLookup = useMemo(() => buildTableZoneLookup(zones), [zones]);
  const seatStats = useMemo(() => buildSeatStats(tables, zoneLookup), [tables, zoneLookup]);
  const coverage = useMemo(
    () => buildPartyCoverage(tables, zones, zoneLookup),
    [tables, zones, zoneLookup],
  );
  const needsLook = useMemo(
    () => buildNeedsLookItems(tables, zones, zoneLookup),
    [tables, zones, zoneLookup],
  );
  const serviceCapacityLines = useMemo(() => buildServiceCapacityLines(summary), [summary]);

  const selectedTableId = editor?.table?.id ?? null;
  const selectedTable = useMemo(
    () => (selectedTableId ? (tables.find((table) => table.id === selectedTableId) ?? null) : null),
    [selectedTableId, tables],
  );
  const joinPartnerIds = useMemo(
    () =>
      new Set(
        selectedTable ? getJoinPartners(selectedTable, tables, zoneLookup).map((t) => t.id) : [],
      ),
    [selectedTable, tables, zoneLookup],
  );

  /** With no zones, "Add table" first asks for a zone, then continues to the table. */
  const openAddTable = useCallback(
    (zoneId: string | null = null) => {
      if (!activeRestaurantId || dataState.isLoading || dataState.isLoadingZones) return;
      if (zones.length === 0) {
        dialogs.openZoneDialog(null, true);
        return;
      }
      editorState.openNewTable(zoneId);
    },
    [
      activeRestaurantId,
      dataState.isLoading,
      dataState.isLoadingZones,
      dialogs,
      editorState,
      zones.length,
    ],
  );

  /** Selecting the open table again closes it on wide screens, like the prototype's tiles. */
  const selectTable = useCallback(
    (table: TableInventory) => {
      if (isWide && selectedTableId === table.id) {
        editorState.close();
        return;
      }
      editorState.openTable(table);
    },
    [editorState, isWide, selectedTableId],
  );

  const tableShortcuts = useMemo(
    () => [
      {
        key: 'n',
        metaOrCtrl: true,
        preventDefault: true,
        enabled: Boolean(activeRestaurantId),
        handler: () => openAddTable(),
      },
    ],
    [activeRestaurantId, openAddTable],
  );
  useGlobalShortcuts(tableShortcuts);

  const {
    createMutation,
    deleteMutation,
    quickFixMutation,
    updateMutation,
    zoneCreateMutation,
    zoneDeleteMutation,
    zoneUpdateMutation,
  } = useTableInventoryMutations({
    tablesQueryKey,
    zonesQueryKey,
    onTableSaved: (table) => {
      if (isWide) {
        editorState.markSaved(table);
        focusElement(tileDomId(table.id));
      } else {
        editorState.closeNow();
      }
    },
    onTableNumberConflict: (tableNumber) => {
      editorState.showTableNumberError(getDuplicateTableNumberMessage(tableNumber));
    },
    onTableDeleted: (table) => {
      dialogs.setTableDeleteTarget(null);
      if (editor?.table?.id === table.id) editorState.closeNow();
      focusElement(TABLE_INVENTORY_ADD_BUTTON_ID);
    },
    onZoneCreated: (zone) => {
      dialogs.setIsZoneDialogOpen(false);
      if (dialogs.zoneDialogContinuesToTable) {
        editorState.openNewTable(zone.id);
      } else {
        focusElement(zoneDomId(zone.id));
      }
    },
    onZoneSaved: () => {
      dialogs.setIsZoneDialogOpen(false);
    },
    onZoneDeleted: () => {
      dialogs.setZoneDeleteTarget(null);
    },
  });

  const saveTable = useCallback(() => {
    if (!activeRestaurantId || !editor) return;
    if (createMutation.isPending || updateMutation.isPending) return;
    const payload = editorState.validate();
    if (!payload) return;
    if (editor.table) {
      updateMutation.mutate({
        tableId: editor.table.id,
        payload: { ...payload, position: editor.table.position },
      });
    } else {
      createMutation.mutate({
        restaurantId: activeRestaurantId,
        payload: { ...payload, position: null },
      });
    }
  }, [activeRestaurantId, createMutation, editor, editorState, updateMutation]);

  const requestDeleteTable = useCallback(() => {
    if (editor?.table) dialogs.setTableDeleteTarget(editor.table);
  }, [dialogs, editor]);

  const handleZoneSubmit = useCallback(
    (payload: ZoneFormPayload) => {
      if (!activeRestaurantId) return;
      const editing = dialogs.editingZone;
      const plan = planZoneOrder(zones, editing?.id ?? '__new__', payload.beforeZoneId);
      const own = plan.find((item) => item.zoneId === (editing?.id ?? '__new__'));
      const reorder = plan.filter((item) => item.zoneId !== (editing?.id ?? '__new__'));

      if (editing) {
        zoneUpdateMutation.mutate({
          zoneId: editing.id,
          name: payload.name,
          sortOrder: own?.sortOrder,
          reorder,
        });
        return;
      }
      zoneCreateMutation.mutate({
        restaurantId: activeRestaurantId,
        name: payload.name,
        sortOrder: own?.sortOrder ?? zones.length,
        reorder,
      });
    },
    [activeRestaurantId, dialogs.editingZone, zoneCreateMutation, zoneUpdateMutation, zones],
  );

  const toggleZoneActive = useCallback(
    (zone: Pick<TableZone, 'id' | 'name'>, active: boolean) => {
      zoneUpdateMutation.mutate({ zoneId: zone.id, active, zoneName: zone.name });
    },
    [zoneUpdateMutation],
  );

  const fixNeedsLook = useCallback(
    (item: NeedsLookItem<TableInventory>) => {
      if (item.kind === 'zone') {
        toggleZoneActive(item.zone, true);
        return;
      }
      const { table } = item;
      quickFixMutation.mutate(
        item.fix === 'turn-on'
          ? {
              table,
              patch: { active: true },
              undo: { active: false },
              message: `Table ${table.tableNumber} can be booked again.`,
            }
          : {
              table,
              patch: { status: 'available' },
              undo: { status: table.status },
              message: `Table ${table.tableNumber} can be booked again.`,
            },
      );
    },
    [quickFixMutation, toggleZoneActive],
  );

  const handleConfirmTableDelete = useCallback(() => {
    if (!dialogs.tableDeleteTarget || deleteMutation.isPending) return;
    deleteMutation.mutate({ table: dialogs.tableDeleteTarget });
  }, [deleteMutation, dialogs.tableDeleteTarget]);

  const handleConfirmZoneDelete = useCallback(() => {
    if (!dialogs.zoneDeleteTarget || zoneDeleteMutation.isPending) return;
    zoneDeleteMutation.mutate({ zoneId: dialogs.zoneDeleteTarget.id });
  }, [dialogs.zoneDeleteTarget, zoneDeleteMutation]);

  const setQuery = useCallback((query: string) => {
    setFilters((current) => ({ ...current, query }));
  }, []);
  const setShow = useCallback((show: RoomShowFilter) => {
    setFilters((current) => ({ ...current, show }));
  }, []);
  const clearFilters = useCallback(() => setFilters(DEFAULT_ROOM_FILTERS), []);
  const showIssues = useCallback(() => {
    setFilters((current) => ({ ...current, show: 'not-bookable' }));
    setView('room');
  }, []);

  const savingZoneDetails =
    zoneCreateMutation.isPending ||
    (zoneUpdateMutation.isPending &&
      zoneUpdateMutation.variables !== undefined &&
      zoneUpdateMutation.variables.name !== undefined);

  const notBookableCount = useMemo(
    () => tables.filter((table) => !getTableBookingStatus(table, zoneLookup).bookable).length,
    [tables, zoneLookup],
  );

  return {
    ...dataState,
    ...dialogs,
    activeRestaurantId,
    canDeleteTables,
    clearFilters,
    coverage,
    editor,
    editorState,
    filters,
    fixNeedsLook,
    handleConfirmTableDelete,
    handleConfirmZoneDelete,
    handleZoneSubmit,
    isSavingTable: createMutation.isPending || updateMutation.isPending,
    isSavingZone: savingZoneDetails,
    isTableDeletePending: deleteMutation.isPending,
    isWide,
    isZoneDeletePending: zoneDeleteMutation.isPending,
    joinPartnerIds,
    memberships,
    needsLook,
    notBookableCount,
    openAddTable,
    requestDeleteTable,
    saveTable,
    seatStats,
    selectTable,
    selectedTableId,
    serviceCapacityLines,
    setQuery,
    setShow,
    setView,
    showIssues,
    toggleZoneActive,
    view,
    zoneLookup,
    zoneOptions,
  };
}
