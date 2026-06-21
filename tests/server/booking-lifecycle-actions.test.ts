import { describe, expect, it } from 'vitest';

import {
  prepareCheckInTransition,
  prepareCheckOutTransition,
} from '@/server/ops/booking-lifecycle/actions';

const baseBooking = {
  id: 'booking-1',
  restaurant_id: 'restaurant-1',
  booking_date: '2026-05-31',
  start_time: '19:00',
};

describe('booking lifecycle action idempotency', () => {
  it('does not overwrite an existing check-in timestamp on a repeated check-in', () => {
    const transition = prepareCheckInTransition({
      booking: {
        ...baseBooking,
        status: 'checked_in',
        checked_in_at: '2026-05-31T18:00:00.000Z',
        checked_out_at: null,
      },
      actorId: 'user-1',
      performedAt: '2026-05-31T18:10:00.000Z',
      now: new Date('2026-05-31T18:15:00.000Z'),
    });

    expect(transition.skipUpdate).toBe(true);
    expect(transition.response.checkedInAt).toBe('2026-05-31T18:00:00.000Z');
  });

  it('does not overwrite an existing check-out timestamp on a repeated check-out', () => {
    const transition = prepareCheckOutTransition({
      booking: {
        ...baseBooking,
        status: 'completed',
        checked_in_at: '2026-05-31T18:00:00.000Z',
        checked_out_at: '2026-05-31T20:00:00.000Z',
      },
      actorId: 'user-1',
      performedAt: '2026-05-31T20:10:00.000Z',
      now: new Date('2026-05-31T20:15:00.000Z'),
    });

    expect(transition.skipUpdate).toBe(true);
    expect(transition.response.checkedOutAt).toBe('2026-05-31T20:00:00.000Z');
  });
});
