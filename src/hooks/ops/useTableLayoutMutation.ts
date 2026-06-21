'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useTableInventoryService } from '@/contexts/ops-services';
import { queryKeys } from '@/lib/query/keys';

import type { RawPosition } from '@/components/features/floor-plan/domain/types';
import type { ListTablesResult, TableInventory } from '@/services/ops/tables';

export type TableLayoutMutationVariables = { tableId: string; position: RawPosition };
type Context = { previous?: ListTablesResult };

/**
 * Persist a dragged table's position to table_inventory.position (admin-only PATCH),
 * with an optimistic cache update + rollback. One PATCH per drop.
 */
export function useTableLayoutMutation(restaurantId: string | null | undefined) {
  const tableService = useTableInventoryService();
  const queryClient = useQueryClient();
  const listKey = restaurantId
    ? queryKeys.opsTables.list(restaurantId, { includeSummary: true })
    : null;

  return useMutation<TableInventory, Error, TableLayoutMutationVariables, Context>({
    mutationFn: ({ tableId, position }) => tableService.update(tableId, { position }),
    onMutate: async ({ tableId, position }) => {
      if (!listKey) return {};
      await queryClient.cancelQueries({ queryKey: listKey });
      const previous = queryClient.getQueryData<ListTablesResult>(listKey);
      if (previous) {
        queryClient.setQueryData<ListTablesResult>(listKey, {
          ...previous,
          tables: previous.tables.map((table) =>
            table.id === tableId ? { ...table, position } : table,
          ),
        });
      }
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (listKey && context?.previous) {
        queryClient.setQueryData(listKey, context.previous);
      }
    },
    onSettled: () => {
      if (listKey) void queryClient.invalidateQueries({ queryKey: listKey });
    },
  });
}
