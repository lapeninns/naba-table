import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';


const redirectMock = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error('NEXT_REDIRECT');
  }),
);
const cookiesMock = vi.hoisted(() => vi.fn());
const cookieGetMock = vi.hoisted(() => vi.fn());
const cookieGetAllMock = vi.hoisted(() => vi.fn());
const getServerComponentSupabaseClientMock = vi.hoisted(() => vi.fn());
const getUserMock = vi.hoisted(() => vi.fn());
const serviceRows = vi.hoisted(() => ({ bookings: [] as Array<Record<string, unknown>> }));

vi.mock('next/navigation', () => ({ redirect: redirectMock }));
vi.mock('next/headers', () => ({ cookies: cookiesMock }));

vi.mock('@/lib/env', () => ({
  env: {
    node: { env: 'test' },
    security: {
      sessionRecoveryAccessTokenSecret: 'test-secret',
    },
  },
}));

vi.mock('@/server/observability', () => ({ recordObservabilityEvent: vi.fn() }));

vi.mock('@/server/supabase', () => ({
  getServerComponentSupabaseClient: getServerComponentSupabaseClientMock,
  getRouteHandlerSupabaseClient: vi.fn(),
  getServiceSupabaseClient: () => ({
    from: () => {
      const filters: Array<[string, unknown]> = [];
      const builder = {
        select: () => builder,
        eq: (column: string, value: unknown) => {
          filters.push([column, value]);
          return builder;
        },
        maybeSingle: async () => ({
          data: serviceRows.bookings.find((row) => filters.every(([c, v]) => row[c] === v)) ?? null,
          error: null,
        }),
      };
      return builder;
    },
  }),
}));

import { createBookingAccessToken } from '@/server/security/booking-access-token';
import GuestBookingReceiptPage from '@/src/app/guest/bookings/[bookingId]/receipt/page';

import type { ReactElement } from 'react';

const bookingId = '33333333-3333-4333-8333-333333333333';
const restaurantId = '11111111-1111-4111-8111-111111111111';

const booking = {
  id: bookingId,
  restaurant_id: restaurantId,
  booking_date: '2026-05-20',
  start_time: '18:30',
  end_time: '20:00',
  start_at: '2026-05-20T18:30:00.000Z',
  end_at: '2026-05-20T20:00:00.000Z',
  booking_type: 'dinner',
  seating_preference: 'indoor',
  status: 'confirmed',
  party_size: 2,
  customer_name: 'Receipt Guest',
  customer_email: 'guest@example.com',
  customer_phone: '+441234567890',
  marketing_opt_in: false,
  notes: null,
  reference: 'NB1234',
  restaurants: {
    name: 'The Fox',
    slug: 'the-fox',
    timezone: 'Europe/London',
  },
};

