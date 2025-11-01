'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';

import { useBookingService } from '@/contexts/ops-services';
import { queryKeys } from '@/lib/query/keys';

export type TableAssignmentVariables = {
  bookingId: string;
  tableId: string;
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

  return {
    assignTable,
    unassignTable,
  };
}
