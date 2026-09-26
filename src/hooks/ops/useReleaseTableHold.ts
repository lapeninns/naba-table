'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query/keys';
import {
  releaseTableHold,
  type ReleaseTableHoldResult,
  type ReleaseTableHoldVariables,
} from '@/services/ops/table-holds';

/**
 * Staff release of a table hold from the timeline. Releasing is idempotent on the server, so no
 * idempotency key is needed; writes are serialised per restaurant. On success only the timeline
 * changes (holds are not part of the table list, dashboard summary or floor-plan layout), so only
 * the restaurant's timeline queries are refetched. Errors are shown inline by the caller.
 */
export function useReleaseTableHold(restaurantId: string | null) {
  const queryClient = useQueryClient();

  return useMutation<ReleaseTableHoldResult, unknown, ReleaseTableHoldVariables>({
    mutationKey: queryKeys.opsTables.releaseHoldMutation(restaurantId),
    scope: { id: `ops-table-holds:${restaurantId ?? 'none'}` },
    mutationFn: releaseTableHold,
    meta: {
      feedback: {
        success: (data) =>
          (data as ReleaseTableHoldResult).alreadyReleased
            ? 'That hold had already ended. The timeline is up to date.'
            : 'Hold released. Those tables are free again.',
        error: false,
      },
    },
    onSuccess: (_data, variables) =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.opsTables.timelinePrefix(variables.restaurantId),
      }),
  });
}
