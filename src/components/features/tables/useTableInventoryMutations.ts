'use client';

import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { toast } from 'sonner';

import { useTableInventoryService, useZoneService } from '@/contexts/ops-services';
import { HttpError } from '@/lib/http/errors';
import { queryKeys } from '@/lib/query/keys';

import { showTableInventoryErrorToast } from './tableInventoryToasts';

import type {
  CreateTablePayload,
  ListTablesResult,
  TableInventory,
  UpdateTablePayload,
} from '@/services/ops/tables';
import type { Zone } from '@/services/ops/zones';

type UseTableInventoryMutationsParams = {
  /** Invalidation stays inside this restaurant's table queries. */
  readonly restaurantId: string | null;
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

type QuickFixFields = Pick<UpdateTablePayload, 'active' | 'status'>;

/** Whether the zones moved by a position change were all renumbered. */
type ZoneReorderOutcome = { failed: false } | { failed: true; error: unknown };

/** A zone write succeeded; the renumbering of other zones may not have. */
export type ZoneSaveResult = { zone: Zone; reorder: ZoneReorderOutcome };

const QUICK_FIX_MUTATION_KEY = ['ops', 'tables', 'quick-fix'] as const;
const ZONE_UPDATE_MUTATION_KEY = ['ops', 'tables', 'zone-update'] as const;

const REORDER_FAILED_NOTE = 'but the other zones weren’t all moved. Check the order and try again.';

/** The table's current values for just the fields a quick fix changes. */
function pickQuickFixFields(table: TableInventory, patch: QuickFixFields): QuickFixFields {
  return {
    ...(patch.active !== undefined ? { active: table.active } : {}),
    ...(patch.status !== undefined ? { status: table.status } : {}),
  };
}

function patchTable(
  queryClient: ReturnType<typeof useQueryClient>,
  tablesQueryKey: QueryKey,
  tableId: string,
  fields: QuickFixFields,
) {
  queryClient.setQueryData<ListTablesResult>(tablesQueryKey, (current) =>
    current
      ? {
          ...current,
          tables: current.tables.map((item) =>
            item.id === tableId ? { ...item, ...fields } : item,
          ),
        }
      : current,
  );
}

function isUpdateForZone(variables: unknown, zoneId: string) {
  return (
    typeof variables === 'object' &&
    variables !== null &&
    'zoneId' in variables &&
    variables.zoneId === zoneId
  );
}

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
  restaurantId,
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

  /** Refetches this restaurant's tables, timeline, capacities and zones, and no one else's. */
  const invalidateRestaurantTables = () => {
    if (!restaurantId) return;
    for (const queryKey of [
      queryKeys.opsTables.list(restaurantId),
      queryKeys.opsTables.timeline(restaurantId),
      queryKeys.opsTables.allowedCapacities(restaurantId),
      queryKeys.opsTables.zones(restaurantId),
    ]) {
      void queryClient.invalidateQueries({ queryKey });
    }
  };

  /**
   * Zones moved by a position change are renumbered one by one after the main save. The main
   * save has already landed by then, so a failure here is reported, not thrown.
   */
  const applyZoneReorder = async (reorder: ZoneReorder): Promise<ZoneReorderOutcome> => {
    try {
      for (const item of reorder) {
        await zoneService.update(item.zoneId, { sortOrder: item.sortOrder });
      }
    } catch (error) {
      return { failed: true, error };
    }
    return { failed: false };
  };

  // Zone writes for a restaurant run one after another, so a quick off/on of a switch reaches the
  // server in order and renumbering never interleaves with another zone save.
  const zoneScope = { id: `ops-zones:${restaurantId ?? 'none'}` };

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
      invalidateRestaurantTables();
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
      invalidateRestaurantTables();
      toast.success(`Table ${table.tableNumber} saved.`);
      onTableSaved(table, false);
    },
    onError: (error, variables) => handleTableSaveError(error, variables.payload.tableNumber),
  });

  const quickFixMutation = useMutation<
    TableInventory,
    unknown,
    TableQuickFixVariables,
    { previous?: QuickFixFields }
  >({
    mutationKey: QUICK_FIX_MUTATION_KEY,
    mutationFn: ({ table, patch }) => tableService.update(table.id, patch),
    // The room, counts and "Needs a look" all read the tables query, so patch it straight away.
    onMutate: async ({ table, patch }) => {
      await queryClient.cancelQueries({ queryKey: tablesQueryKey });
      const current = queryClient
        .getQueryData<ListTablesResult>(tablesQueryKey)
        ?.tables.find((item) => item.id === table.id);
      patchTable(queryClient, tablesQueryKey, table.id, patch);
      return { previous: current ? pickQuickFixFields(current, patch) : undefined };
    },
    onSettled: () => {
      // A refetch now would wipe the optimistic value of a fix still in flight; the last one
      // to finish refetches for all of them.
      if (queryClient.isMutating({ mutationKey: QUICK_FIX_MUTATION_KEY }) > 1) return;
      invalidateRestaurantTables();
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
      // Undo only this table's fields, so other fixes in flight keep their values.
      if (context?.previous) {
        patchTable(queryClient, tablesQueryKey, variables.table.id, context.previous);
      }
      showTableInventoryErrorToast(`Table ${variables.table.tableNumber} wasn’t changed.`, error);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: ({ table }: { table: Pick<TableInventory, 'id' | 'tableNumber'> }) =>
      tableService.remove(table.id),
    onSuccess: (_result, variables) => {
      invalidateRestaurantTables();
      toast.success(`Table ${variables.table.tableNumber} deleted.`);
      onTableDeleted(variables.table);
    },
    onError: (error) => showTableInventoryErrorToast('Table wasn’t deleted.', error),
  });

  const zoneCreateMutation = useMutation({
    scope: zoneScope,
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
    }): Promise<ZoneSaveResult> => {
      const zone = await zoneService.create(restaurantId, name, sortOrder);
      return { zone, reorder: await applyZoneReorder(reorder) };
    },
    onSuccess: ({ zone, reorder }) => {
      addZoneToCaches(queryClient, keys, zone);
      if (reorder.failed) {
        showTableInventoryErrorToast(
          `Zone “${zone.name}” added, ${REORDER_FAILED_NOTE}`,
          reorder.error,
        );
      } else {
        toast.success(`Zone “${zone.name}” added.`);
      }
      // The zone exists either way, so the dialog closes rather than inviting a duplicate.
      onZoneCreated(zone);
    },
    onError: (error) =>
      showTableInventoryErrorToast('Zone wasn’t saved. Your details are still here.', error),
    onSettled: () => invalidateRestaurantTables(),
  });

  const zoneUpdateMutation = useMutation<
    ZoneSaveResult,
    unknown,
    ZoneUpdateVariables,
    ZoneUpdateContext
  >({
    mutationKey: ZONE_UPDATE_MUTATION_KEY,
    scope: zoneScope,
    mutationFn: async ({ zoneId, name, sortOrder, active, reorder = [] }) => {
      const zone = await zoneService.update(zoneId, { name, sortOrder, active });
      return { zone, reorder: await applyZoneReorder(reorder) };
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
    onSuccess: ({ zone, reorder }, variables) => {
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
      if (reorder.failed) {
        showTableInventoryErrorToast(`Zone saved, ${REORDER_FAILED_NOTE}`, reorder.error);
      } else {
        toast.success('Zone updated.');
      }
      onZoneSaved(zone);
    },
    onError: (error, variables, context) => {
      if (isSeasonalToggle(variables)) {
        // Roll back only this zone, so another switch changed meanwhile keeps its state. A later
        // change to the same switch is still queued and owns the value, so leave it alone.
        const laterChangeQueued =
          queryClient.isMutating({
            mutationKey: ZONE_UPDATE_MUTATION_KEY,
            predicate: (mutation) => isUpdateForZone(mutation.state.variables, variables.zoneId),
          }) > 1;
        if (!laterChangeQueued) {
          patchZoneActive(
            queryClient,
            keys,
            variables.zoneId,
            context?.previousActive ?? !variables.active,
          );
        }
        showTableInventoryErrorToast(
          `${variables.zoneName ?? 'The zone'} wasn’t changed. The switch is back to its saved setting.`,
          error,
        );
        return;
      }
      showTableInventoryErrorToast('Zone wasn’t saved. Your details are still here.', error);
    },
    onSettled: () => {
      // Refetching while another zone write is queued would flip its switch back mid-flight.
      if (queryClient.isMutating({ mutationKey: ZONE_UPDATE_MUTATION_KEY }) > 1) return;
      invalidateRestaurantTables();
    },
  });

  const zoneDeleteMutation = useMutation({
    mutationFn: ({ zoneId }: { zoneId: string }) => zoneService.remove(zoneId),
    onSuccess: (_result, variables) => {
      invalidateRestaurantTables();
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
