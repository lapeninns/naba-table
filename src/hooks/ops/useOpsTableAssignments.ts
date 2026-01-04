'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';

import { useBookingService } from '@/contexts/ops-services';
import { queryKeys } from '@/lib/query/keys';

import type { OpsTodayBooking, OpsTodayBookingsSummary } from '@/types/ops';

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

  const invalidateCaches = (options: {
    invalidateSummary?: boolean;
    refetchSummary?: boolean;
  } = { invalidateSummary: true, refetchSummary: true }) => {
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

      // Invalidate caches with refetch to ensure UI updates
      console.log('[table-assign] Scheduling cache invalidation with refetch');
      setTimeout(() => {
        invalidateCaches({ invalidateSummary: true, refetchSummary: true });
        console.log('[table-assign] Cache invalidated and refetch triggered');
      }, 500);

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
        return {
          ...current,
          bookings: current.bookings.map((booking) =>
            booking.id === variables.bookingId
              ? applyUnassignOptimistic({ booking, tableId: variables.tableId })
              : booking,
          ),
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
      if (context?.summaryKey) {
        queryClient.setQueryData<OpsTodayBookingsSummary>(context.summaryKey, (current) => {
          if (!current) return current;
          return {
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
        });
      }

      // Ensure cache is invalidated and refetched
      invalidateCaches({ invalidateSummary: true, refetchSummary: true });
      toast.success('Table unassigned');
    },
  });

  return {
    assignTable,
    unassignTable,
  };
}
