import { describe, expect, it } from 'vitest';

import {
  buildBookingRestaurantHref,
  formatBookingPartyLabel,
  formatBookingStatus,
  getBookingCardDisplay,
  groupBookingsByTimeline,
  isActiveBookingStatus,
  isDangerBookingStatus,
} from '@/components/features/booking/list/bookingListDomain';

import type { BookingDTO } from '@/guest/services/ports';

const buildBooking = (overrides: Partial<BookingDTO> = {}): BookingDTO => ({
  id: 'booking-1',
  restaurantId: 'rest-1',
  restaurantName: 'The Fox',
  restaurantSlug: 'the-fox',
  restaurantTimezone: 'Europe/London',
  partySize: 2,
  startIso: '2026-07-01T18:30:00.000Z',
  endIso: '2026-07-01T20:00:00.000Z',
  status: 'confirmed',
  notes: null,
  ...overrides,
});

describe('bookingListDomain', () => {
  it('formats booking cards in the restaurant timezone', () => {
    expect(getBookingCardDisplay(buildBooking())).toEqual({
      monthLabel: 'Jul',
      dayLabel: '1',
      timeLabel: '19:30',
    });

    expect(getBookingCardDisplay(buildBooking({ startIso: 'not-a-date' }))).toEqual({
      monthLabel: 'TBC',
      dayLabel: '--',
      timeLabel: 'Time pending',
    });
  });

  it('groups upcoming and past bookings with stable sort order', () => {
    const now = Date.parse('2026-07-01T12:00:00.000Z');
    const futureLate = buildBooking({
      id: 'future-late',
      startIso: '2026-07-03T18:30:00.000Z',
    });
    const futureEarly = buildBooking({
      id: 'future-early',
      startIso: '2026-07-02T18:30:00.000Z',
    });
    const past = buildBooking({
      id: 'past',
      startIso: '2026-06-30T18:30:00.000Z',
    });
    const cancelled = buildBooking({
      id: 'cancelled',
      startIso: '2026-07-04T18:30:00.000Z',
      status: 'cancelled',
    });

    const grouped = groupBookingsByTimeline([futureLate, past, cancelled, futureEarly], now);

    expect(grouped.upcoming.map((booking) => booking.id)).toEqual(['future-early', 'future-late']);
    expect(grouped.past.map((booking) => booking.id)).toEqual(['cancelled', 'past']);
  });

  it('resolves href and status presentation decisions', () => {
    expect(buildBookingRestaurantHref(buildBooking())).toBe('/restaurants/the-fox');
    expect(buildBookingRestaurantHref(buildBooking({ restaurantSlug: null }))).toBe('/restaurants');
    expect(formatBookingPartyLabel(1)).toBe('1 guest');
    expect(formatBookingPartyLabel(2)).toBe('2 guests');
    expect(formatBookingStatus('pending_allocation')).toBe('Pending');
    expect(formatBookingStatus('confirmed', true)).toBe('Confirmed');
    expect(isDangerBookingStatus('cancelled')).toBe(true);
    expect(isActiveBookingStatus('checked_in')).toBe(true);
    expect(isActiveBookingStatus('checked_in', true)).toBe(false);
  });
});
