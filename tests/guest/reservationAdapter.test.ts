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

  it('prefers venue-local booking date and time when stored instants disagree', () => {
    const reservation = reservationAdapter({
      id: '11111111-1111-4111-8111-111111111111',
      restaurant_id: '22222222-2222-4222-8222-222222222222',
      booking_date: '2026-07-02',
      start_time: '19:30',
      end_time: '21:00',
      start_at: '2026-07-01T18:00:00.000Z',
      end_at: '2026-07-01T19:30:00.000Z',
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

    expect(reservation.startAt).toBe('2026-07-02T18:30:00.000Z');
    expect(reservation.endAt).toBe('2026-07-02T20:00:00.000Z');
  });

  it('normalizes structured Sunday Roast booking details', () => {
    const reservation = reservationAdapter({
      id: '11111111-1111-4111-8111-111111111111',
      restaurant_id: '22222222-2222-4222-8222-222222222222',
      booking_date: '2026-07-05',
      start_time: '12:30',
      end_time: '14:00',
      booking_type: 'lunch',
      status: 'confirmed',
      party_size: 4,
      customer_name: 'Alex Example',
      customer_email: 'alex@example.com',
      customer_phone: '+447700900123',
      details: { occasion: 'Sunday Roast', sunday_roast: true },
    });

    expect(reservation.metadata).toMatchObject({
      occasion: 'Sunday Roast',
      sundayRoast: true,
    });
  });
});
