import { describe, expect, it } from 'vitest';

import { buildSafeReturnPath } from '@reserve/features/reservations/wizard/hooks/useReservationWizard';

describe('booking return paths', () => {
  it('links confirmed bookings without deprecated receipt token params', () => {
    const path = buildSafeReturnPath({
      bookingId: 'booking-1',
      bookingReference: 'ref-123',
    });

    expect(path).toBe('/guest/bookings/booking-1');
  });

  it('falls back to the guest booking detail when no receipt token is available', () => {
    const path = buildSafeReturnPath({
      bookingId: 'booking-1',
      bookingReference: null,
    });

    expect(path).toBe('/guest/bookings/booking-1');
  });
});
