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
const validateSessionRecoveryAccessTokenMock = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({ redirect: redirectMock }));
vi.mock('next/headers', () => ({ cookies: cookiesMock }));

vi.mock('@/lib/env', () => ({
  env: {
    security: {
      sessionRecoveryAccessTokenSecret: 'test-secret',
    },
  },
}));

vi.mock('@/server/security/session-recovery-access-token', () => ({
  validateSessionRecoveryAccessToken: validateSessionRecoveryAccessTokenMock,
}));

vi.mock('@/server/supabase', () => ({
  getServerComponentSupabaseClient: getServerComponentSupabaseClientMock,
}));

import GuestBookingReceiptPage from '@/src/app/guest/bookings/[bookingId]/receipt/page';

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
    validateSessionRecoveryAccessTokenMock.mockReset();
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
    validateSessionRecoveryAccessTokenMock.mockReturnValue({ ok: true });
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

  it('allows a valid sr_access cookie to satisfy the unauthenticated receipt gate', async () => {
    cookieGetMock.mockReturnValue({ name: 'sr_access', value: 'valid-recovery-token' });
    cookieGetAllMock.mockReturnValue([{ name: 'sr_access', value: 'valid-recovery-token' }]);

    await GuestBookingReceiptPage({
      params: Promise.resolve({ bookingId }),
      searchParams: Promise.resolve({}),
    });

    expect(validateSessionRecoveryAccessTokenMock).toHaveBeenCalledWith('valid-recovery-token', {
      secret: 'test-secret',
    });
    expect(fetch).toHaveBeenCalledWith(
      expect.stringMatching(new RegExp(`/api/bookings/${bookingId}$`)),
      expect.objectContaining({
        headers: expect.objectContaining({
          cookie: 'sr_access=valid-recovery-token',
        }),
      }),
    );
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it('redirects invalid recovery cookies to sign-in instead of prefetching', async () => {
    cookieGetMock.mockReturnValue({ name: 'sr_access', value: 'invalid-recovery-token' });
    cookieGetAllMock.mockReturnValue([{ name: 'sr_access', value: 'invalid-recovery-token' }]);
    validateSessionRecoveryAccessTokenMock.mockReturnValue({ ok: false, reason: 'invalid' });

    await expect(
      GuestBookingReceiptPage({
        params: Promise.resolve({ bookingId }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow('NEXT_REDIRECT');

    expect(redirectMock).toHaveBeenCalledWith(
      expect.stringContaining('/auth/signin?redirectedFrom='),
    );
    expect(fetch).not.toHaveBeenCalled();
  });
});
