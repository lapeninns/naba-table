'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useBookingService } from '@/contexts/ops-services';
import { queryKeys } from '@/lib/query/keys';
import { patchDashboardSummaryBooking } from '@/utils/ops/dashboardSummary';

import type { HttpError } from '@/lib/http/errors';
import type { OpsBookingListItem, OpsBookingsPage, OpsTodayBookingsSummary } from '@/types/ops';

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

const opsBookingsListKey = ['ops', 'bookings', 'list'] as const;

const hasBookingItems = (
  value: OpsBookingsPage | undefined,
): value is OpsBookingsPage & { items: OpsBookingListItem[] } => {
  return Array.isArray(value?.items);
};

export function useOpsCancelBooking() {
  const bookingService = useBookingService();
  const queryClient = useQueryClient();

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
        queryClient.setQueryData<OpsTodayBookingsSummary>(
          summaryKey,
          patchDashboardSummaryBooking(previousSummary, bookingId, (booking) => ({
            ...booking,
            status: 'cancelled',
          })),
        );
      }

      if (previousDetail) {
        queryClient.setQueryData<OpsBookingListItem>(queryKeys.opsBookings.detail(bookingId), {
          ...previousDetail,
          status: 'cancelled',
        });
      }

      queryClient.setQueriesData<OpsBookingsPage>(
        { queryKey: opsBookingsListKey, exact: false },
        (current) => {
          if (!hasBookingItems(current)) return current;
          let didChange = false;
          const items = current.items.map((item) => {
            if (item.id !== bookingId) return item;
            didChange = true;
            return { ...item, status: 'cancelled' as const };
          });
          return didChange ? { ...current, items } : current;
        },
      );

      return { summaryKey, previousSummary, previousDetail };
    },
    onError: (error, variables, context) => {
      if (context?.summaryKey && context.previousSummary) {
        queryClient.setQueryData(context.summaryKey, context.previousSummary);
      }
      if (context?.previousDetail) {
        queryClient.setQueryData(queryKeys.opsBookings.detail(variables.bookingId), context.previousDetail);
      }

    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['ops', 'dashboard', variables.restaurantId, 'heatmap'],
        exact: false,
      });
    },
  });
}
