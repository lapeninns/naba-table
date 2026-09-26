/**
 * GET /bookings/recover (design §8.1 and §12 items 31-35).
 */
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const authGetUserMock = vi.hoisted(() => vi.fn());
const consumeRateLimitMock = vi.hoisted(() => vi.fn());
const updateCalls = vi.hoisted(
  () => [] as Array<{ patch: unknown; filters: Array<[string, string, unknown]> }>,
);
const db = vi.hoisted(() => ({ bookings: [] as Array<Record<string, unknown>> }));

vi.mock('@/lib/env', () => ({
  env: {
    node: { env: 'test' },
    security: { sessionRecoveryAccessTokenSecret: 'test-session-recovery-secret' },
  },
}));

vi.mock('@/server/observability', () => ({ recordObservabilityEvent: vi.fn() }));

vi.mock('@/server/security/rate-limit', () => ({ consumeRateLimit: consumeRateLimitMock }));

vi.mock('@/server/supabase', () => {
  function selectQuery() {
    const filters: Array<[string, unknown]> = [];
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn((column: string, value: unknown) => {
        filters.push([column, value]);
        return builder;
      }),
      maybeSingle: vi.fn(async () => ({
        data: db.bookings.find((row) => filters.every(([c, v]) => row[c] === v)) ?? null,
        error: null,
      })),
    };
    return builder;
  }
  function updateQuery(patch: unknown) {
    const call = { patch, filters: [] as Array<[string, string, unknown]> };
    updateCalls.push(call);
    const builder = {
      eq: vi.fn((column: string, value: unknown) => {
        call.filters.push(['eq', column, value]);
        return builder;
      }),
      is: vi.fn((column: string, value: unknown) => {
        call.filters.push(['is', column, value]);
        return builder;
      }),
      then: (resolve: (value: { error: null }) => unknown) => resolve({ error: null }),
    };
    return builder;
  }
  return {
    getRouteHandlerSupabaseClient: vi.fn(async () => ({ auth: { getUser: authGetUserMock } })),
    getServerComponentSupabaseClient: vi.fn(),
    getServiceSupabaseClient: vi.fn(() => ({
      from: vi.fn(() => ({
        select: vi.fn(() => selectQuery()),
        update: vi.fn((patch: unknown) => updateQuery(patch)),
      })),
    })),
  };
});

import { validateBookingAccessToken } from '@/server/security/booking-access-token';
import { createSessionRecoveryAccessToken } from '@/server/security/session-recovery-access-token';
import { GET } from '@/src/app/(public)/bookings/recover/route';

import {
  accessCookie,
  mintTestAccessToken,
  TEST_ACCESS_SECRET,
} from './helpers/guestBookingAccess';

const R1 = '11111111-1111-4111-8111-111111111111';
const BID = '65c3207e-318a-4e4b-b82d-1249a720d776';
const OTHER = '75c3207e-318a-4e4b-b82d-1249a720d777';
const NOW = new Date('2026-09-26T12:00:00.000Z');

function booking(overrides: Record<string, unknown> = {}) {
  return {
    id: BID,
    restaurant_id: R1,
    customer_email: 'guest@example.com',
    customer_phone: '+447700900123',
    start_at: '2026-10-01T18:00:00.000Z',
    end_at: '2026-10-01T19:30:00.000Z',
    booking_date: '2026-10-01',
    auth_user_id: null,
    ...overrides,
  } as {
    id: string;
    restaurant_id: string;
    customer_email: string;
    customer_phone: string;
    start_at: string;
    end_at: string;
  };
}

function linkToken(row = booking(), now = NOW) {
  return mintTestAccessToken(row, { source: 'link', now });
}

function recover(query: string, cookies: string[] = []) {
  return GET(
    new NextRequest(`https://www.nabatable.com/bookings/recover?${query}`, {
      headers: cookies.length ? { cookie: cookies.join('; ') } : {},
    }),
  );
}

