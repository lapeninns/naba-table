import { describe, expect, it } from 'vitest';

import { buildBookingCreateSuccessResponse } from '@/server/bookings/create-success-response';

import type { BookingRecord } from '@/server/bookings';

const booking = {
  id: 'booking-1',
  restaurant_id: 'restaurant-1',
  booking_date: '2026-05-23',
  start_time: '18:30',
  end_time: '20:00',
  start_at: '2026-05-23T17:30:00.000Z',
  end_at: '2026-05-23T19:00:00.000Z',
  reference: 'REF123',
  party_size: 4,
  booking_type: 'dinner',
  seating_preference: 'any',
  status: 'pending',
  customer_name: 'Ada Lovelace',
  customer_email: 'ada@example.com',
  customer_phone: '07123456789',
  notes: 'Window table',
  client_request_id: 'request-1',
  created_at: '2026-05-23T11:00:00.000Z',
  updated_at: '2026-05-23T11:01:00.000Z',
} as BookingRecord;

describe('buildBookingCreateSuccessResponse', () => {
  it('builds a created booking response body with route-equivalent fields', () => {
    expect(
      buildBookingCreateSuccessResponse({
        booking,
        loyaltyPointsAwarded: 0,
        duplicate: false,
        useUnifiedValidation: false,
      }),
    ).toEqual({
      body: {
        booking: {
          id: 'booking-1',
          restaurant_id: 'restaurant-1',
          booking_date: '2026-05-23',
          start_time: '18:30',
          end_time: '20:00',
          start_at: '2026-05-23T17:30:00.000Z',
          end_at: '2026-05-23T19:00:00.000Z',
          reference: 'REF123',
          party_size: 4,
          booking_type: 'dinner',
          seating_preference: 'any',
          status: 'pending',
          customer_name: 'Ada Lovelace',
          customer_email: 'ada@example.com',
          customer_phone: '07123456789',
          notes: null,
          created_at: '2026-05-23T11:00:00.000Z',
          updated_at: '2026-05-23T11:01:00.000Z',
          restaurants: {
            name: null,
            slug: null,
            timezone: null,
          },
        },
        loyaltyPointsAwarded: 0,
        clientRequestId: 'request-1',
        duplicate: false,
        capacity: null,
      },
      init: { status: 201 },
    });
  });

  it('returns 200 for duplicate booking responses', () => {
    expect(
      buildBookingCreateSuccessResponse({
        booking,
        loyaltyPointsAwarded: 0,
        duplicate: true,
        useUnifiedValidation: false,
      }).init,
    ).toEqual({ status: 200 });
  });

  it('preserves unified validation headers', () => {
    expect(
      buildBookingCreateSuccessResponse({
        booking,
        loyaltyPointsAwarded: 0,
        duplicate: false,
        useUnifiedValidation: true,
      }).init,
    ).toEqual({
      status: 201,
      headers: {
        'X-Booking-Validation': 'unified',
      },
    });
  });
});