describe('guest receipt recovery flow', () => {
  beforeEach(() => {
    redirectMock.mockClear();
    cookiesMock.mockReset();
    cookieGetMock.mockReset();
    cookieGetAllMock.mockReset();
    getServerComponentSupabaseClientMock.mockReset();
    getUserMock.mockReset();
    serviceRows.bookings = [{ ...booking, auth_user_id: null }];
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ booking }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );

    cookiesMock.mockResolvedValue({
      get: cookieGetMock,
      getAll: cookieGetAllMock,
    });
    cookieGetAllMock.mockReturnValue([]);
    getServerComponentSupabaseClientMock.mockResolvedValue({
      auth: { getUser: getUserMock },
    });
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });
  });

  it('routes modern recovery tokens through /bookings/recover before rendering receipts', async () => {
    await expect(
      GuestBookingReceiptPage({
        params: Promise.resolve({ bookingId }),
        searchParams: Promise.resolve({ accessToken: 'modern-token' }),
      }),
    ).rejects.toThrow('NEXT_REDIRECT');

    const [target] = redirectMock.mock.calls[0] ?? [];
    const url = new URL(target, 'https://www.nabatable.com');
    expect(url.pathname).toBe('/bookings/recover');
    expect(url.searchParams.get('access_token')).toBe('modern-token');
    expect(url.searchParams.get('next')).toBe(`/guest/bookings/${bookingId}/receipt`);
    expect(getServerComponentSupabaseClientMock).not.toHaveBeenCalled();
  });

  it('rejects legacy token parameters without treating them as receipt access', async () => {
    await expect(
      GuestBookingReceiptPage({
        params: Promise.resolve({ bookingId }),
        searchParams: Promise.resolve({ token: 'legacy-token' }),
      }),
    ).rejects.toThrow('NEXT_REDIRECT');

    expect(redirectMock).toHaveBeenCalledWith(
      '/bookings/recover/error?code=LEGACY_TOKEN_DEPRECATED',
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  function bookingCookie(row: Record<string, unknown> = booking) {
    const minted = createBookingAccessToken({
      booking: row as Parameters<typeof createBookingAccessToken>[0]['booking'],
      secret: 'test-secret',
      source: 'redeem',
    });
    if (!minted) throw new Error('expected a token');
    return { name: `__Host-nt_bk.${bookingId}`, value: minted.token };
  }

  function useCookies(cookies: Array<{ name: string; value: string }>) {
    cookieGetMock.mockImplementation((name: string) =>
      cookies.find((cookie) => cookie.name === name),
    );
    cookieGetAllMock.mockReturnValue(cookies);
  }

  it('lets a valid booking cookie satisfy the unauthenticated receipt gate', async () => {
    const cookie = bookingCookie();
    useCookies([cookie]);

    await GuestBookingReceiptPage({
      params: Promise.resolve({ bookingId }),
      searchParams: Promise.resolve({}),
    });

    expect(fetch).toHaveBeenCalledWith(
      expect.stringMatching(new RegExp(`/api/bookings/${bookingId}$`)),
      expect.objectContaining({
        headers: expect.objectContaining({ cookie: `${cookie.name}=${cookie.value}` }),
      }),
    );
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it('ignores the retired sr_access cookie and offers a new link before sign-in (§8.3)', async () => {
    useCookies([{ name: 'sr_access', value: 'sr2.a.b.c' }]);

    const element = await GuestBookingReceiptPage({
      params: Promise.resolve({ bookingId }),
      searchParams: Promise.resolve({}),
    });

    expect(redirectMock).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
    render(element as ReactElement);
    expect(screen.getByRole('link', { name: 'Email me a new link' })).toHaveAttribute(
      'href',
      '/bookings/find',
    );
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      `/auth/signin?redirectedFrom=${encodeURIComponent(`/guest/bookings/${bookingId}/receipt`)}`,
    );
  });

  it('marks a signed-in guest with a revoked cookie as authenticated', async () => {
    const cookie = bookingCookie();
    serviceRows.bookings = [{ ...booking, customer_email: 'changed@example.com' }];
    useCookies([cookie]);
    getUserMock.mockResolvedValue({
      data: { user: { id: 'user-2', email: 'someone@example.com' } },
      error: null,
    });

    const element = await GuestBookingReceiptPage({
      params: Promise.resolve({ bookingId }),
      searchParams: Promise.resolve({}),
    });

    const props = (element as { props: { reason: string; isAuthenticated: boolean } }).props;
    expect(props.reason).toBe('revoked');
    expect(props.isAuthenticated).toBe(true);
    render(element as ReactElement);
    expect(screen.getByRole('link', { name: 'My bookings' })).toHaveAttribute(
      'href',
      '/guest/bookings',
    );
  });

  it('renders the expired-link state for a revoked cookie without prefetching', async () => {
    const cookie = bookingCookie();
    serviceRows.bookings = [{ ...booking, customer_email: 'changed@example.com' }];
    useCookies([cookie]);

    const element = await GuestBookingReceiptPage({
      params: Promise.resolve({ bookingId }),
      searchParams: Promise.resolve({}),
    });

    expect(redirectMock).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
    expect((element as { props: { reason: string } }).props.reason).toBe('revoked');
  });
});
