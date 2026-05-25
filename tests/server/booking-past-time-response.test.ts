import { describe, expect, it } from 'vitest';

import { buildPastTimeBlockedResponse } from '@/server/bookings/past-time-response';
import { PastBookingError } from '@/server/bookings/pastTimeValidation';

const details = {
  bookingTime: '2026-05-23T10:00:00 BST',
  serverTime: '2026-05-23T11:00:00 BST',
  timezone: 'Europe/London',
  gracePeriodMinutes: 5,
  timeDeltaMinutes: -60,
};

describe('buildPastTimeBlockedResponse', () => {
  it('builds the route-equivalent past-time blocked response', () => {
    expect(
      buildPastTimeBlockedResponse(new PastBookingError('Booking time is in the past.', details)),
    ).toEqual({
      body: {
        error: 'Booking time is in the past.',
        code: 'BOOKING_IN_PAST',
        details,
      },
      init: { status: 422 },
    });
  });

  it('passes error details through by reference', () => {
    const response = buildPastTimeBlockedResponse(new PastBookingError('Blocked.', details));

    expect(response.body.details).toBe(details);
  });
});
