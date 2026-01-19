'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useBookingService } from '@/contexts/ops-services';
import { useToast } from '@/hooks/use-toast';
import { queryKeys } from '@/lib/query/keys';

import type { HttpError } from '@/lib/http/errors';
import type { OpsBookingListItem, OpsTodayBookingsSummary } from '@/types/ops';

type CancelInput = {
  bookingId: string;
  restaurantId: string;
  targetDate?: string | null;
};

type CancelContext = {
  summaryKey?: ReturnType<(typeof queryKeys)['opsDashboard']['summary']>;
  previousSummary?: OpsTodayBookingsSummary;
  previousDetail?: OpsBookingListItem;
};

export function useOpsCancelBooking() {
  const bookingService = useBookingService();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation<{ id: string; status: string }, HttpError, CancelInput, CancelContext>({
    mutationFn: async ({ bookingId }) => bookingService.cancelBooking({ id: bookingId }),
    onMutate: async ({ bookingId, restaurantId, targetDate }) => {
      const summaryKey = queryKeys.opsDashboard.summary(restaurantId, targetDate ?? null);

      await Promise.all([
        queryClient.cancelQueries({ queryKey: summaryKey }),
        queryClient.cancelQueries({ queryKey: queryKeys.opsBookings.detail(bookingId) }),
      ]);

      const previousSummary = queryClient.getQueryData<OpsTodayBookingsSummary>(summaryKey);
      const previousDetail = queryClient.getQueryData<OpsBookingListItem>(
        queryKeys.opsBookings.detail(bookingId),
      );

      if (previousSummary) {
        queryClient.setQueryData<OpsTodayBookingsSummary>(summaryKey, {
          ...previousSummary,
          bookings: previousSummary.bookings.map((booking) =>
            booking.id === bookingId ? { ...booking, status: 'cancelled' } : booking,
          ),
        });
      }

      if (previousDetail) {
        queryClient.setQueryData<OpsBookingListItem>(queryKeys.opsBookings.detail(bookingId), {
          ...previousDetail,
          status: 'cancelled',
        });
      }

      return { summaryKey, previousSummary, previousDetail };
    },
    onError: (error, variables, context) => {
      if (context?.summaryKey && context.previousSummary) {
        queryClient.setQueryData(context.summaryKey, context.previousSummary);
      }
      if (context?.previousDetail) {
        queryClient.setQueryData(queryKeys.opsBookings.detail(variables.bookingId), context.previousDetail);
      }

      toast({
        title: 'Cancellation failed',
        description: error.message,
        variant: 'destructive',
      });
    },
    onSuccess: () => {
      toast({
        title: 'Booking cancelled',
        description: 'The booking has been marked as cancelled.',
      });
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.opsBookings.detail(variables.bookingId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.opsBookings.list({}),
        exact: false,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.opsDashboard.summary(variables.restaurantId, variables.targetDate ?? null),
      });
      queryClient.invalidateQueries({
        queryKey: ['ops', 'dashboard', variables.restaurantId, 'heatmap'],
        exact: false,
      });
    },
  });
}
