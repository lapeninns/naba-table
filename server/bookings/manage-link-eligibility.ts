import { DateTime } from 'luxon';

import { resolveBookingAccessEndSeconds } from '@/server/security/booking-access-token';

import type { BookingRecord } from '@/server/bookings';

/** Statuses a guest can still act on through a manage link. */
const MANAGE_LINK_ELIGIBLE_STATUSES = ['pending', 'pending_allocation', 'confirmed'] as const;

type ManageLinkEligibilityBooking = Pick<
  BookingRecord,
  'status' | 'start_at' | 'end_at' | 'booking_date'
>;

function toSeconds(now: Date): number {
  return Math.floor(DateTime.fromJSDate(now).toMillis() / 1000);
}

/**
 * Whether a lost-link email may be sent for a booking: an active status and
 * the booking has not ended yet (end_at, else start_at + 4h, else end of the
 * booking date). Shared by the lookup request (which bookings to enqueue) and
 * the email processor (whether to still send), so the two windows match.
 */
export function isManageLinkEligibleBooking(
  booking: ManageLinkEligibilityBooking,
  now: Date = new Date(),
): boolean {
  const status = booking.status ?? null;
  if (!status || !(MANAGE_LINK_ELIGIBLE_STATUSES as readonly string[]).includes(status)) {
    return false;
  }

  const endSeconds = resolveBookingAccessEndSeconds(booking);
  return endSeconds !== null && endSeconds > toSeconds(now);
}
