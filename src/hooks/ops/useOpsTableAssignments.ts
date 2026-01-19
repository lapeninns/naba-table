'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';

import { useBookingService } from '@/contexts/ops-services';
import { queryKeys } from '@/lib/query/keys';

import type { OpsBookingStatus, OpsTodayBooking, OpsTodayBookingsSummary } from '@/types/ops';

export type TableAssignmentVariables = {
  bookingId: string;
  tableId: string;
  tableName?: string; // For optimistic UI
};

type TableAssignmentsResponse = {
  tableAssignments: OpsTodayBooking['tableAssignments'];
};

type SummaryKey = ReturnType<(typeof queryKeys)['opsDashboard']['summary']>;

type MutationContext = {
  bookingId: string;
  summaryKey?: SummaryKey;
  previousSummary?: OpsTodayBookingsSummary;
};

function applyAssignOptimistic(params: {
  booking: OpsTodayBooking;
  tableId: string;
  tableName?: string;
}): OpsTodayBooking {
  const { booking, tableId, tableName } = params;

  const newMember: OpsTodayBooking['tableAssignments'][number]['members'][number] = {
    tableId,
    tableNumber: tableName ?? '?',
    capacity: null,
    section: null,
  };

  const existingGroups = Array.isArray(booking.tableAssignments) ? booking.tableAssignments : [];
  const hasMemberAlready = existingGroups.some((group) =>
    group.members.some((m) => m.tableId === tableId),
  );
  if (hasMemberAlready) {
    return booking;
  }

  if (existingGroups.length === 0) {
    return {
      ...booking,
      tableAssignments: [
        {
          groupId: null,
          capacitySum: null,
          members: [newMember],
        },
      ],
      requiresTableAssignment: false,
    };
  }

  const [first, ...rest] = existingGroups;
  const nextFirst = {
    ...first,
    members: [...first.members, newMember],
  };

  return {
    ...booking,
    tableAssignments: [nextFirst, ...rest],
    requiresTableAssignment: false,
  };
}

function applyUnassignOptimistic(params: {
  booking: OpsTodayBooking;
  tableId: string;
}): OpsTodayBooking {
  const { booking, tableId } = params;

  const nextGroups = (booking.tableAssignments ?? [])
    .map((group) => ({
      ...group,
      members: group.members.filter((member) => member.tableId !== tableId),
    }))
    .filter((group) => group.members.length > 0);

  const didRemove = (booking.tableAssignments ?? []).some((group) =>
    group.members.some((member) => member.tableId === tableId),
  );

  if (!didRemove) {
    return booking;
  }

  // Backend business rule: if all tables are unassigned and the booking was 'confirmed', revert to 'pending'.
  const nextStatus =
    nextGroups.length === 0 && booking.status === 'confirmed' ? 'pending' : booking.status;

  return {
    ...booking,
    status: nextStatus,
    tableAssignments: nextGroups,
    requiresTableAssignment:
      nextGroups.length === 0 && nextStatus !== 'cancelled' && nextStatus !== 'no_show',
  };
}

const STATUS_TO_TOTAL_KEY: Partial<
  Record<OpsBookingStatus, keyof OpsTodayBookingsSummary['totals']>
> = {
  pending: 'pending',
  confirmed: 'confirmed',
  completed: 'completed',
  cancelled: 'cancelled',
  no_show: 'noShow',
};

function adjustSummaryTotalsForStatusChange(
  totals: OpsTodayBookingsSummary['totals'],
  previousStatus: OpsBookingStatus,
  nextStatus: OpsBookingStatus,
): OpsTodayBookingsSummary['totals'] {
  if (previousStatus === nextStatus) return totals;

  const previousKey = STATUS_TO_TOTAL_KEY[previousStatus];
  const nextKey = STATUS_TO_TOTAL_KEY[nextStatus];

  if (!previousKey || !nextKey) {
    return totals;
  }

  return {
    ...totals,
    [previousKey]: Math.max(0, totals[previousKey] - 1),
    [nextKey]: totals[nextKey] + 1,
  };
}

