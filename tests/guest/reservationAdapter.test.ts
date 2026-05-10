import { describe, expect, it } from 'vitest';

import { reservationAdapter } from '@entities/reservation/adapter';

describe('reservationAdapter', () => {
  it('uses the restaurant timezone when synthesizing startAt/endAt fallbacks', () => {
    const reservation = reservationAdapter({
      id: '11111111-1111-4111-8111-111111111111',
      restaurant_id: '22222222-2222-4222-8222-222222222222',
      booking_date: '2026-07-01',
      start_time: '19:30',
      end_time: '21:00',
      booking_type: 'dinner',
      status: 'confirmed',
      party_size: 2,
      customer_name: 'Alex Example',
      customer_email: 'alex@example.com',
      customer_phone: '+447700900123',
      restaurants: {
        name: 'White Horse',
        slug: 'white-horse',
        timezone: 'Europe/London',
      },
    });

    expect(reservation.startAt).toBe('2026-07-01T18:30:00.000Z');
    expect(reservation.endAt).toBe('2026-07-01T20:00:00.000Z');
    expect(reservation.restaurantTimezone).toBe('Europe/London');
  });
});
