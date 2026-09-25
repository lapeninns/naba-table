'use client';

import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { toast } from 'sonner';

import { useTableInventoryService, useZoneService } from '@/contexts/ops-services';
import { HttpError } from '@/lib/http/errors';

import { showTableInventoryErrorToast } from './tableInventoryToasts';

import type {
  CreateTablePayload,
  ListTablesResult,
  TableInventory,
  UpdateTablePayload,
} from '@/services/ops/tables';
import type { Zone } from '@/services/ops/zones';

type UseTableInventoryMutationsParams = {
  readonly tablesQueryKey: QueryKey;
  readonly zonesQueryKey: QueryKey;
  /** The table was saved; `created` is false for an edit. */
  readonly onTableSaved: (table: TableInventory, created: boolean) => void;
  /** The server rejected the table number as a duplicate (HTTP 409). */
  readonly onTableNumberConflict: (tableNumber: string) => void;
  readonly onTableDeleted: (table: Pick<TableInventory, 'id' | 'tableNumber'>) => void;
  readonly onZoneCreated: (zone: Zone) => void;
  readonly onZoneSaved: (zone: Zone) => void;
  readonly onZoneDeleted: (zoneId: string) => void;
};

/** Other zones whose position changes with this save (`planZoneOrder`). */
export type ZoneReorder = ReadonlyArray<{ zoneId: string; sortOrder: number }>;

export type ZoneUpdateVariables = {
  zoneId: string;
  name?: string;
  sortOrder?: number;
  active?: boolean;
  /** Only used for the confirmation toast; never sent. */
  zoneName?: string;
  reorder?: ZoneReorder;
};

/** A one-field fix from "Needs a look", with the patch that undoes it. */
export type TableQuickFixVariables = {
  table: Pick<TableInventory, 'id' | 'tableNumber'>;
  patch: Pick<UpdateTablePayload, 'active' | 'status'>;
  undo: Pick<UpdateTablePayload, 'active' | 'status'> | null;
  message: string;
};

type ZoneUpdateContext = { previousActive?: boolean };

function isSeasonalToggle(variables: ZoneUpdateVariables): variables is ZoneUpdateVariables & {
  active: boolean;
} {
  return (
    variables.active !== undefined &&
    variables.name === undefined &&
    variables.sortOrder === undefined
  );
}

/** Sets a zone's in-service flag in both places the page reads zones from. */
function patchZoneActive(
  queryClient: ReturnType<typeof useQueryClient>,
  keys: { tablesQueryKey: QueryKey; zonesQueryKey: QueryKey },
  zoneId: string,
  active: boolean,
) {
  queryClient.setQueryData<ListTablesResult>(keys.tablesQueryKey, (current) => {
    if (!current) return current;
    return {
      tables: current.tables.map((table) =>
        table.zoneId === zoneId ? { ...table, zoneActive: active } : table,
      ),
      summary: current.summary
        ? {
            ...current.summary,
            zones: current.summary.zones.map((zone) =>
              zone.id === zoneId ? { ...zone, active } : zone,
            ),
          }
        : current.summary,
    };
  });
  queryClient.setQueryData<Zone[]>(keys.zonesQueryKey, (current) =>
    current?.map((zone) => (zone.id === zoneId ? { ...zone, active } : zone)),
  );
}

function readZoneActive(
  queryClient: ReturnType<typeof useQueryClient>,
  keys: { tablesQueryKey: QueryKey; zonesQueryKey: QueryKey },
  zoneId: string,
): boolean | undefined {
  const tablesData = queryClient.getQueryData<ListTablesResult>(keys.tablesQueryKey);
  const fromSummary = tablesData?.summary?.zones.find((zone) => zone.id === zoneId)?.active;
  if (fromSummary !== undefined) return fromSummary;
  return queryClient.getQueryData<Zone[]>(keys.zonesQueryKey)?.find((zone) => zone.id === zoneId)
    ?.active;
}

