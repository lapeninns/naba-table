'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useBookingService } from '@/contexts/ops-services';
import { emit } from '@/lib/analytics/emit';
import { queryKeys } from '@/lib/query/keys';

import type { HttpError } from '@/lib/http/errors';
import type { OpsBookingListItem } from '@/types/ops';

export type OpsUpdateBookingInput = {
  id: string;
  startIso: string;
  endIso: string;
  partySize: number;
  notes?: string | null;
  restaurantId?: string | null;
};

export function useOpsUpdateBooking() {
  const bookingService = useBookingService();
  const queryClient = useQueryClient();

  return useMutation<OpsBookingListItem, HttpError, OpsUpdateBookingInput>({
    mutationFn: async ({ id, restaurantId: _restaurantId, ...body }) => {
      emit('booking_edit_submitted', { bookingId: id });
      const updated = await bookingService.updateBooking({ id, ...body });
      emit('booking_edit_succeeded', { bookingId: id });
      return updated;
    },
    onSuccess: (updated) => {
      if (updated?.id) {
        queryClient.setQueryData(queryKeys.opsBookings.detail(updated.id), updated);
      }
    },
    onError: (error, variables) => {
      emit('booking_edit_failed', { bookingId: variables.id, code: error?.code });
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) &&
          query.queryKey[0] === 'ops' &&
          query.queryKey[1] === 'bookings',
      });

      if (variables.restaurantId) {
        queryClient.invalidateQueries({
          predicate: (query) =>
            Array.isArray(query.queryKey) &&
            query.queryKey[0] === 'ops' &&
            query.queryKey[1] === 'dashboard' &&
            query.queryKey[2] === variables.restaurantId &&
            query.queryKey[3] === 'summary',
        });
      }
    },
  });
}
