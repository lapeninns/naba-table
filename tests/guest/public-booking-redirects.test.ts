import { beforeEach, describe, expect, it, vi } from 'vitest';

const redirect = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error('NEXT_REDIRECT');
  }),
);

vi.mock('next/navigation', () => ({ redirect }));

import LegacyBookingThankYouRedirect from '@src/app/(public)/bookings/[bookingId]/thank-you/page';

describe('public booking redirects', () => {
  beforeEach(() => {
    redirect.mockClear();
  });

  it('redirects legacy thank-you links to guest receipts', async () => {
    await expect(
      LegacyBookingThankYouRedirect({
        params: Promise.resolve({ bookingId: 'booking-1' }),
        searchParams: Promise.resolve({ token: 'abc', source: 'email' }),
      }),
    ).rejects.toThrow('NEXT_REDIRECT');

    const [target] = redirect.mock.calls[0] ?? [];
    const url = new URL(target, 'https://example.com');
    expect(url.pathname).toBe('/guest/bookings/booking-1/receipt');
    expect(url.searchParams.get('token')).toBe('abc');
    expect(url.searchParams.get('source')).toBe('email');
  });
});