/** Adds a new zone to the cached lists so the table dialog can offer it straight away. */
function addZoneToCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  keys: { tablesQueryKey: QueryKey; zonesQueryKey: QueryKey },
  zone: Zone,
) {
  queryClient.setQueryData<ListTablesResult>(keys.tablesQueryKey, (current) => {
    if (!current?.summary || current.summary.zones.some((item) => item.id === zone.id)) {
      return current;
    }
    return {
      ...current,
      summary: {
        ...current.summary,
        zones: [
          ...current.summary.zones,
          { id: zone.id, name: zone.name, active: zone.active, sortOrder: zone.sortOrder },
        ],
      },
    };
  });
  queryClient.setQueryData<Zone[]>(keys.zonesQueryKey, (current) =>
    current && !current.some((item) => item.id === zone.id) ? [...current, zone] : current,
  );
}

export function useTableInventoryMutations({
  tablesQueryKey,
  zonesQueryKey,
  onTableSaved,
  onTableNumberConflict,
  onTableDeleted,
  onZoneCreated,
  onZoneSaved,
  onZoneDeleted,
}: UseTableInventoryMutationsParams) {
  const tableService = useTableInventoryService();
  const zoneService = useZoneService();
  const queryClient = useQueryClient();
  const keys = { tablesQueryKey, zonesQueryKey };

  /** Zones moved by a position change are renumbered one by one after the main save. */
  const applyZoneReorder = async (reorder: ZoneReorder) => {
    for (const item of reorder) {
      await zoneService.update(item.zoneId, { sortOrder: item.sortOrder });
    }
  };

  const handleTableSaveError = (error: unknown, tableNumber: string) => {
    if (error instanceof HttpError && error.status === 409) {
      onTableNumberConflict(tableNumber);
      return;
    }
    showTableInventoryErrorToast('Table wasn’t saved. Your details are still here.', error);
  };

  const createMutation = useMutation({
    mutationFn: ({
      restaurantId,
      payload,
    }: {
      restaurantId: string;
      payload: CreateTablePayload;
    }) => tableService.create(restaurantId, payload),
    onSuccess: (table) => {
      queryClient.invalidateQueries({ queryKey: ['ops', 'tables'] });
      toast.success(
        table.zoneName
          ? `Table ${table.tableNumber} added to ${table.zoneName}.`
          : `Table ${table.tableNumber} added.`,
      );
      onTableSaved(table, true);
    },
    onError: (error, variables) => handleTableSaveError(error, variables.payload.tableNumber),
  });

  const updateMutation = useMutation({
    mutationFn: ({
      tableId,
      payload,
    }: {
      tableId: string;
      payload: UpdateTablePayload & { tableNumber: string };
    }) => tableService.update(tableId, payload),
    onSuccess: (table) => {
      queryClient.invalidateQueries({ queryKey: ['ops', 'tables'] });
      toast.success(`Table ${table.tableNumber} saved.`);
      onTableSaved(table, false);
    },
    onError: (error, variables) => handleTableSaveError(error, variables.payload.tableNumber),
  });

  const quickFixMutation = useMutation<
    TableInventory,
    unknown,
    TableQuickFixVariables,
    { previous?: ListTablesResult }
  >({
    mutationFn: ({ table, patch }) => tableService.update(table.id, patch),
    // The room, counts and "Needs a look" all read the tables query, so patch it straight away.
    onMutate: async ({ table, patch }) => {
      await queryClient.cancelQueries({ queryKey: tablesQueryKey });
      const previous = queryClient.getQueryData<ListTablesResult>(tablesQueryKey);
      queryClient.setQueryData<ListTablesResult>(tablesQueryKey, (current) =>
        current
          ? {
              ...current,
              tables: current.tables.map((item) =>
                item.id === table.id ? { ...item, ...patch } : item,
              ),
            }
          : current,
      );
      return { previous };
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['ops', 'tables'] });
    },
    onSuccess: (_table, variables) => {
      const { undo } = variables;
      toast.success(variables.message, {
        action: undo
          ? {
              label: 'Undo',
              onClick: () =>
                quickFixMutation.mutate({
                  table: variables.table,
                  patch: undo,
                  undo: null,
                  message: `Table ${variables.table.tableNumber} is back as it was.`,
                }),
            }
          : undefined,
      });
    },
    onError: (error, variables, context) => {
      if (context?.previous) queryClient.setQueryData(tablesQueryKey, context.previous);
      showTableInventoryErrorToast(`Table ${variables.table.tableNumber} wasn’t changed.`, error);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: ({ table }: { table: Pick<TableInventory, 'id' | 'tableNumber'> }) =>
      tableService.remove(table.id),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['ops', 'tables'] });
      toast.success(`Table ${variables.table.tableNumber} deleted.`);
      onTableDeleted(variables.table);
    },
    onError: (error) => showTableInventoryErrorToast('Table wasn’t deleted.', error),
  });

  const zoneCreateMutation = useMutation({
    mutationFn: async ({
      restaurantId,
      name,
      sortOrder,
      reorder = [],
    }: {
      restaurantId: string;
      name: string;
      sortOrder?: number;
      reorder?: ZoneReorder;
    }) => {
      const zone = await zoneService.create(restaurantId, name, sortOrder);
      await applyZoneReorder(reorder);
      return zone;
    },
    onSuccess: (zone) => {
      addZoneToCaches(queryClient, keys, zone);
      queryClient.invalidateQueries({ queryKey: zonesQueryKey });
      queryClient.invalidateQueries({ queryKey: ['ops', 'tables'] });
      toast.success(`Zone “${zone.name}” added.`);
      onZoneCreated(zone);
    },
    onError: (error) =>
      showTableInventoryErrorToast('Zone wasn’t saved. Your details are still here.', error),
  });

  const zoneUpdateMutation = useMutation<Zone, unknown, ZoneUpdateVariables, ZoneUpdateContext>({
    mutationFn: async ({ zoneId, name, sortOrder, active, reorder = [] }) => {
      const zone = await zoneService.update(zoneId, { name, sortOrder, active });
      await applyZoneReorder(reorder);
      return zone;
    },
    onMutate: async (variables) => {
      if (!isSeasonalToggle(variables)) {
        return {};
      }
      // Zones are read from the tables query when it carries a summary, and from the zones query
      // otherwise, so the switch patches both for an immediate update.
      await Promise.all([
        queryClient.cancelQueries({ queryKey: tablesQueryKey }),
        queryClient.cancelQueries({ queryKey: zonesQueryKey }),
      ]);
      const previousActive = readZoneActive(queryClient, keys, variables.zoneId);
      patchZoneActive(queryClient, keys, variables.zoneId, variables.active);
      return { previousActive };
    },
    onSuccess: (zone, variables) => {
      if (isSeasonalToggle(variables)) {
        const name = variables.zoneName ?? zone.name;
        toast.success(
          zone.active
            ? `${name} is back in service. Its active tables can be booked.`
            : `${name} is out of service. Its tables are kept but can’t be booked.`,
          {
            action: {
              label: 'Undo',
              onClick: () =>
                zoneUpdateMutation.mutate({
                  zoneId: zone.id,
                  active: !zone.active,
                  zoneName: name,
                }),
            },
          },
        );
        return;
      }
      toast.success('Zone updated.');
      onZoneSaved(zone);
    },
    onError: (error, variables, context) => {
      if (isSeasonalToggle(variables)) {
        // Roll back only this zone, so another switch changed meanwhile keeps its state.
        patchZoneActive(
          queryClient,
          keys,
          variables.zoneId,
          context?.previousActive ?? !variables.active,
        );
        showTableInventoryErrorToast(
          `${variables.zoneName ?? 'The zone'} wasn’t changed. The switch is back to its saved setting.`,
          error,
        );
        return;
      }
      showTableInventoryErrorToast('Zone wasn’t saved. Your details are still here.', error);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: zonesQueryKey });
      queryClient.invalidateQueries({ queryKey: ['ops', 'tables'] });
    },
  });

  const zoneDeleteMutation = useMutation({
    mutationFn: ({ zoneId }: { zoneId: string }) => zoneService.remove(zoneId),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: zonesQueryKey });
      queryClient.invalidateQueries({ queryKey: ['ops', 'tables'] });
      toast.success('Zone deleted.');
      onZoneDeleted(variables.zoneId);
    },
    onError: (error) => showTableInventoryErrorToast('Zone wasn’t deleted.', error),
  });

  return {
    createMutation,
    deleteMutation,
    quickFixMutation,
    updateMutation,
    zoneCreateMutation,
    zoneDeleteMutation,
    zoneUpdateMutation,
  };
}
