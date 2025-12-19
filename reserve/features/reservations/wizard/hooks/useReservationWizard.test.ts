import { describe, expect, it } from 'vitest';

import { buildSafeReturnPath } from './useReservationWizard';

describe('buildSafeReturnPath', () => {
  it('returns explicit returnPath when provided', () => {
    expect(
      buildSafeReturnPath({
        returnPath: '/custom/thank-you',
        bookingId: '123',
        bookingReference: 'tok',
      }),
    ).toBe('/custom/thank-you');
  });

  it('includes confirmation token for confirmed bookings', () => {
    expect(
      buildSafeReturnPath({
        bookingId: 'abc123',
        bookingReference: 'token-xyz',
      }),
    ).toBe('/bookings/abc123/thank-you?token=token-xyz');
  });

  it('falls back to public thank-you when booking lacks token', () => {
    expect(
      buildSafeReturnPath({
        bookingId: 'abc123',
      }),
    ).toBe('/guest/thank-you');
  });

  it('returns restaurant page when no booking is present', () => {
    expect(
      buildSafeReturnPath({
        restaurantSlug: 'bistro-north',
      }),
    ).toBe('/restaurants/bistro-north');
  });

  it('falls back to home when nothing is available', () => {
    expect(buildSafeReturnPath({})).toBe('/');
  });
});
