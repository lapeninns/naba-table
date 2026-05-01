import { describe, expect, it } from 'vitest';

import { buildOpsBookingPayload } from '@features/reservations/wizard/api/useCreateOpsReservation';

describe('buildOpsBookingPayload', () => {
  it('maps a wizard draft to the ops bookings payload', () => {
    const payload = buildOpsBookingPayload({
      restaurantId: '9b95a1f4-f6f7-40f1-a99c-41ecffdf9957',
      restaurantSlug: 'the-fox',
      date: '2026-03-29',
      time: '18:30',
      party: 4,
      bookingType: 'dinner',
      notes: 'Window seat if available',
      name: 'Guest Booker',
      email: 'guest@example.com',
      phone: null,
      marketingOptIn: false,
    });

    expect(payload).toEqual({
      restaurantId: '9b95a1f4-f6f7-40f1-a99c-41ecffdf9957',
      date: '2026-03-29',
      time: '18:30',
      party: 4,
      bookingType: 'dinner',
      seating: 'any',
      notes: 'Window seat if available',
      name: 'Guest Booker',
      email: 'guest@example.com',
      phone: null,
      marketingOptIn: false,
    });
  });
});
