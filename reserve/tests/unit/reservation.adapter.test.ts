import { describe, expect, it } from 'vitest';

import { reservationAdapter } from '@entities/reservation/adapter';

describe('reservationAdapter', () => {
  it('normalizes API payload into reservation entity', () => {
    const apiPayload = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      restaurant_id: '223e4567-e89b-12d3-a456-426614174001',
      booking_date: '2024-07-01',
      start_time: '18:00',
      end_time: '20:00',
      booking_type: 'dinner',
      seating_preference: 'indoor',
      status: 'confirmed',
      party_size: 2,
      customer_name: 'Jane Doe',
      customer_email: 'jane@example.com',
      customer_phone: '+441234567890',
      marketing_opt_in: true,
      notes: 'Anniversary',
      reference: 'ABC123',
    };

    const reservation = reservationAdapter(apiPayload);

    expect(reservation).toEqual(
      expect.objectContaining({
        id: '123e4567-e89b-12d3-a456-426614174000',
        restaurantId: '223e4567-e89b-12d3-a456-426614174001',
        bookingDate: '2024-07-01',
        startTime: '18:00',
        bookingType: 'dinner',
        customerName: 'Jane Doe',
        marketingOptIn: true,
        notes: 'Anniversary',
        reference: 'ABC123',
      }),
    );
  });
});
