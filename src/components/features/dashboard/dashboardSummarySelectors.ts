'use client';

import { getBookingTabCounts, getEmptyBookingTabCounts } from './bookingFilters';

import type { BookingTabCounts } from './bookingFilters';
import type { OpsTodayBookingsSummary } from '@/types/ops';

export type DashboardGuestStats = {
  upcoming: number;
  seated: number;
};

export type DashboardSummaryMetrics = {
  guestStats: DashboardGuestStats;
  tabCounts: BookingTabCounts;
};

const EMPTY_GUEST_STATS: DashboardGuestStats = {
  upcoming: 0,
  seated: 0,
};

const UPCOMING_GUEST_STATUSES = new Set(['confirmed', 'PRIORITY_WAITLIST']);

export function getDashboardSummaryMetrics(params: {
  summary: OpsTodayBookingsSummary | null;
  allowTableAssignments: boolean;
  hasAssignmentHandlers: boolean;
}): DashboardSummaryMetrics {
  const { summary, allowTableAssignments, hasAssignmentHandlers } = params;

  if (!summary) {
    return {
      guestStats: EMPTY_GUEST_STATS,
      tabCounts: getEmptyBookingTabCounts(),
    };
  }

  let upcoming = 0;
  let seated = 0;

  for (const booking of summary.bookings) {
    if (booking.status === 'checked_in') {
      seated += booking.partySize;
    }

    if (UPCOMING_GUEST_STATUSES.has(booking.status)) {
      upcoming += booking.partySize;
    }
  }

  return {
    guestStats: { upcoming, seated },
    tabCounts: getBookingTabCounts({
      summary,
      allowTableAssignments,
      hasAssignmentHandlers,
    }),
  };
}
