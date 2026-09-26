'use client';

import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { useBookingService } from '@/contexts/ops-services';
import { HttpError } from '@/lib/http/errors';
import { queryKeys } from '@/lib/query/keys';
import {
  buildTableAssignments,
  patchBookingCaches,
  readBookingRow,
} from '@src/hooks/ops/bookingCacheSync';
import { recordBookingWrite } from '@src/hooks/ops/bookingWriteEcho';
import { nextStatusAfter } from '@src/hooks/ops/useOpsFloorPlanAssignments';

import type { AssignmentContext, OpsBookingDialogBundle } from '@/services/ops/bookings';
import type { OpsBookingStatus } from '@/types/ops';

export type AssignTablesVariables = {
  bookingId: string;
  tableIds: string[];
  /** One per user intent, reused when the same selection is retried (C5). */
  idempotencyKey: string;
};

export type UnassignTablesVariables = { bookingId: string; tableIds: string[] };

export type AutoAssignVariables = {
  bookingId: string;
  /** Idempotency key for confirming the smart-assign hold. */
  idempotencyKey: string;
};

/**
 * Client-side smart-assign outcomes. They carry a code and no server text (the quote's `reason`
 * is a server string and is never shown); the panel maps the codes to fixed copy.
 */
export const SMART_ASSIGN_NO_CANDIDATE = 'SMART_ASSIGN_NO_CANDIDATE';
export const SMART_ASSIGN_NO_HOLD = 'SMART_ASSIGN_NO_HOLD';

function smartAssignError(code: string): HttpError {
  return new HttpError({ message: code, status: 422, code, hasServerMessage: false });
}

const OPS_BOOKING_STATUSES = new Set<OpsBookingStatus>([
  'pending',
  'pending_allocation',
  'confirmed',
  'checked_in',
  'cancelled',
  'completed',
  'no_show',
  'PRIORITY_WAITLIST',
]);

function asBookingStatus(value: string | null | undefined): OpsBookingStatus | null {
  return value && OPS_BOOKING_STATUSES.has(value as OpsBookingStatus)
    ? (value as OpsBookingStatus)
    : null;
}

/** The booking's current table ids, from the dialog caches first. */
function currentTableIds(queryClient: QueryClient, bookingId: string): string[] {
  const context =
    queryClient.getQueryData<AssignmentContext>(
      queryKeys.opsBookings.assignmentContext(bookingId),
    ) ??
    queryClient.getQueryData<OpsBookingDialogBundle>(queryKeys.opsBookings.dialog(bookingId))
      ?.assignmentContext;
  if (context) return context.bookingAssignments;
  return (readBookingRow(queryClient, bookingId)?.tableAssignments ?? []).flatMap((group) =>
    group.members.map((member) => member.tableId),
  );
}

/**
 * Writes for the booking dialog's table panel. Each write is one request; the result is applied
 * to every cache holding the booking (dialog bundle, assignment context, dashboard summaries,
 * lists) and the dialog bundle is the one background revalidation (it carries conflicts and holds,
 * which the write response does not). Writes for the booking run in its mutation scope.
 */
