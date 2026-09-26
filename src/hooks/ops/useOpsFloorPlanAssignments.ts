'use client';

import { useMutation, useMutationState, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import { useBookingService } from '@/contexts/ops-services';
import { HttpError } from '@/lib/http/errors';
import { queryKeys } from '@/lib/query/keys';
import { generateIdempotencyKey } from '@/lib/utils/idempotency';
import { patchDashboardSummaryBooking } from '@/utils/ops/dashboardSummary';

import type { PendingAssignment } from '@/components/features/floor-plan/model/floorPlanState';
import type { ListTablesResult } from '@/services/ops/tables';
import type { OpsBookingStatus, OpsTodayBooking, OpsTodayBookingsSummary } from '@/types/ops';
import type { QueryClient } from '@tanstack/react-query';

export type FloorPlanAssignmentVariables =
  | { kind: 'assign'; bookingId: string; tableIds: string[]; idempotencyKey: string }
  | {
      kind: 'move';
      bookingId: string;
      fromTableIds: string[];
      tableIds: string[];
      idempotencyKey: string;
      restoreKey: string;
    }
  | { kind: 'unassign'; bookingId: string; tableIds: string[] };

type BookingSlice = Pick<
  OpsTodayBooking,
  'status' | 'tableAssignments' | 'requiresTableAssignment'
>;

type AssignmentContext = {
  summaryKey: ReturnType<typeof queryKeys.opsDashboard.summary>;
  previous: BookingSlice | null;
};

export type FloorPlanAssignmentErrorCode =
  | 'CONFLICT'
  | 'LOCKED'
  | 'FORBIDDEN'
  | 'VALIDATION'
  | 'NETWORK'
  | 'UNKNOWN';

/** A user-safe error. `restored` is set for moves: false means the booking was left without a table. */
export class FloorPlanAssignmentError extends Error {
  readonly code: FloorPlanAssignmentErrorCode;
  readonly restored: boolean | null;

  constructor(
    message: string,
    code: FloorPlanAssignmentErrorCode,
    restored: boolean | null = null,
  ) {
    super(message);
    this.name = 'FloorPlanAssignmentError';
    this.code = code;
    this.restored = restored;
  }
}

const SAFE_SERVER_MESSAGE = /^[\w\s.,:;’'()+\-–/&]{1,180}$/;

export function toAssignmentError(error: unknown): FloorPlanAssignmentError {
  if (error instanceof FloorPlanAssignmentError) return error;
  if (error instanceof HttpError) {
    const code = error.code.toUpperCase();
    const serverMessage = SAFE_SERVER_MESSAGE.test(error.message) ? error.message : null;
    if (code === 'ASSIGNMENT_LOCKED') {
      return new FloorPlanAssignmentError(
        'Tables are locked for past or completed bookings.',
        'LOCKED',
      );
    }
    if (error.status === 401 || error.status === 403) {
      return new FloorPlanAssignmentError(
        'You don’t have access to change tables here.',
        'FORBIDDEN',
      );
    }
    if (error.status === 409 || code.includes('CONFLICT') || code === 'ALREADY_ASSIGNED') {
      return new FloorPlanAssignmentError(
        'That table was just taken by another booking. Pick another table.',
        'CONFLICT',
      );
    }
    if (error.status === 422 || error.status === 400) {
      return new FloorPlanAssignmentError(
        serverMessage ?? 'Those tables can’t take this booking.',
        'VALIDATION',
      );
    }
    return new FloorPlanAssignmentError(
      'The server couldn’t save the change. Try again.',
      'UNKNOWN',
    );
  }
  return new FloorPlanAssignmentError(
    'Couldn’t reach the server. Check the connection and try again.',
    'NETWORK',
  );
}

function difference(a: readonly string[], b: readonly string[]): string[] {
  const exclude = new Set(b);
  return a.filter((id) => !exclude.has(id));
}

function currentTableIds(booking: BookingSlice): string[] {
  return [...new Set(booking.tableAssignments.flatMap((g) => g.members.map((m) => m.tableId)))];
}

function readSummaryBooking(
  queryClient: QueryClient,
  summaryKey: AssignmentContext['summaryKey'],
  bookingId: string,
): OpsTodayBooking | null {
  const summary = queryClient.getQueryData<OpsTodayBookingsSummary>(summaryKey);
  return summary?.bookings?.find((b) => b.id === bookingId) ?? null;
}

function writeSummaryBooking(
  queryClient: QueryClient,
  summaryKey: AssignmentContext['summaryKey'],
  bookingId: string,
  patch: (booking: OpsTodayBooking) => OpsTodayBooking,
) {
  queryClient.setQueryData<OpsTodayBookingsSummary>(summaryKey, (current) =>
    current?.bookings ? patchDashboardSummaryBooking(current, bookingId, patch) : current,
  );
}

/** Mirrors the server: assigning confirms a pending booking; removing the last table reopens a confirmed one. */
export function nextStatusAfter(
  status: OpsBookingStatus,
  kind: FloorPlanAssignmentVariables['kind'],
  remainingTables: number,
): OpsBookingStatus {
  if (
    (kind === 'assign' || kind === 'move') &&
    (status === 'pending' || status === 'pending_allocation')
  ) {
    return remainingTables > 0 ? 'confirmed' : status;
  }
  if (remainingTables === 0 && status === 'confirmed') return 'pending';
  return status;
}

function buildAssignments(
  tableIds: readonly string[],
  tables: ListTablesResult | undefined,
): OpsTodayBooking['tableAssignments'] {
  const byId = new Map((tables?.tables ?? []).map((t) => [t.id, t]));
  return tableIds.map((tableId) => {
    const table = byId.get(tableId);
    return {
      groupId: null,
      capacitySum: table?.capacity ?? null,
      members: [
        {
          tableId,
          tableNumber: table?.tableNumber ?? '?',
          capacity: table?.capacity ?? null,
          section: table?.section ?? null,
        },
      ],
    };
  });
}

function withTables(
  booking: OpsTodayBooking,
  tableIds: readonly string[],
  kind: FloorPlanAssignmentVariables['kind'],
  tables: ListTablesResult | undefined,
): OpsTodayBooking {
  const status = nextStatusAfter(booking.status, kind, tableIds.length);
  return {
    ...booking,
    status,
    tableAssignments: buildAssignments(tableIds, tables),
    requiresTableAssignment:
      tableIds.length === 0 && status !== 'cancelled' && status !== 'no_show',
  };
}

function targetTables(
  variables: FloorPlanAssignmentVariables,
  current: readonly string[],
): string[] {
  switch (variables.kind) {
    case 'assign':
      return [...new Set([...current, ...variables.tableIds])];
    case 'move':
      return [...variables.tableIds];
    case 'unassign':
      return difference(current, variables.tableIds);
  }
}

/**
 * Assign, move and unassign bookings on the floor plan.
 *
 * - Optimistic: the dashboard summary (the floor plan's booking source) updates
 *   immediately, and pending changes are exposed via `pending` so tables can show
 *   "Assigning…" wherever they are rendered.
 * - Rollback is per booking rather than a whole-cache snapshot, so concurrent
 *   changes to other bookings survive a failure.
 * - Caches are refetched only when the last concurrent change settles, so an
 *   early refetch can't wipe another change that is still in flight.
 * - A move is unassign-then-assign (there is no atomic move RPC yet). If the
 *   assign fails, the original tables are re-assigned and `restored` reports
 *   whether that worked.
 */
export function useOpsFloorPlanAssignments({
  restaurantId,
  date,
}: {
  restaurantId: string | null;
  /** Same value passed to useOpsFloorPlan (null = today), so cache keys match. */
  date: string | null;
}) {
  const bookingService = useBookingService();
  const queryClient = useQueryClient();
  const mutationKey = useMemo(
    () => queryKeys.opsFloorPlan.assignments(restaurantId ?? 'none'),
    [restaurantId],
  );
  const summaryKey = useMemo(
    () => queryKeys.opsDashboard.summary(restaurantId ?? 'none', date),
    [date, restaurantId],
  );

  const mutation = useMutation<
    void,
    FloorPlanAssignmentError,
    FloorPlanAssignmentVariables,
    AssignmentContext
  >({
    mutationKey,
    mutationFn: async (variables) => {
      try {
        if (variables.kind === 'assign') {
          await bookingService.assignTablesDirect({
            bookingId: variables.bookingId,
            tableIds: variables.tableIds,
            idempotencyKey: variables.idempotencyKey,
          });
          return;
        }
        if (variables.kind === 'unassign') {
          await bookingService.unassignTablesDirect({
            bookingId: variables.bookingId,
            tableIds: variables.tableIds,
          });
          return;
        }
      } catch (error) {
        throw toAssignmentError(error);
      }

      const removed = difference(variables.fromTableIds, variables.tableIds);
      const added = difference(variables.tableIds, variables.fromTableIds);
      if (removed.length > 0) {
        try {
          await bookingService.unassignTablesDirect({
            bookingId: variables.bookingId,
            tableIds: removed,
          });
        } catch (error) {
          // Nothing changed yet, so the booking keeps its original tables.
          const mapped = toAssignmentError(error);
          throw new FloorPlanAssignmentError(mapped.message, mapped.code, true);
        }
      }
      if (added.length === 0) return;
      try {
        await bookingService.assignTablesDirect({
          bookingId: variables.bookingId,
          tableIds: added,
          idempotencyKey: variables.idempotencyKey,
        });
      } catch (error) {
        const mapped = toAssignmentError(error);
        let restored = removed.length === 0;
        if (!restored) {
          try {
            await bookingService.assignTablesDirect({
              bookingId: variables.bookingId,
              tableIds: removed,
              idempotencyKey: variables.restoreKey,
            });
            restored = true;
          } catch {
            restored = false;
          }
        }
        throw new FloorPlanAssignmentError(mapped.message, mapped.code, restored);
      }
    },
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: summaryKey });
      const booking = readSummaryBooking(queryClient, summaryKey, variables.bookingId);
      if (!booking) return { summaryKey, previous: null };
      const previous: BookingSlice = {
        status: booking.status,
        tableAssignments: booking.tableAssignments,
        requiresTableAssignment: booking.requiresTableAssignment,
      };
      const tables = restaurantId
        ? queryClient.getQueryData<ListTablesResult>(queryKeys.opsTables.list(restaurantId))
        : undefined;
      const next = targetTables(variables, currentTableIds(previous));
      writeSummaryBooking(queryClient, summaryKey, variables.bookingId, (b) =>
        withTables(b, next, variables.kind, tables),
      );
      return { summaryKey, previous };
    },
    onError: (error, variables, context) => {
      if (!context?.previous) return;
      const previous = context.previous;
      if (variables.kind === 'move' && error.restored === false) {
        // The original tables were released and could not be taken back.
        writeSummaryBooking(queryClient, context.summaryKey, variables.bookingId, (b) =>
          withTables({ ...b, ...previous }, [], 'unassign', undefined),
        );
        return;
      }
      writeSummaryBooking(queryClient, context.summaryKey, variables.bookingId, (b) => ({
        ...b,
        ...previous,
      }));
    },
    onSettled: async () => {
      // Only the last in-flight change refetches; earlier refetches would overwrite
      // optimistic state that is still pending.
      if (queryClient.isMutating({ mutationKey }) > 1 || !restaurantId) return;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: summaryKey }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.opsTables.timelinePrefix(restaurantId),
        }),
        queryClient.invalidateQueries({ queryKey: ['ops', 'dashboard', restaurantId, 'heatmap'] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.opsBookings.all, refetchType: 'none' }),
      ]);
    },
  });

  const pendingVariables = useMutationState<FloorPlanAssignmentVariables | undefined>({
    filters: { mutationKey, status: 'pending' },
    select: (m) => m.state.variables as FloorPlanAssignmentVariables | undefined,
  });

  const pending = useMemo<PendingAssignment[]>(
    () =>
      pendingVariables
        .filter((v): v is FloorPlanAssignmentVariables => Boolean(v))
        .map((v) => ({
          bookingId: v.bookingId,
          kind: v.kind,
          tableIds: v.kind === 'unassign' ? [] : v.tableIds,
          previousTableIds:
            v.kind === 'move' ? v.fromTableIds : v.kind === 'unassign' ? v.tableIds : [],
        })),
    [pendingVariables],
  );

  const { mutateAsync } = mutation;

  const assign = useCallback(
    (bookingId: string, tableIds: string[]) =>
      mutateAsync({
        kind: 'assign',
        bookingId,
        tableIds,
        idempotencyKey: generateIdempotencyKey(),
      }),
    [mutateAsync],
  );

  const move = useCallback(
    (bookingId: string, fromTableIds: string[], tableIds: string[]) =>
      mutateAsync({
        kind: 'move',
        bookingId,
        fromTableIds,
        tableIds,
        idempotencyKey: generateIdempotencyKey(),
        restoreKey: generateIdempotencyKey(),
      }),
    [mutateAsync],
  );

  const unassign = useCallback(
    (bookingId: string, tableIds: string[]) =>
      mutateAsync({ kind: 'unassign', bookingId, tableIds }),
    [mutateAsync],
  );

  return { assign, move, unassign, pending, isPending: pending.length > 0 };
}
