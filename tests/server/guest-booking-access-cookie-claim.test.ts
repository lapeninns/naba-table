/**
 * Review follow-ups for the guest booking access helpers:
 * - the insecure development cookie is only written for genuinely local http
 *   hosts, never on a client-set `X-Forwarded-Proto` alone;
 * - a claim reports `claimed` only when the conditional update changed a row.
 */
import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const serviceClientMock = vi.hoisted(() => vi.fn());
const loggerWarnMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/env', () => ({
  env: {
    node: { env: 'test' },
    security: { sessionRecoveryAccessTokenSecret: 'test-session-recovery-secret' },
  },
}));
vi.mock('@/lib/logger', () => ({
  logger: { warn: loggerWarnMock, info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/server/supabase', () => ({
  getRouteHandlerSupabaseClient: vi.fn(),
  getServerComponentSupabaseClient: vi.fn(),
  getServiceSupabaseClient: serviceClientMock,
}));
vi.mock('@/server/observability', () => ({ recordObservabilityEvent: vi.fn() }));

import {
  claimBookingForUser,
  setBookingAccessCookie,
} from '@/server/bookings/guest-booking-access';

const BOOKING_ID = 'b0000000-0000-4000-8000-000000000001';
const SECRET = 'test-session-recovery-secret';

function writeCookie(url: string, headers: Record<string, string> = {}): string {
  const req = new NextRequest(url, { headers });
  const res = NextResponse.json({});
  setBookingAccessCookie(
    req,
    res,
    { bookingId: BOOKING_ID, token: 'tok', expiresAt: new Date(Date.now() + 3_600_000) },
    { secret: SECRET },
  );
  const cookie = res.headers.getSetCookie().find((c) => c.includes(`nt_bk.${BOOKING_ID}=tok`));
  if (!cookie) throw new Error('booking cookie not written');
  return cookie;
}

describe('setBookingAccessCookie host policy', () => {
  it.each([
    ['https://staging.nabatable.com/bookings/recover', { 'x-forwarded-proto': 'http' }],
    ['https://www.nabatable.com/bookings/recover', { 'x-forwarded-proto': 'http, https' }],
    ['http://staging.nabatable.com/bookings/recover', {}],
    ['http://localhost.evil.example/bookings/recover', {}],
    ['https://localhost:3000/bookings/recover', {}],
    ['http://localhost:3000/bookings/recover', { 'x-forwarded-proto': 'https' }],
  ])('keeps __Host- and Secure for %s %o @security', (url, headers) => {
    const cookie = writeCookie(url, headers);
    expect(cookie.startsWith(`__Host-nt_bk.${BOOKING_ID}=`)).toBe(true);
    expect(cookie).toContain('Secure');
  });

  it.each([
    'http://localhost:3000/bookings/recover',
    'http://app.localhost:3000/bookings/recover',
    'http://127.0.0.1:3000/bookings/recover',
    'http://[::1]:3000/bookings/recover',
  ])('uses the development cookie for local plain-http %s @security', (url) => {
    const cookie = writeCookie(url);
    expect(cookie.startsWith(`nt_bk.${BOOKING_ID}=`)).toBe(true);
    expect(cookie).not.toContain('Secure');
  });
});

describe('claimBookingForUser', () => {
  const booking = {
    id: BOOKING_ID,
    restaurant_id: 'r0000000-0000-4000-8000-000000000001',
    auth_user_id: null,
    customer_email: 'guest@example.com',
  };
  const user = {
    id: 'u0000000-0000-4000-8000-000000000001',
    email: 'guest@example.com',
    email_confirmed_at: '2026-01-01T00:00:00Z',
  };

  function mockUpdateResult(result: { data: unknown; error: unknown }) {
    const select = vi.fn(async () => result);
    const chain = {
      update: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      is: vi.fn(() => ({ select })),
    };
    serviceClientMock.mockReturnValue({ from: vi.fn(() => chain) });
    return { chain, select };
  }

  beforeEach(() => {
    serviceClientMock.mockReset();
    loggerWarnMock.mockReset();
  });

  it('reports claimed when the conditional update bound the booking', async () => {
    const { select } = mockUpdateResult({ data: [{ id: BOOKING_ID }], error: null });
    await expect(claimBookingForUser({ booking, user })).resolves.toBe('claimed');
    expect(select).toHaveBeenCalledWith('id');
  });

  it('reports already_claimed when a concurrent claim won the race (0 rows) @security', async () => {
    mockUpdateResult({ data: [], error: null });
    await expect(claimBookingForUser({ booking, user })).resolves.toBe('already_claimed');
    expect(loggerWarnMock).not.toHaveBeenCalled();
  });

  it('reports failed on a database error', async () => {
    mockUpdateResult({ data: null, error: { message: 'boom' } });
    await expect(claimBookingForUser({ booking, user })).resolves.toBe('failed');
  });
});
