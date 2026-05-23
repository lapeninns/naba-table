import {
  getBookingDateTimeMillis,
  parseBookingDateTime,
} from '@reserve/shared/formatting/bookingDateTime';

import type { BookingDTO } from '@/guest/services/ports';

export type BookingCardDisplay = {
  monthLabel: string;
  dayLabel: string;
  timeLabel: string;
};

export type BookingListGroups = {
  upcoming: BookingDTO[];
  past: BookingDTO[];
};

export function getBookingStartMillis(booking: BookingDTO): number {
  return getBookingDateTimeMillis(booking.startIso, booking.restaurantTimezone) ?? Number.NaN;
}

export function getBookingCardDisplay(booking: BookingDTO): BookingCardDisplay {
  const parsed = parseBookingDateTime(booking.startIso, booking.restaurantTimezone);
  if (!parsed) {
    return { monthLabel: 'TBC', dayLabel: '--', timeLabel: 'Time pending' };
  }

  return {
    monthLabel: parsed.setLocale('en').toFormat('MMM'),
    dayLabel: parsed.toFormat('d'),
    timeLabel: parsed.toFormat('HH:mm'),
  };
}

export function groupBookingsByTimeline(
  bookings: BookingDTO[],
  now = Date.now(),
): BookingListGroups {
  const upcoming = bookings.filter((booking) => {
    const bookingTime = getBookingStartMillis(booking);
    return Number.isFinite(bookingTime) && bookingTime >= now && booking.status !== 'cancelled';
  });

  const past = bookings.filter((booking) => {
    const bookingTime = getBookingStartMillis(booking);
    return (
      (Number.isFinite(bookingTime) && bookingTime < now) ||
      booking.status === 'cancelled' ||
      booking.status === 'completed'
    );
  });

  return {
    upcoming: upcoming.sort((a, b) => getBookingStartMillis(a) - getBookingStartMillis(b)),
    past: past.sort((a, b) => getBookingStartMillis(b) - getBookingStartMillis(a)),
  };
}

export function buildBookingRestaurantHref(booking: BookingDTO): string {
  return booking.restaurantSlug ? `/restaurants/${booking.restaurantSlug}` : '/restaurants';
}

export function formatBookingPartyLabel(partySize: number): string {
  return `${partySize} ${partySize === 1 ? 'guest' : 'guests'}`;
}

export function formatBookingStatus(status: BookingDTO['status'], isPast = false): string {
  const labels: Partial<Record<BookingDTO['status'], string>> = {
    confirmed: 'Confirmed',
    pending: 'Pending',
    pending_allocation: 'Pending',
    cancelled: 'Cancelled',
    completed: 'Completed',
    checked_in: 'Live',
    no_show: 'No show',
    PRIORITY_WAITLIST: 'Waitlist',
  };

  return labels[status] ?? (isPast ? 'Past' : status);
}

export function isDangerBookingStatus(status: BookingDTO['status']): boolean {
  return status === 'cancelled' || status === 'no_show';
}

export function isActiveBookingStatus(status: BookingDTO['status'], isPast = false): boolean {
  return !isPast && ['confirmed', 'checked_in'].includes(status);
}
