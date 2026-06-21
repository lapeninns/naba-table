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

  describe('returnPath validation', () => {
    it('honors an allowlisted local returnPath verbatim', () => {
      expect(
        buildSafeReturnPath({
          returnPath: '/restaurants/acme/book/thank-you',
          restaurantSlug: 'acme',
        }),
      ).toBe('/restaurants/acme/book/thank-you');

      expect(buildSafeReturnPath({ returnPath: '/app/bookings' })).toBe('/app/bookings');
    });

    it('rejects a protocol-relative returnPath and uses the derived default', () => {
      expect(
        buildSafeReturnPath({
          returnPath: '//evil.example',
          bookingId: 'booking-1',
        }),
      ).toBe('/guest/bookings/booking-1');
    });

    it('rejects an absolute http(s) returnPath and uses the derived default', () => {
      expect(
        buildSafeReturnPath({
          returnPath: 'https://evil.example',
          restaurantSlug: 'acme',
        }),
      ).toBe('/restaurants/acme');
    });

    it('rejects a backslash-smuggled returnPath and falls back to home', () => {
      expect(buildSafeReturnPath({ returnPath: '/\\evil' })).toBe('/');
      expect(buildSafeReturnPath({ returnPath: '/%5Cevil.example' })).toBe('/');
    });

    it('rejects a same-origin path outside the booking-flow allowlist', () => {
      expect(
        buildSafeReturnPath({
          returnPath: '/secret-admin',
          bookingId: 'booking-1',
        }),
      ).toBe('/guest/bookings/booking-1');
    });
  });
});