function setCookies(response: Response) {
  return response.headers.getSetCookie();
}

function bookingCookie(response: Response, bookingId = BID) {
  return setCookies(response).find((cookie) => cookie.startsWith(`__Host-nt_bk.${bookingId}=`));
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  db.bookings = [booking()];
  updateCalls.length = 0;
  authGetUserMock.mockReset();
  authGetUserMock.mockResolvedValue({ data: { user: null }, error: null });
  consumeRateLimitMock.mockReset();
  consumeRateLimitMock.mockResolvedValue({
    ok: true,
    limit: 30,
    remaining: 29,
    resetAt: Date.now() + 60_000,
    source: 'memory',
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('GET /bookings/recover', () => {
  it('§31 redeems a link into a fresh 14-day-max cookie and a token-free 303', async () => {
    const link = linkToken();
    const response = await recover(`access_token=${encodeURIComponent(link)}`, [
      'sr_access=legacy',
    ]);

    expect(response.status).toBe(303);
    const location = response.headers.get('location') ?? '';
    expect(location).toBe(`https://www.nabatable.com/bookings/${BID}`);
    expect(location).not.toContain('access_token');
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
    expect(response.headers.get('cache-control')).toBe('no-store');

    const cookie = bookingCookie(response) ?? '';
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/Secure/);
    expect(cookie).toMatch(/SameSite=Lax/);
    expect(cookie).toMatch(/Path=\//);
    expect(cookie).not.toMatch(/Domain=/i);
    const value = decodeURIComponent(cookie.split(';')[0].split('=').slice(1).join('='));
    expect(value).not.toBe(link);
    const validated = validateBookingAccessToken(value, { secret: TEST_ACCESS_SECRET, now: NOW });
    expect(validated.ok && validated.payload.src).toBe('redeem');
    const maxAge = Number(/Max-Age=(\d+)/.exec(cookie)?.[1]);
    expect(maxAge).toBeLessThanOrEqual(14 * 24 * 3600);

    const all = setCookies(response).join('\n');
    expect(all).toMatch(/sr_access=;[^\n]*Max-Age=0/);
    expect(all).toMatch(/sr_confirm=;[^\n]*Path=\/api\/bookings\/confirm/);
  });

  it('§32 honours only this booking as next', async () => {
    const link = encodeURIComponent(linkToken());
    for (const next of ['https://evil.example', '//evil', `/bookings/${OTHER}`, '/%5Cevil']) {
      const response = await recover(`access_token=${link}&next=${encodeURIComponent(next)}`);
      expect(response.headers.get('location')).toBe(`https://www.nabatable.com/bookings/${BID}`);
    }
    const guest = await recover(
      `access_token=${link}&next=${encodeURIComponent(`/guest/bookings/${BID}`)}`,
    );
    expect(guest.headers.get('location')).toBe(`https://www.nabatable.com/guest/bookings/${BID}`);
  });

  it.each([
    [
      'an sr2 link',
      () =>
        createSessionRecoveryAccessToken({
          restaurantId: R1,
          email: 'guest@example.com',
          secret: TEST_ACCESS_SECRET,
          now: NOW,
        }),
      'LEGACY_LINK_EXPIRED',
    ],
    [
      'an expired link',
      () => linkToken(booking(), new Date('2026-06-01T00:00:00.000Z')),
      'ACCESS_TOKEN_EXPIRED',
    ],
    [
      'a revoked link',
      () => {
        const token = linkToken();
        db.bookings = [booking({ customer_email: 'changed@example.com' })];
        return token;
      },
      'ACCESS_TOKEN_REVOKED',
    ],
    ['a garbage link', () => 'bk1.not.a.token', 'INVALID_ACCESS_TOKEN'],
  ])('§33 %s goes to the error page without a cookie', async (_name, token, code) => {
    const response = await recover(`access_token=${encodeURIComponent(token())}`);
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe(
      `https://www.nabatable.com/bookings/recover/error?code=${code}`,
    );
    expect(bookingCookie(response)).toBeUndefined();
  });

  it('§33 legacy ?token= and a missing token are distinguished', async () => {
    const legacy = await recover('token=abc');
    expect(legacy.headers.get('location')).toContain('code=LEGACY_TOKEN_DEPRECATED');
    const missing = await recover('');
    expect(missing.headers.get('location')).toContain('code=MISSING_ACCESS_TOKEN');
  });

  it('rate limits per IP', async () => {
    consumeRateLimitMock.mockResolvedValue({
      ok: false,
      limit: 30,
      remaining: 0,
      resetAt: Date.now() + 60_000,
      source: 'memory',
    });
    const response = await recover(`access_token=${encodeURIComponent(linkToken())}`);
    expect(response.headers.get('location')).toContain('code=RATE_LIMITED');
    expect(consumeRateLimitMock).toHaveBeenCalledWith(
      expect.objectContaining({
        identifier: expect.stringMatching(/^bookings:recover:/),
        limit: 30,
      }),
    );
  });

  describe('§34 claim', () => {
    it('binds an unbound booking to a signed-in user with the same email', async () => {
      authGetUserMock.mockResolvedValue({
        data: { user: { id: 'user-1', email: 'Guest@Example.com' } },
        error: null,
      });
      await recover(`access_token=${encodeURIComponent(linkToken())}`);

      expect(updateCalls).toHaveLength(1);
      expect(updateCalls[0].patch).toEqual({ auth_user_id: 'user-1' });
      expect(updateCalls[0].filters).toEqual(
        expect.arrayContaining([
          ['eq', 'id', BID],
          ['eq', 'restaurant_id', R1],
          ['is', 'auth_user_id', null],
        ]),
      );
    });

    it('does not bind for a different email', async () => {
      authGetUserMock.mockResolvedValue({
        data: { user: { id: 'user-1', email: 'someone@example.com' } },
        error: null,
      });
      await recover(`access_token=${encodeURIComponent(linkToken())}`);
      expect(updateCalls).toHaveLength(0);
    });

    it('does not rebind a booking already bound to another user', async () => {
      db.bookings = [booking({ auth_user_id: 'user-2' })];
      authGetUserMock.mockResolvedValue({
        data: { user: { id: 'user-1', email: 'guest@example.com' } },
        error: null,
      });
      await recover(`access_token=${encodeURIComponent(linkToken())}`);
      expect(updateCalls).toHaveLength(0);
    });
  });

  it('§35 caps booking cookies at 10, clearing undecodable then earliest-expiring ones', async () => {
    const cookies: string[] = ['__Host-nt_bk.a0000000-0000-4000-8000-000000000000=garbage'];
    const ids = Array.from(
      { length: 10 },
      (_, index) => `${String(index).padStart(8, 'b')}-0000-4000-8000-000000000000`,
    );
    ids.forEach((id, index) => {
      const row = booking({
        id,
        end_at: new Date(NOW.getTime() + (index + 1) * 24 * 3600_000).toISOString(),
      });
      cookies.push(accessCookie(id, mintTestAccessToken(row, { source: 'link', now: NOW })));
    });

    const response = await recover(`access_token=${encodeURIComponent(linkToken())}`, cookies);
    const all = setCookies(response);

    expect(
      all.some((cookie) =>
        cookie.startsWith('__Host-nt_bk.a0000000-0000-4000-8000-000000000000=;'),
      ),
    ).toBe(true);
    // ids[0] expires first and is evicted to make room; ids[1] stays.
    expect(all.some((cookie) => cookie.startsWith(`__Host-nt_bk.${ids[0]}=;`))).toBe(true);
    expect(all.some((cookie) => cookie.startsWith(`__Host-nt_bk.${ids[1]}=`))).toBe(false);
    expect(bookingCookie(response)).toBeDefined();
  });
});
