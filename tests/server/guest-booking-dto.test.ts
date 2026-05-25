import { describe, expect, it } from 'vitest';

import { toGuestBookingDTO } from '@/server/bookings/guest-booking-dto';

describe('guest booking DTO serialization', () => {
  it('serializes populated guest booking fields without exposing notes', () => {
    expect(
      toGuestBookingDTO(
        {
          id: 'booking-1',
          restaurant_id: 'restaurant-1',
          booking_date: '2026-05-22',
          start_time: '18:30',
          end_time: '20:00',
          start_at: '2026-05-22T17:30:00.000Z',
          end_at: '2026-05-22T19:00:00.000Z',
          reference: 'ABC123',
          party_size: 4,
          booking_type: 'dinner',
          seating_preference: 'window',
          status: 'confirmed',
          customer_name: 'Aman',
          customer_email: 'aman@example.com',
          customer_phone: '07123456789',
          notes: 'Keep hidden',
          created_at: '2026-05-21T12:00:00.000Z',
          updated_at: '2026-05-21T12:30:00.000Z',
        },
        { restaurantName: 'Old Crown' },
      ),
    ).toEqual({
      id: 'booking-1',
      restaurant_id: 'restaurant-1',
      booking_date: '2026-05-22',
      start_time: '18:30',
      end_time: '20:00',
      start_at: '2026-05-22T17:30:00.000Z',
      end_at: '2026-05-22T19:00:00.000Z',
      reference: 'ABC123',
      party_size: 4,
      booking_type: 'dinner',
      seating_preference: 'window',
      status: 'confirmed',
      customer_name: 'Aman',
      customer_email: 'aman@example.com',
      customer_phone: '07123456789',
      notes: null,
      created_at: '2026-05-21T12:00:00.000Z',
      updated_at: '2026-05-21T12:30:00.000Z',
      restaurants: {
        name: 'Old Crown',
        slug: null,
        timezone: null,
      },
    });
  });

  it('preserves existing route defaults for sparse booking records', () => {
    expect(toGuestBookingDTO({ id: 'booking-2' })).toEqual({
      id: 'booking-2',
      restaurant_id: '',
      booking_date: '',
      start_time: '',
      end_time: null,
      start_at: null,
      end_at: null,
      reference: null,
      party_size: 0,
      booking_type: 'dinner',
      seating_preference: null,
      status: 'pending',
      customer_name: '',
      customer_email: '',
      customer_phone: '',
      notes: null,
      created_at: null,
      updated_at: null,
      restaurants: {
        name: null,
        slug: null,
        timezone: null,
      },
    });
  });
});
