'use client';

import { useMutationState, useQueryClient, type MutationOptions } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import { useBookingService } from '@/contexts/ops-services';
import { queryKeys } from '@/lib/query/keys';
import { generateIdempotencyKey } from '@/lib/utils/idempotency';

import {
  cancelBookingQueries,
  captureBookingRollback,
  patchBookingCaches,
  readBookingRow,
  refreshBookingAfterConflict,
  rollbackBookingWrite,
  tableIdsOf,
  type BookingRollback,
  type TableAssignmentGroups,
} from './bookingCacheSync';
import { recordBookingWrite } from './bookingWriteEcho';
import { nextStatusAfter } from './useOpsFloorPlanAssignments';

import type { AppMutationMeta } from '@/lib/query/meta';
import type { OpsBookingStatus } from '@/types/ops';

export type TableAssignmentVariables =
  | {
      kind: 'assign';
      bookingId: string;
      tableId: string;
      /** For the optimistic row until the server answers. */
      tableName?: string;
      /** One per user intent (C5); sent as the Idempotency-Key header. */
      idempotencyKey: string;
    }
  | { kind: 'unassign'; bookingId: string; tableId: string };

type MutationContext = { rollback: BookingRollback; previousStatus: OpsBookingStatus | null };

type TableAssignmentsResponse = { tableAssignments: TableAssignmentGroups };

export type TableActionState = {
  type: 'assign' | 'unassign';
  bookingId: string | null;
  tableId?: string | null;
  tableName?: string;
} | null;

const TABLE_ASSIGNMENT_ERROR_COPY: Partial<Record<string, string>> = {
  ASSIGNMENT_CONFLICT: 'That table was just taken by another booking. Pick another table.',
  HOLD_CONFLICT: 'That table is held for another booking right now. Pick another table.',
  ASSIGNMENT_VALIDATION: 'That table can’t take this booking.',
  TABLE_NOT_FOUND: 'That table no longer exists. Refresh and pick another table.',
  BOOKING_NOT_FOUND: 'This booking no longer exists.',
  ASSIGNMENT_UNAVAILABLE: 'Table assignment is briefly unavailable. Try again in a moment.',
  ASSIGNMENT_LOCKED: 'Tables are locked for past or completed bookings.',
};

function withMember(
  groups: TableAssignmentGroups,
  tableId: string,
  tableName: string | undefined,
): TableAssignmentGroups {
  if (groups.some((group) => group.members.some((member) => member.tableId === tableId))) {
    return groups;
  }
  const member = { tableId, tableNumber: tableName ?? '?', capacity: null, section: null };
  if (groups.length === 0) return [{ groupId: null, capacitySum: null, members: [member] }];
  const [first, ...rest] = groups;
  return [{ ...first, members: [...first.members, member] }, ...rest];
}

function withoutMember(groups: TableAssignmentGroups, tableId: string): TableAssignmentGroups {
  return groups
    .map((group) => ({
      ...group,
      members: group.members.filter((member) => member.tableId !== tableId),
    }))
    .filter((group) => group.members.length > 0);
}

/**
 * Single-table assign/unassign from the dashboard (POST/DELETE /api/ops/bookings/:id/tables).
 *
 * Follows the floor-plan per-booking slice pattern: the optimistic patch and the rollback touch
 * only this booking's row in each cache, the server's `tableAssignments` are written back with
 * `setQueryData`, and nothing under `['ops','bookings']` is refetched. Each write runs in the
 * booking's mutation scope. Errors are shown as toasts; `assign`/`unassign` resolve with the
 * booking's assignments after the write (or after the rollback) and never reject.
 */
