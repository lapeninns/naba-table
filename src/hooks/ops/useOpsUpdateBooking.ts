'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useBookingService } from '@/contexts/ops-services';
import { emit } from '@/lib/analytics/emit';
import { queryKeys } from '@/lib/query/keys';
import { getDateInTimezone } from '@/lib/utils/datetime';

import { readBookingRow, summaryKeysContaining, writeBookingListItem } from './bookingCacheSync';

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
 * Fields the PATCH response does not carry. A time or party-size edit goes through the
 * modification flow, which clears the booking's tables and re-assigns them (inline or in the
 * background), so cached assignments and check-in times must not be treated as current.
 */
const EDIT_RESPONSE_OMITS = ['tableAssignments', 'checkedInAt', 'checkedOutAt'] as const;

/**
 * Edit a booking's time, party size or notes. On success the server row is written into the
 * detail, dialog and list caches (without the fields the response lacks) and removed from
 * status-filtered lists it no longer matches. Then exactly this booking's queries are
 * revalidated (detail, dialog bundle, assignment context, and the list pages that hold it),
 * because its tables may have changed, plus the dashboard summaries for its old and new dates.
 *
 * No realtime echo is recorded: background re-assignment arrives as realtime events after the
 * response, and those must still reach the subscribed views.
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
      const previousStatus = readBookingRow(queryClient, updated.id)?.status ?? null;
      const listKeys = writeBookingListItem(queryClient, updated, {
        omit: EDIT_RESPONSE_OMITS,
        pruneLists: true,
      });
      const bookingKeys = [
        queryKeys.opsBookings.detail(updated.id),
        queryKeys.opsBookings.dialog(updated.id),
        queryKeys.opsBookings.assignmentContext(updated.id),
        ...listKeys,
      ];
      for (const queryKey of bookingKeys) {
        void queryClient.invalidateQueries({ queryKey, exact: true });
      }
      for (const queryKey of summaryKeys) {
        void queryClient.invalidateQueries({ queryKey, exact: true });
      }
      if (updated.status && previousStatus !== updated.status) {
        // Status-filtered lists that did not hold the booking may now match it: reload them the
        // next time they are shown, and refresh the tab counts.
        void queryClient.invalidateQueries({
          queryKey: queryKeys.opsBookings.listPrefix(),
          refetchType: 'none',
        });
        if (restaurantId) {
          void queryClient.invalidateQueries({
            queryKey: queryKeys.opsBookings.statusSummaryPrefix(restaurantId),
          });
        }
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
