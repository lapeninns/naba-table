'use client';

import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
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

/**
 * The restaurant and cache keys a mutation started on. The page swaps restaurants without
 * remounting, and TanStack Query re-binds a pending mutation's callbacks on every render, so
 * callbacks read these from the mutation's own context instead of the latest render.
 */
type MutationTarget = {
  restaurantId: string | null;
  tablesQueryKey: QueryKey;
  zonesQueryKey: QueryKey;
};

type TargetContext = { target: MutationTarget };

type ZoneUpdateContext = TargetContext & { previousActive?: boolean };

type QuickFixFields = Pick<UpdateTablePayload, 'active' | 'status'>;

/** Whether the zones moved by a position change were all renumbered. */
type ZoneReorderOutcome = { failed: false } | { failed: true; error: unknown };

/** A zone write succeeded; the renumbering of other zones may not have. */
export type ZoneSaveResult = { zone: Zone; reorder: ZoneReorderOutcome };

/**
 * Every mutation is keyed by restaurant. When the key changes, TanStack Query detaches the pending
 * mutation from the hook instead of re-binding it, so it keeps the callbacks (and target) of the
 * restaurant it started on. The in-flight counts below also only see that restaurant's writes.
 */
const tableMutationKey = (restaurantId: string | null, name: string) =>
  ['ops', 'tables', restaurantId ?? 'none', name] as const;

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
  // Captured by each mutation's onMutate; see MutationTarget.
  const currentTarget: MutationTarget = { restaurantId, tablesQueryKey, zonesQueryKey };
  const captureTarget = (): TargetContext => ({ target: currentTarget });
  /**
   * Each zone's in-service value as the server last confirmed it, keyed by restaurant and zone.
   * Queued toggles patch the cache before they run, so the cache can't tell a rollback where to go.
   */
  const confirmedZoneActive = useRef(new Map<string, boolean>());
  /**
   * Toasts outlive this hook, but an Undo runs through it, and so against whichever restaurant it
   * is on by then. Undo toasts are dismissed on a switch or unmount, and a write that finishes
   * after one gets no Undo. `undoRestaurant` is null once unmounted.
   */
  const undoToastIds = useRef(new Set<string | number>());
  const undoRestaurant = useRef<{ restaurantId: string | null } | null>(null);
  useEffect(() => {
    undoRestaurant.current = { restaurantId };
    const toastIds = undoToastIds.current;
    return () => {
      undoRestaurant.current = null;
      for (const id of toastIds) toast.dismiss(id);
      toastIds.clear();
    };
  }, [restaurantId]);

  const showSuccessWithUndo = (
    target: MutationTarget,
    message: string,
    onUndo: (() => void) | null,
  ) => {
    if (!onUndo || undoRestaurant.current?.restaurantId !== target.restaurantId) {
      toast.success(message);
      return;
    }
    const forget = () => undoToastIds.current.delete(toastId);
    const toastId = toast.success(message, {
      action: { label: 'Undo', onClick: onUndo },
      onDismiss: forget,
      onAutoClose: forget,
    });
    undoToastIds.current.add(toastId);
  };

  /** Refetches one restaurant's tables, timeline, capacities and zones, and no one else's. */
  const invalidateRestaurantTables = (target: MutationTarget | undefined) => {
    const targetRestaurantId = target?.restaurantId;
    if (!targetRestaurantId) return;
    for (const queryKey of [
      queryKeys.opsTables.list(targetRestaurantId),
      queryKeys.opsTables.timeline(targetRestaurantId),
      queryKeys.opsTables.allowedCapacities(targetRestaurantId),
      queryKeys.opsTables.zones(targetRestaurantId),
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
  // server in order and renumbering never interleaves with another zone save or delete.
  const zoneScope = { id: `ops-zones:${restaurantId ?? 'none'}` };

  /** Zone updates still in flight for one zone of the target restaurant, this one included. */
  const countZoneUpdates = (target: MutationTarget, zoneId: string) =>
    queryClient.isMutating({
      mutationKey: tableMutationKey(target.restaurantId, 'zone-update'),
      predicate: (mutation) => isUpdateForZone(mutation.state.variables, zoneId),
    });

  const handleTableSaveError = (error: unknown, tableNumber: string) => {
    if (error instanceof HttpError && error.status === 409) {
      onTableNumberConflict(tableNumber);
      return;
    }
    showTableInventoryErrorToast('Table wasn’t saved. Your details are still here.', error);
  };

  const createMutation = useMutation<
    TableInventory,
    unknown,
    { restaurantId: string; payload: CreateTablePayload },
    TargetContext
  >({
    mutationKey: tableMutationKey(restaurantId, 'create'),
    mutationFn: ({
      restaurantId,
      payload,
    }: {
      restaurantId: string;
      payload: CreateTablePayload;
    }) => tableService.create(restaurantId, payload),
    onMutate: captureTarget,
    onSuccess: (table, _variables, context) => {
      invalidateRestaurantTables(context.target);
      toast.success(
        table.zoneName
          ? `Table ${table.tableNumber} added to ${table.zoneName}.`
          : `Table ${table.tableNumber} added.`,
      );
      onTableSaved(table, true);
    },
    onError: (error, variables) => handleTableSaveError(error, variables.payload.tableNumber),
  });

  const updateMutation = useMutation<
    TableInventory,
    unknown,
    { tableId: string; payload: UpdateTablePayload & { tableNumber: string } },
    TargetContext
  >({
    mutationKey: tableMutationKey(restaurantId, 'update'),
    mutationFn: ({
      tableId,
      payload,
    }: {
      tableId: string;
      payload: UpdateTablePayload & { tableNumber: string };
    }) => tableService.update(tableId, payload),
    onMutate: captureTarget,
    onSuccess: (table, _variables, context) => {
      invalidateRestaurantTables(context.target);
      toast.success(`Table ${table.tableNumber} saved.`);
      onTableSaved(table, false);
    },
    onError: (error, variables) => handleTableSaveError(error, variables.payload.tableNumber),
  });

  const quickFixMutation = useMutation<
    TableInventory,
    unknown,
    TableQuickFixVariables,
    TargetContext & { previous?: QuickFixFields }
  >({
    mutationKey: tableMutationKey(restaurantId, 'quick-fix'),
    mutationFn: ({ table, patch }) => tableService.update(table.id, patch),
    // The room, counts and "Needs a look" all read the tables query, so patch it straight away.
    onMutate: async ({ table, patch }) => {
      const { target } = captureTarget();
      await queryClient.cancelQueries({ queryKey: target.tablesQueryKey });
      const current = queryClient
        .getQueryData<ListTablesResult>(target.tablesQueryKey)
        ?.tables.find((item) => item.id === table.id);
      patchTable(queryClient, target.tablesQueryKey, table.id, patch);
      return { target, previous: current ? pickQuickFixFields(current, patch) : undefined };
    },
    onSettled: (_table, _error, _variables, context) => {
      const target = context?.target;
      // A refetch now would wipe the optimistic value of a fix still in flight; the last one
      // to finish refetches for all of them.
      if (
        target &&
        queryClient.isMutating({
          mutationKey: tableMutationKey(target.restaurantId, 'quick-fix'),
        }) > 1
      ) {
        return;
      }
      invalidateRestaurantTables(target);
    },
    onSuccess: (_table, variables, context) => {
      const { undo } = variables;
      showSuccessWithUndo(
        context.target,
        variables.message,
        undo
          ? () =>
              quickFixMutation.mutate({
                table: variables.table,
                patch: undo,
                undo: null,
                message: `Table ${variables.table.tableNumber} is back as it was.`,
              })
          : null,
      );
    },
    onError: (error, variables, context) => {
      // Undo only this table's fields, so other fixes in flight keep their values.
      if (context?.previous) {
        patchTable(
          queryClient,
          context.target.tablesQueryKey,
          variables.table.id,
          context.previous,
        );
      }
      showTableInventoryErrorToast(`Table ${variables.table.tableNumber} wasn’t changed.`, error);
    },
  });

  const deleteMutation = useMutation<
    void,
    unknown,
    { table: Pick<TableInventory, 'id' | 'tableNumber'> },
    TargetContext
  >({
    mutationKey: tableMutationKey(restaurantId, 'delete'),
    mutationFn: ({ table }) => tableService.remove(table.id),
    onMutate: captureTarget,
    onSuccess: (_result, variables, context) => {
      invalidateRestaurantTables(context.target);
      toast.success(`Table ${variables.table.tableNumber} deleted.`);
      onTableDeleted(variables.table);
    },
    onError: (error) => showTableInventoryErrorToast('Table wasn’t deleted.', error),
  });

  const zoneCreateMutation = useMutation<
    ZoneSaveResult,
    unknown,
    { restaurantId: string; name: string; sortOrder?: number; reorder?: ZoneReorder },
    TargetContext
  >({
    mutationKey: tableMutationKey(restaurantId, 'zone-create'),
    scope: zoneScope,
    mutationFn: async ({ restaurantId, name, sortOrder, reorder = [] }) => {
      const zone = await zoneService.create(restaurantId, name, sortOrder);
      return { zone, reorder: await applyZoneReorder(reorder) };
    },
    onMutate: captureTarget,
    onSuccess: ({ zone, reorder }, _variables, context) => {
      addZoneToCaches(queryClient, context.target, zone);
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
    onSettled: (_result, _error, _variables, context) =>
      invalidateRestaurantTables(context?.target),
  });

  const zoneUpdateMutation = useMutation<
    ZoneSaveResult,
    unknown,
    ZoneUpdateVariables,
    ZoneUpdateContext
  >({
    mutationKey: tableMutationKey(restaurantId, 'zone-update'),
    scope: zoneScope,
    mutationFn: async ({ zoneId, name, sortOrder, active, reorder = [] }) => {
      const zone = await zoneService.update(zoneId, { name, sortOrder, active });
      return { zone, reorder: await applyZoneReorder(reorder) };
    },
    onMutate: async (variables) => {
      const { target } = captureTarget();
      if (!isSeasonalToggle(variables)) {
        return { target };
      }
      // Zones are read from the tables query when it carries a summary, and from the zones query
      // otherwise, so the switch patches both for an immediate update.
      await Promise.all([
        queryClient.cancelQueries({ queryKey: target.tablesQueryKey }),
        queryClient.cancelQueries({ queryKey: target.zonesQueryKey }),
      ]);
      // A queued toggle for the same zone runs this before the earlier one reaches the server, so
      // only the first toggle in a run reads the cache; the rest share the confirmed value.
      const confirmedKey = `${target.restaurantId ?? 'none'}:${variables.zoneId}`;
      const earlierToggleInFlight = countZoneUpdates(target, variables.zoneId) > 1;
      if (!earlierToggleInFlight || !confirmedZoneActive.current.has(confirmedKey)) {
        const cached = readZoneActive(queryClient, target, variables.zoneId);
        if (cached !== undefined) confirmedZoneActive.current.set(confirmedKey, cached);
      }
      const previousActive = confirmedZoneActive.current.get(confirmedKey);
      patchZoneActive(queryClient, target, variables.zoneId, variables.active);
      return { target, previousActive };
    },
    onSuccess: ({ zone, reorder }, variables, context) => {
      if (isSeasonalToggle(variables)) {
        confirmedZoneActive.current.set(
          `${context.target.restaurantId ?? 'none'}:${zone.id}`,
          zone.active,
        );
        const name = variables.zoneName ?? zone.name;
        showSuccessWithUndo(
          context.target,
          zone.active
            ? `${name} is back in service. Its active tables can be booked.`
            : `${name} is out of service. Its tables are kept but can’t be booked.`,
          () =>
            zoneUpdateMutation.mutate({ zoneId: zone.id, active: !zone.active, zoneName: name }),
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
        const target = context?.target;
        const laterChangeQueued = target ? countZoneUpdates(target, variables.zoneId) > 1 : false;
        if (target && !laterChangeQueued) {
          const confirmed = confirmedZoneActive.current.get(
            `${target.restaurantId ?? 'none'}:${variables.zoneId}`,
          );
          patchZoneActive(
            queryClient,
            target,
            variables.zoneId,
            confirmed ?? context.previousActive ?? !variables.active,
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
    onSettled: (_result, _error, _variables, context) => {
      const target = context?.target;
      // Refetching while another zone write is queued would flip its switch back mid-flight.
      if (
        target &&
        queryClient.isMutating({
          mutationKey: tableMutationKey(target.restaurantId, 'zone-update'),
        }) > 1
      ) {
        return;
      }
      invalidateRestaurantTables(target);
    },
  });

  const zoneDeleteMutation = useMutation<void, unknown, { zoneId: string }, TargetContext>({
    mutationKey: tableMutationKey(restaurantId, 'zone-delete'),
    scope: zoneScope,
    mutationFn: ({ zoneId }) => zoneService.remove(zoneId),
    onMutate: captureTarget,
    onSuccess: (_result, variables, context) => {
      invalidateRestaurantTables(context.target);
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
