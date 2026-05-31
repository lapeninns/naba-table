import { describe, expect, it } from 'vitest';

import { opsWalkInBookingSchema } from '@/src/app/api/ops/bookings/schema';

const validWalkInPayload = {
  restaurantId: '11111111-1111-4111-8111-111111111111',
  date: '2026-05-23',
  time: '18:30',
  party: 4,
  bookingType: 'dinner',
  seating: 'main',
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  phone: '07123456789',
};

describe('ops walk-in booking schema', () => {
  it('parses explicit false marketing opt-in strings as false', () => {
    expect(
      opsWalkInBookingSchema.parse({
        ...validWalkInPayload,
        marketingOptIn: 'false',
      }),
    ).toMatchObject({
      marketingOptIn: false,
    });

    expect(
      opsWalkInBookingSchema.parse({
        ...validWalkInPayload,
        marketingOptIn: '0',
      }),
    ).toMatchObject({
      marketingOptIn: false,
    });
  });
});
