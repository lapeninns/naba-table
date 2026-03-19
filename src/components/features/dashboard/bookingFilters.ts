import { DateTime } from 'luxon';

import {
  getOpsBookingActionRequirements,
  getOpsBookingTemporalInfo,
} from '../../../utils/ops/todayBookingsAttention';

import type { OpsTodayBooking, OpsTodayBookingsSummary } from '@/types/ops';

export const BOOKING_FILTER_OPTIONS = [
  { value: 'all', label: 'All', description: 'All bookings' },
  { value: 'upcoming', label: 'Upcoming', description: 'Expected or pending arrivals' },
  { value: 'seated', label: 'Seated', description: 'Currently seated guests' },
  { value: 'attention', label: 'Attention', description: 'Bookings that need an action now' },
  { value: 'finished', label: 'Finished', description: 'Completed, cancelled, or no-show bookings' },
  { value: 'no_show', label: 'No shows', description: 'Marked as no show' },
] as const;

export type BookingFilter = (typeof BOOKING_FILTER_OPTIONS)[number]['value'];
export type BookingTabCounts = Record<BookingFilter, number>;

const UPCOMING_STATUSES = new Set<OpsTodayBooking['status']>([
  'confirmed',
  'PRIORITY_WAITLIST',
  'pending',
  'pending_allocation',
]);

const FINISHED_STATUSES = new Set<OpsTodayBooking['status']>([
  'completed',
  'cancelled',
  'no_show',
]);

export function normalizeBookingFilter(value: string | null | undefined): BookingFilter | null {
  if (!value) {
    return null;
  }

  if (value === 'completed') {
    return 'finished';
  }

  return (BOOKING_FILTER_OPTIONS as readonly { value: string }[]).some(
    (filter) => filter.value === value,
  )
    ? (value as BookingFilter)
    : null;
}

export function getEmptyBookingTabCounts(): BookingTabCounts {
  return {
    all: 0,
    upcoming: 0,
    seated: 0,
    attention: 0,
    finished: 0,
    no_show: 0,
  };
}

export function getBookingFilterLabel(filter: BookingFilter): string {
  return BOOKING_FILTER_OPTIONS.find((entry) => entry.value === filter)?.label ?? 'All';
}

export function matchesBookingFilter(params: {
  booking: OpsTodayBooking;
  filter: BookingFilter;
  summary: OpsTodayBookingsSummary;
  now: DateTime;
  allowTableAssignments: boolean;
  hasAssignmentHandlers: boolean;
}): boolean {
  const { booking, filter, summary, now, allowTableAssignments, hasAssignmentHandlers } = params;

  if (filter === 'all') {
    return true;
  }

  if (filter === 'upcoming') {
    return UPCOMING_STATUSES.has(booking.status);
  }

  if (filter === 'seated') {
    return booking.status === 'checked_in';
  }

  if (filter === 'finished') {
    return FINISHED_STATUSES.has(booking.status);
  }

  if (filter === 'no_show') {
    return booking.status === 'no_show';
  }

  const temporalInfo = getOpsBookingTemporalInfo(booking, summary, now);
  const requirements = getOpsBookingActionRequirements({
    booking,
    temporalInfo,
    now,
    statusForActions: booking.status,
    allowTableAssignments,
    hasAssignmentHandlers,
  });

  return requirements.needsAttention;
}

export function getBookingTabCounts(params: {
  summary: OpsTodayBookingsSummary;
  allowTableAssignments: boolean;
  hasAssignmentHandlers: boolean;
  now?: DateTime;
}): BookingTabCounts {
  const { summary, allowTableAssignments, hasAssignmentHandlers, now } = params;
  const counts = getEmptyBookingTabCounts();
  const resolvedNow = now ?? DateTime.now().setZone(summary.timezone);

  for (const booking of summary.bookings) {
    counts.all += 1;

    for (const filter of BOOKING_FILTER_OPTIONS) {
      if (filter.value === 'all') {
        continue;
      }

      if (
        matchesBookingFilter({
          booking,
          filter: filter.value,
          summary,
          now: resolvedNow,
          allowTableAssignments,
          hasAssignmentHandlers,
        })
      ) {
        counts[filter.value] += 1;
      }
    }
  }

  return counts;
}
