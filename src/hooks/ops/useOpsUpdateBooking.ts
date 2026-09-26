'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useBookingService } from '@/contexts/ops-services';
import { emit } from '@/lib/analytics/emit';
import { queryKeys } from '@/lib/query/keys';
import { getDateInTimezone } from '@/lib/utils/datetime';

import { summaryKeysContaining, writeBookingListItem } from './bookingCacheSync';
import { recordBookingWrite } from './bookingWriteEcho';

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

function localDate(iso: string | null | undefined, timezone: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return getDateInTimezone(date, timezone || 'UTC');
}

/**
 * Edit a booking's time, party size or notes. On success the canonical row from the server is
 * written into the detail, dialog and list caches, and only the dashboard summaries for the
 * booking's old and new dates are invalidated (a summary row cannot be rebuilt client-side).
 */
export function useOpsUpdateBooking() {
  const bookingService = useBookingService();
  const queryClient = useQueryClient();

  return useMutation<OpsBookingListItem, HttpError, OpsUpdateBookingInput>({
    mutationKey: queryKeys.opsBookings.updateMutation(),
    mutationFn: async ({ id, restaurantId: _restaurantId, ...body }) => {
      emit('booking_edit_submitted', { bookingId: id });
      const updated = await bookingService.updateBooking({ id, ...body });
      emit('booking_edit_succeeded', { bookingId: id });
      return updated;
    },
    onSuccess: (updated, variables) => {
      if (!updated?.id) return;
      const restaurantId = variables.restaurantId ?? updated.restaurantId ?? null;
      const timezone = updated.restaurantTimezone ?? null;
      // Old date: whichever summaries show the booking now. New date: from the server row.
      const summaryKeys = summaryKeysContaining(queryClient, restaurantId, updated.id, [
        localDate(updated.startIso, timezone),
        localDate(variables.startIso, timezone),
      ]);
      writeBookingListItem(queryClient, updated);
      recordBookingWrite(queryClient, updated.id, { status: updated.status });
      for (const queryKey of summaryKeys) {
        void queryClient.invalidateQueries({ queryKey, exact: true });
      }
      if (restaurantId) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.opsDashboard.heatmapPrefix(restaurantId),
        });
      }
    },
    onError: (error, variables) => {
      emit('booking_edit_failed', { bookingId: variables.id, code: error?.code });
    },
  });
}