export function useTableAssignmentMutations({
  bookingId,
  onAssignmentComplete,
  restaurantId,
  resetSelectedTables,
}: {
  bookingId: string;
  onAssignmentComplete: (() => void) | undefined;
  restaurantId: string;
  resetSelectedTables: () => void;
}) {
  const queryClient = useQueryClient();
  const bookingService = useBookingService();
  const scope = { id: `booking:${bookingId}` };
  const mutationKey = queryKeys.opsBookings.assignmentPanelMutation();

  const applyTables = useCallback(
    (
      targetBookingId: string,
      tableIds: string[],
      serverStatus: string | null,
      kind: 'assign' | 'unassign',
    ) => {
      const previous = readBookingRow(queryClient, targetBookingId)?.status ?? null;
      const status =
        asBookingStatus(serverStatus) ??
        (previous ? nextStatusAfter(previous, kind, tableIds.length) : null);
      const { groups } = buildTableAssignments(
        queryClient,
        restaurantId,
        targetBookingId,
        tableIds,
      );
      patchBookingCaches(
        queryClient,
        targetBookingId,
        { tableAssignments: groups, ...(status ? { status } : {}) },
        { restaurantId, pruneLists: true },
      );
      recordBookingWrite(queryClient, targetBookingId, { status });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.opsBookings.dialog(targetBookingId),
        exact: true,
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.opsBookings.assignmentContext(targetBookingId),
        exact: true,
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.opsDashboard.heatmapPrefix(restaurantId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.opsTables.timelinePrefix(restaurantId),
      });
      // A status change (pending -> confirmed on assign, back to pending when the last table
      // goes) moves the booking between the bookings-page status tabs.
      if (status && status !== previous) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.opsBookings.statusSummaryPrefix(restaurantId),
        });
      }
    },
    [queryClient, restaurantId],
  );

  const assignMutation = useMutation({
    mutationKey,
    scope,
    mutationFn: (variables: AssignTablesVariables) =>
      bookingService.assignTablesDirect({
        bookingId: variables.bookingId,
        tableIds: variables.tableIds,
        idempotencyKey: variables.idempotencyKey,
        requireAdjacency: false,
      }),
    onSuccess: (result, variables) => {
      // assign-tables lists only the requested tables; keep the ones already assigned.
      const tableIds = [
        ...new Set([
          ...currentTableIds(queryClient, variables.bookingId),
          ...result.assignments.map((row) => row.table_id),
        ]),
      ];
      applyTables(variables.bookingId, tableIds, result.booking?.status ?? null, 'assign');
      resetSelectedTables();
      onAssignmentComplete?.();
    },
  });

  const unassignMutation = useMutation({
    mutationKey,
    scope,
    mutationFn: (variables: UnassignTablesVariables) =>
      bookingService.unassignTablesDirect({
        bookingId: variables.bookingId,
        tableIds: variables.tableIds,
      }),
    onSuccess: (_result, variables) => {
      const removed = new Set(variables.tableIds);
      const tableIds = currentTableIds(queryClient, variables.bookingId).filter(
        (id) => !removed.has(id),
      );
      applyTables(variables.bookingId, tableIds, null, 'unassign');
      onAssignmentComplete?.();
    },
  });

  const autoAssignMutation = useMutation({
    mutationKey,
    scope,
    mutationFn: async (variables: AutoAssignVariables) => {
      const quoteResult = await bookingService.autoQuoteTables({
        bookingId: variables.bookingId,
        requireAdjacency: false,
      });

      if (
        !quoteResult.candidate ||
        !quoteResult.candidate.tableIds ||
        quoteResult.candidate.tableIds.length === 0
      ) {
        throw smartAssignError(SMART_ASSIGN_NO_CANDIDATE);
      }

      if (!quoteResult.holdId) {
        throw smartAssignError(SMART_ASSIGN_NO_HOLD);
      }

      return bookingService.confirmHoldAssignment({
        bookingId: variables.bookingId,
        holdId: quoteResult.holdId,
        idempotencyKey: variables.idempotencyKey,
        requireAdjacency: false,
      });
    },
    onSuccess: (result, variables) => {
      const tableIds = [
        ...new Set([
          ...currentTableIds(queryClient, variables.bookingId),
          ...result.assignments.map((row) => row.tableId),
        ]),
      ];
      applyTables(variables.bookingId, tableIds, null, 'assign');
      resetSelectedTables();
      onAssignmentComplete?.();
    },
  });

  return {
    assignMutation,
    autoAssignMutation,
    isPending:
      assignMutation.isPending || unassignMutation.isPending || autoAssignMutation.isPending,
    unassignMutation,
  };
}

export type TableAssignmentMutations = ReturnType<typeof useTableAssignmentMutations>;