export function useOpsTableAssignmentActions(params: {
  restaurantId: string | null;
  /** Kept for API stability; caches are patched on every summary date that holds the booking. */
  date?: string | null;
}) {
  const { restaurantId } = params;
  const bookingService = useBookingService();
  const queryClient = useQueryClient();

  const execute = useCallback(
    (variables: TableAssignmentVariables): Promise<TableAssignmentsResponse> => {
      const meta: AppMutationMeta = {
        feedback: {
          error: {
            copy: TABLE_ASSIGNMENT_ERROR_COPY,
            fallback:
              variables.kind === 'assign'
                ? 'Unable to assign the table. Try again.'
                : 'Unable to remove the table. Try again.',
          },
        },
      };
      const options: MutationOptions<
        TableAssignmentsResponse,
        unknown,
        TableAssignmentVariables,
        MutationContext
      > = {
        mutationKey: queryKeys.opsBookings.tableAssignmentMutation(),
        scope: { id: `booking:${variables.bookingId}` },
        meta,
        mutationFn: (vars) =>
          vars.kind === 'assign'
            ? bookingService.assignTable({
                bookingId: vars.bookingId,
                tableId: vars.tableId,
                idempotencyKey: vars.idempotencyKey,
              })
            : bookingService.unassignTable({ bookingId: vars.bookingId, tableId: vars.tableId }),
        onMutate: async (vars) => {
          await cancelBookingQueries(queryClient, vars.bookingId, restaurantId);
          const rollback = captureBookingRollback(queryClient, vars.bookingId);
          const row = readBookingRow(queryClient, vars.bookingId);
          if (row) {
            const groups =
              vars.kind === 'assign'
                ? withMember(row.tableAssignments, vars.tableId, vars.tableName)
                : withoutMember(row.tableAssignments, vars.tableId);
            patchBookingCaches(
              queryClient,
              vars.bookingId,
              {
                tableAssignments: groups,
                status: nextStatusAfter(row.status, vars.kind, tableIdsOf(groups).length),
              },
              { restaurantId },
            );
          }
          return { rollback, previousStatus: row?.status ?? null };
        },
        onSuccess: (data, vars, context) => {
          const groups = data.tableAssignments ?? [];
          const status = context?.previousStatus
            ? nextStatusAfter(context.previousStatus, vars.kind, tableIdsOf(groups).length)
            : undefined;
          patchBookingCaches(
            queryClient,
            vars.bookingId,
            { tableAssignments: groups, ...(status ? { status } : {}) },
            { restaurantId, pruneLists: true },
          );
          recordBookingWrite(queryClient, vars.bookingId, { status: status ?? null });
          if (restaurantId) {
            void queryClient.invalidateQueries({
              queryKey: queryKeys.opsDashboard.heatmapPrefix(restaurantId),
            });
            void queryClient.invalidateQueries({
              queryKey: queryKeys.opsTables.timelinePrefix(restaurantId),
            });
          }
        },
        onError: (_error, vars, context) => {
          if (!context) return;
          if (rollbackBookingWrite(queryClient, context.rollback) === 'refresh') {
            // Queued behind another write on this booking: its outcome is unknown here.
            void refreshBookingAfterConflict(queryClient, {
              bookingId: vars.bookingId,
              restaurantId,
              currentStatus: null,
              fetchBooking: () => bookingService.getBooking(vars.bookingId),
            });
          }
        },
      };
      return queryClient.getMutationCache().build(queryClient, options).execute(variables);
    },
    [bookingService, queryClient, restaurantId],
  );

  const settle = useCallback(
    async (variables: TableAssignmentVariables): Promise<TableAssignmentGroups> => {
      try {
        const data = await execute(variables);
        return data.tableAssignments ?? [];
      } catch {
        // The toast already explained the failure; report the rolled-back assignments.
        return readBookingRow(queryClient, variables.bookingId)?.tableAssignments ?? [];
      }
    },
    [execute, queryClient],
  );

  const assign = useCallback(
    (input: { bookingId: string; tableId: string; tableName?: string; idempotencyKey?: string }) =>
      settle({
        kind: 'assign',
        bookingId: input.bookingId,
        tableId: input.tableId,
        tableName: input.tableName,
        idempotencyKey: input.idempotencyKey ?? generateIdempotencyKey(),
      }),
    [settle],
  );

  const unassign = useCallback(
    (input: { bookingId: string; tableId: string }) =>
      settle({ kind: 'unassign', bookingId: input.bookingId, tableId: input.tableId }),
    [settle],
  );

  const pendingVariables = useMutationState({
    filters: { mutationKey: queryKeys.opsBookings.tableAssignmentMutation(), status: 'pending' },
    select: (mutation) => mutation.state.variables as TableAssignmentVariables | undefined,
  });

  const pendingAction = useMemo<TableActionState>(() => {
    const latest = pendingVariables.at(-1);
    if (!latest) return null;
    return {
      type: latest.kind,
      bookingId: latest.bookingId,
      tableId: latest.tableId,
      ...(latest.kind === 'assign' && latest.tableName ? { tableName: latest.tableName } : {}),
    };
  }, [pendingVariables]);

  return { assign, unassign, pendingAction };
}

export type OpsTableAssignmentActions = ReturnType<typeof useOpsTableAssignmentActions>;
