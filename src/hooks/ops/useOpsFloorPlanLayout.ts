'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useTableInventoryService } from '@/contexts/ops-services';
import { HttpError } from '@/lib/http/errors';
import { queryKeys } from '@/lib/query/keys';

import type { FloorPosition } from '@/components/features/floor-plan/model/floorPlanTypes';
import type { ListTablesResult, TableInventory } from '@/services/ops/tables';

export type LayoutChange = { tableId: string; position: FloorPosition };

export type LayoutSaveResult = {
  saved: string[];
  failed: Array<{ tableId: string; message: string }>;
};

type LayoutContext = {
  listKey: ReturnType<typeof queryKeys.opsTables.list>;
  previous: Map<string, TableInventory['position']>;
};

const SAVE_CONCURRENCY = 4;

function toStoredPosition(position: FloorPosition): Record<string, number> {
  return {
    x: Math.round(position.x),
    y: Math.round(position.y),
    rotation: Math.round(position.rotation),
  };
}

function saveErrorMessage(error: unknown): string {
  if (error instanceof HttpError) {
    if (error.status === 401 || error.status === 403) return 'Only managers can change the layout.';
    if (error.status === 404) return 'This table was deleted.';
    return 'The server couldn’t save this table.';
  }
  return 'The server didn’t respond.';
}

async function runWithConcurrency<T>(
  items: readonly T[],
  limit: number,
  worker: (item: T) => Promise<void>,
) {
  const queue = [...items];
  const runners = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    for (let item = queue.shift(); item !== undefined; item = queue.shift()) {
      await worker(item);
    }
  });
  await Promise.all(runners);
}

function patchPositions(
  data: ListTablesResult | undefined,
  positions: ReadonlyMap<string, TableInventory['position']>,
): ListTablesResult | undefined {
  if (!data) return data;
  return {
    ...data,
    tables: data.tables.map((table) =>
      positions.has(table.id) ? { ...table, position: positions.get(table.id) ?? null } : table,
    ),
  };
}

/**
 * Saves Arrange-mode positions. There is no bulk endpoint, so each table is
 * PATCHed (a few at a time) and the result reports per-table success, letting
 * the caller keep unsaved drafts only for the tables that failed.
 * The shared tables cache is updated optimistically and failed tables are
 * reverted, so Tables settings sees the same layout without a refetch.
 */
export function useOpsFloorPlanLayoutSave(restaurantId: string | null) {
  const tableService = useTableInventoryService();
  const queryClient = useQueryClient();

  return useMutation<LayoutSaveResult, Error, LayoutChange[], LayoutContext>({
    mutationKey: queryKeys.opsFloorPlan.layout(restaurantId ?? 'none'),
    mutationFn: async (changes) => {
      const saved: string[] = [];
      const failed: LayoutSaveResult['failed'] = [];
      await runWithConcurrency(changes, SAVE_CONCURRENCY, async (change) => {
        try {
          await tableService.update(change.tableId, {
            position: toStoredPosition(change.position),
          });
          saved.push(change.tableId);
        } catch (error) {
          failed.push({ tableId: change.tableId, message: saveErrorMessage(error) });
        }
      });
      return { saved, failed };
    },
    onMutate: async (changes) => {
      const listKey = queryKeys.opsTables.list(restaurantId ?? 'none');
      await queryClient.cancelQueries({ queryKey: listKey, exact: true });
      const current = queryClient.getQueryData<ListTablesResult>(listKey);
      const previous = new Map<string, TableInventory['position']>();
      for (const change of changes) {
        const table = current?.tables.find((t) => t.id === change.tableId);
        previous.set(change.tableId, table?.position ?? null);
      }
      const next = new Map(changes.map((c) => [c.tableId, toStoredPosition(c.position)]));
      queryClient.setQueryData<ListTablesResult>(listKey, (data) => patchPositions(data, next));
      return { listKey, previous };
    },
    onSuccess: (result, _changes, context) => {
      if (result.failed.length === 0) return;
      const revert = new Map(
        result.failed.map((f) => [f.tableId, context.previous.get(f.tableId) ?? null]),
      );
      queryClient.setQueryData<ListTablesResult>(context.listKey, (data) =>
        patchPositions(data, revert),
      );
    },
    onError: (_error, _changes, context) => {
      if (!context) return;
      queryClient.setQueryData<ListTablesResult>(context.listKey, (data) =>
        patchPositions(data, context.previous),
      );
    },
    onSettled: (_result, _error, _changes, context) => {
      if (context) void queryClient.invalidateQueries({ queryKey: context.listKey, exact: true });
    },
  });
}
