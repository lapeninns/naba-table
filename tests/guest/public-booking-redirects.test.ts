import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const redirect = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error('NEXT_REDIRECT');
  }),
);

vi.mock('next/navigation', () => ({ redirect }));

import LegacyBookingThankYouRedirect from '@src/app/(public)/bookings/[bookingId]/thank-you/page';
import { handleRouting } from '@src/proxy';

describe('public booking redirects', () => {
  beforeEach(() => {
    redirect.mockClear();
    process.env.NEXT_PUBLIC_ROOT_DOMAIN = 'localhost';
    process.env.NEXT_PUBLIC_LOCAL_APP_HOSTS = '';
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

  it('canonicalizes app-host guest routes back to the guest host', async () => {
    const request = new NextRequest('http://app.localhost:3000/guest/bookings?tab=upcoming', {
      headers: { host: 'app.localhost:3000' },
    });

    const response = await handleRouting(request);

    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe(
      'http://localhost:3000/guest/bookings?tab=upcoming',
    );
  });

  it('emits an absolute location header for cross-host guest redirects', async () => {
    const request = new NextRequest('http://app.localhost:3000/guest/profile?tab=settings', {
      headers: { host: 'app.localhost:3000' },
    });

    const response = await handleRouting(request);

    expect(response.headers.get('location')).toBe(
      'http://localhost:3000/guest/profile?tab=settings',
    );
    expect(response.headers.get('refresh')).toBeNull();
  });

  it('canonicalizes root-host app routes onto the app host while preserving query state', async () => {
    const request = new NextRequest(
      'http://localhost:3000/app/dashboard?date=2026-03-25&view=day',
      { headers: { host: 'localhost:3000' } },
    );

    const response = await handleRouting(request);

    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe(
      'http://app.localhost:3000/dashboard?date=2026-03-25&view=day',
    );
  });

  it('canonicalizes /guest to the dashboard experience', async () => {
    const request = new NextRequest('http://localhost:3000/guest', {
      headers: { host: 'localhost:3000' },
    });

    const response = await handleRouting(request);

    expect(response.status).toBe(200);
  });

  it('bounces guest routes from the app host before preserving safe sign-in intent on root-host auth', async () => {
    const request = new NextRequest('http://app.localhost:3000/guest/profile?tab=settings', {
      headers: { host: 'app.localhost:3000' },
    });

    const response = await handleRouting(request);

    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe(
      'http://localhost:3000/guest/profile?tab=settings',
    );

    const rootRequest = new NextRequest('http://localhost:3000/guest/profile?tab=settings', {
      headers: { host: 'localhost:3000' },
    });
    const rootResponse = await handleRouting(rootRequest);

    expect(rootResponse.status).toBe(200);
  });

  it('redirects root-host protected guest routes to sign-in with a safe redirectedFrom after canonicalization', async () => {
    const appHostRequest = new NextRequest('http://app.localhost:3000/guest/bookings?tab=upcoming', {
      headers: { host: 'app.localhost:3000' },
    });
    const appHostResponse = await handleRouting(appHostRequest);

    expect(appHostResponse.status).toBe(308);
    expect(appHostResponse.headers.get('location')).toBe(
      'http://localhost:3000/guest/bookings?tab=upcoming',
    );
  });

  it('protects root-host guest routes with a sign-in redirect that preserves safe redirectedFrom', async () => {
    const getUser = vi.fn().mockResolvedValue({ data: { user: null } });

    vi.doMock('@/server/supabase', () => ({
      getServerComponentSupabaseClient: () =>
        Promise.resolve({
          auth: {
            getUser,
          },
        }),
    }));

    const { default: GuestBookingsPage } = await import('@src/app/guest/bookings/page');

    await expect(
      GuestBookingsPage({
        searchParams: Promise.resolve({ tab: 'upcoming' }),
      }),
    ).rejects.toThrow('NEXT_REDIRECT');

    const [target] = redirect.mock.calls.at(-1) ?? [];
    expect(target).toBe('/auth/signin?redirectedFrom=%2Fguest%2Fbookings');
    expect(getUser).toHaveBeenCalledTimes(1);

    vi.doUnmock('@/server/supabase');
  });
});