export function useOpsTableAssignmentActions(params: {
  restaurantId: string | null;
  date: string | null;
}) {
  const bookingService = useBookingService();
  const queryClient = useQueryClient();
  const { restaurantId, date } = params;

  const summaryKey = restaurantId
    ? queryKeys.opsDashboard.summary(restaurantId, date ?? null)
    : (['ops', 'dashboard', 'summary', 'disabled'] as const);
  const heatmapKeyPrefix = restaurantId
    ? (['ops', 'dashboard', restaurantId, 'heatmap'] as const)
    : null;

  const invalidateCaches = (
    options: {
      invalidateSummary?: boolean;
      refetchSummary?: boolean;
    } = { invalidateSummary: true, refetchSummary: true },
  ) => {
    const { invalidateSummary = true, refetchSummary = true } = options;

    if (invalidateSummary) {
      console.log('[table-assignments] Invalidating summary cache:', {
        summaryKey,
        refetchSummary,
      });
      queryClient.invalidateQueries({
        queryKey: summaryKey,
        // Ensure active queries are refetched to update the UI immediately
        refetchType: refetchSummary ? 'active' : 'none',
      });
    }
    if (heatmapKeyPrefix) {
      queryClient.invalidateQueries({ queryKey: heatmapKeyPrefix, exact: false });
    }
    queryClient.invalidateQueries({ queryKey: ['ops', 'bookings'], exact: false });
  };

  const assignTable = useMutation<
    TableAssignmentsResponse,
    unknown,
    TableAssignmentVariables,
    MutationContext
  >({
    mutationFn: ({ bookingId, tableId }: TableAssignmentVariables) =>
      bookingService.assignTable({ bookingId, tableId }),
    onMutate: async (variables) => {
      if (!restaurantId) {
        return {
          bookingId: variables.bookingId,
        };
      }

      const key = queryKeys.opsDashboard.summary(restaurantId, date ?? null);

      await queryClient.cancelQueries({ queryKey: key });

      const previousSummary = queryClient.getQueryData<OpsTodayBookingsSummary>(key);

      queryClient.setQueryData<OpsTodayBookingsSummary>(key, (current) => {
        if (!current) return current;
        const updated = {
          ...current,
          bookings: current.bookings.map((booking) =>
            booking.id === variables.bookingId
              ? applyAssignOptimistic({
                  booking,
                  tableId: variables.tableId,
                  tableName: variables.tableName,
                })
              : booking,
          ),
        };
        console.log('[table-assign] Optimistic update applied:', {
          bookingId: variables.bookingId,
          tableId: variables.tableId,
          tableName: variables.tableName,
        });
        return updated;
      });

      return { bookingId: variables.bookingId, summaryKey: key, previousSummary };
    },
    onError: (error: unknown, _variables, context) => {
      if (context?.summaryKey && context.previousSummary) {
        queryClient.setQueryData(context.summaryKey, context.previousSummary);
      }
      const message = error instanceof Error ? error.message : 'Unable to assign table';
      toast.error(message);
    },
    onSuccess: (data, variables, context) => {
      if (context?.summaryKey) {
        queryClient.setQueryData<OpsTodayBookingsSummary>(context.summaryKey, (current) => {
          if (!current) return current;
          const updated = {
            ...current,
            bookings: current.bookings.map((booking) => {
              if (booking.id !== variables.bookingId) return booking;
              const nextAssignments = data.tableAssignments ?? [];
              const nextStatus =
                nextAssignments.length === 0 && booking.status === 'confirmed'
                  ? 'pending'
                  : booking.status;
              return {
                ...booking,
                status: nextStatus,
                tableAssignments: nextAssignments,
                requiresTableAssignment:
                  nextAssignments.length === 0 &&
                  nextStatus !== 'cancelled' &&
                  nextStatus !== 'no_show',
              };
            }),
          };
          console.log('[table-assign] Server response applied:', {
            bookingId: variables.bookingId,
            tableAssignments: data.tableAssignments,
          });
          return updated;
        });
      }

      // Cache is already updated with server response above via setQueryData.
      // Invalidate related caches (heatmap, booking details) but NOT the summary
      // since we just updated it - this avoids the race condition from the previous
      // 500ms delay workaround.
      invalidateCaches({ invalidateSummary: false, refetchSummary: false });

      toast.success('Table assigned');
    },
  });

  const unassignTable = useMutation<
    TableAssignmentsResponse,
    unknown,
    TableAssignmentVariables,
    MutationContext
  >({
    mutationFn: ({ bookingId, tableId }: TableAssignmentVariables) =>
      bookingService.unassignTable({ bookingId, tableId }),
    onMutate: async (variables) => {
      if (!restaurantId) {
        return {
          bookingId: variables.bookingId,
        };
      }

      const key = queryKeys.opsDashboard.summary(restaurantId, date ?? null);

      await queryClient.cancelQueries({ queryKey: key });

      const previousSummary = queryClient.getQueryData<OpsTodayBookingsSummary>(key);

      queryClient.setQueryData<OpsTodayBookingsSummary>(key, (current) => {
        if (!current) return current;
        let previousStatus: OpsBookingStatus | null = null;
        let nextStatus: OpsBookingStatus | null = null;
        return {
          ...current,
          bookings: current.bookings.map((booking) =>
            booking.id === variables.bookingId
              ? (() => {
                  const updated = applyUnassignOptimistic({
                    booking,
                    tableId: variables.tableId,
                  });
                  if (updated.status !== booking.status) {
                    previousStatus = booking.status;
                    nextStatus = updated.status;
                  }
                  return updated;
                })()
              : booking,
          ),
          totals:
            previousStatus && nextStatus
              ? adjustSummaryTotalsForStatusChange(current.totals, previousStatus, nextStatus)
              : current.totals,
        };
      });

      return { bookingId: variables.bookingId, summaryKey: key, previousSummary };
    },
    onError: (error: unknown, _variables, context) => {
      if (context?.summaryKey && context.previousSummary) {
        queryClient.setQueryData(context.summaryKey, context.previousSummary);
      }
      const message = error instanceof Error ? error.message : 'Unable to unassign table';
      toast.error(message);
    },
    onSuccess: (data, variables, context) => {
      let summaryUpdated = false;
      if (context?.summaryKey) {
        queryClient.setQueryData<OpsTodayBookingsSummary>(context.summaryKey, (current) => {
          if (!current) return current;
          let previousStatus: OpsBookingStatus | null = null;
          let nextStatus: OpsBookingStatus | null = null;
          return {
            ...current,
            bookings: current.bookings.map((booking) => {
              if (booking.id !== variables.bookingId) return booking;
              summaryUpdated = true;
              const nextAssignments = data.tableAssignments ?? [];
              const updatedStatus =
                nextAssignments.length === 0 && booking.status === 'confirmed'
                  ? 'pending'
                  : booking.status;
              if (updatedStatus !== booking.status) {
                previousStatus = booking.status;
                nextStatus = updatedStatus;
              }
              return {
                ...booking,
                status: updatedStatus,
                tableAssignments: nextAssignments,
                requiresTableAssignment:
                  nextAssignments.length === 0 &&
                  updatedStatus !== 'cancelled' &&
                  updatedStatus !== 'no_show',
              };
            }),
            totals:
              previousStatus && nextStatus
                ? adjustSummaryTotalsForStatusChange(current.totals, previousStatus, nextStatus)
                : current.totals,
          };
        });
      }

      // Cache is already updated with server response above via setQueryData.
      // Invalidate related caches (heatmap, booking details) but NOT the summary.
      invalidateCaches({
        invalidateSummary: !summaryUpdated,
        refetchSummary: !summaryUpdated,
      });
      toast.success('Table unassigned');
    },
  });

  return {
    assignTable,
    unassignTable,
  };
}
