'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';

import { useBookingService } from '@/contexts/ops-services';
import { queryKeys } from '@/lib/query/keys';

export type TableAssignmentVariables = {
  bookingId: string;
  tableId: string;
};

export type AutoAssignTablesVariables = {
  restaurantId: string;
  date?: string | null;
};

export function useOpsTableAssignmentActions(params: { restaurantId: string | null; date: string | null }) {
  const bookingService = useBookingService();
  const queryClient = useQueryClient();
  const { restaurantId, date } = params;

  const summaryKey = restaurantId
    ? queryKeys.opsDashboard.summary(restaurantId, date ?? null)
    : (['ops', 'dashboard', 'summary', 'disabled'] as const);
  const heatmapKeyPrefix = restaurantId ? (['ops', 'dashboard', restaurantId, 'heatmap'] as const) : null;

  const invalidateCaches = () => {
    queryClient.invalidateQueries({ queryKey: summaryKey });
    if (heatmapKeyPrefix) {
      queryClient.invalidateQueries({ queryKey: heatmapKeyPrefix, exact: false });
    }
    queryClient.invalidateQueries({ queryKey: ['ops', 'bookings'], exact: false });
  };

  const assignTable = useMutation({
    mutationFn: ({ bookingId, tableId }: TableAssignmentVariables) =>
      bookingService.assignTable({ bookingId, tableId }),
    onSuccess: () => {
      invalidateCaches();
      toast.success('Table assigned');
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Unable to assign table';
      toast.error(message);
    },
  });

  const unassignTable = useMutation({
    mutationFn: ({ bookingId, tableId }: TableAssignmentVariables) =>
      bookingService.unassignTable({ bookingId, tableId }),
    onSuccess: () => {
      invalidateCaches();
      toast.success('Table unassigned');
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Unable to unassign table';
      toast.error(message);
    },
  });

  const autoAssignTables = useMutation({
    mutationFn: ({ restaurantId: inputRestaurantId, date: targetDate }: AutoAssignTablesVariables) =>
      bookingService.autoAssignTables({ restaurantId: inputRestaurantId, date: targetDate ?? date }),
    onSuccess: (result) => {
      invalidateCaches();
      const assignedCount = result.assigned.length;
      const skippedCount = result.skipped.length;
      const summaryParts = [];
      if (assignedCount > 0) {
        summaryParts.push(`${assignedCount} booking${assignedCount === 1 ? '' : 's'} assigned`);
      }
      if (skippedCount > 0) {
        summaryParts.push(`${skippedCount} skipped`);
      }
      const summary = summaryParts.length > 0 ? summaryParts.join(', ') : 'No pending bookings';
      toast.success(`Auto assignment complete: ${summary}`);
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Auto-assignment failed';
      toast.error(message);
    },
  });

  return {
    assignTable,
    unassignTable,
    autoAssignTables,
  };
}
