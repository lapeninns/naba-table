'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';

import { useBookingService } from '@/contexts/ops-services';
import { queryKeys } from '@/lib/query/keys';
import type { OpsBookingStatus } from '@/types/ops';

export type UpdateBookingStatusVariables = {
  restaurantId: string;
  bookingId: string;
  status: 'completed' | 'no_show';
  targetDate?: string | null;
};

export function useOpsBookingStatusActions() {
  const bookingService = useBookingService();
  const queryClient = useQueryClient();

  return useMutation<{ status: OpsBookingStatus }, Error, UpdateBookingStatusVariables>({
    mutationFn: ({ bookingId, status }) => bookingService.updateBookingStatus({ id: bookingId, status }),
    onSuccess: (_updated, variables) => {
      const summaryKey = queryKeys.opsDashboard.summary(variables.restaurantId, variables.targetDate ?? null);

      queryClient.invalidateQueries({ queryKey: summaryKey });
      queryClient.invalidateQueries({ queryKey: ['ops', 'dashboard', variables.restaurantId, 'heatmap'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['ops', 'bookings'], exact: false });

      toast.success('Booking status updated');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update booking');
    },
  });
}
