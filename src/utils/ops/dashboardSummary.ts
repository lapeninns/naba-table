import type { OpsBookingListItem, OpsBookingStatus, OpsTodayBooking, OpsTodayBookingsSummary } from '@/types/ops';

const NON_COVER_STATUSES = new Set<OpsBookingStatus>(['cancelled', 'no_show']);

export function computeDashboardTotals(bookings: OpsTodayBooking[]) {
  return bookings.reduce(
    (acc, booking) => {
      acc.total += 1;

      switch (booking.status) {
        case 'pending':
        case 'pending_allocation':
          acc.pending += 1;
          acc.upcoming += 1;
          break;
        case 'confirmed':
          acc.confirmed += 1;
          acc.upcoming += 1;
          break;
        case 'checked_in':
          acc.confirmed += 1;
          acc.completed += 1;
          break;
        case 'completed':
          acc.confirmed += 1;
          acc.completed += 1;
          break;
        case 'cancelled':
          acc.cancelled += 1;
          break;
        case 'no_show':
          acc.noShow += 1;
          break;
        default:
          break;
      }

      if (!NON_COVER_STATUSES.has(booking.status)) {
        acc.covers += booking.partySize;
      }

      return acc;
    },
    {
      total: 0,
      confirmed: 0,
      completed: 0,
      pending: 0,
      cancelled: 0,
      noShow: 0,
      upcoming: 0,
      covers: 0,
    },
  );
}

export function patchDashboardSummaryBooking(
  summary: OpsTodayBookingsSummary,
  bookingId: string,
  patch: (booking: OpsTodayBooking) => OpsTodayBooking,
): OpsTodayBookingsSummary {
  let didChange = false;
  const bookings = summary.bookings.map((booking) => {
    if (booking.id !== bookingId) {
      return booking;
    }
    didChange = true;
    return patch(booking);
  });

  if (!didChange) {
    return summary;
  }

  return {
    ...summary,
    bookings,
    totals: computeDashboardTotals(bookings),
  };
}

export function patchOpsBookingListItem(
  booking: OpsBookingListItem,
  patch: (booking: OpsBookingListItem) => OpsBookingListItem,
): OpsBookingListItem {
  return patch(booking);
}
