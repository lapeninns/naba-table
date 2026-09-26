import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

import {
  BOOKING_NOT_COMPLETED_CODE,
  BOOKING_NOT_COMPLETED_MESSAGE,
  buildBookingCreateHttpResponse,
  type BookingCreateContactThrottle,
  type BookingCreateManageLinkEnqueuer,
} from '@/server/bookings/create-response';
import { lookupContactKey } from '@/server/bookings/lookup-contact-key';
import { validateBookingAccessToken } from '@/server/security/booking-access-token';

import type { BookingRecord } from '@/server/bookings';

const SECRET = 'test-session-recovery-secret';
const NOW = new Date('2026-05-23T11:05:00.000Z');
const RESTAURANT_ID = '550e8400-e29b-41d4-a716-446655440000';
const BOOKING_ID = '65c3207e-318a-4e4b-b82d-1249a720d776';

const booking = {
  id: BOOKING_ID,
  restaurant_id: RESTAURANT_ID,
  booking_date: '2026-05-23',
  start_time: '18:30',
  end_time: '20:00',
  start_at: '2026-05-23T17:30:00.000Z',
  end_at: '2026-05-23T19:00:00.000Z',
  reference: 'REF123',
  party_size: 4,
  booking_type: 'dinner',
  seating_preference: 'any',
  status: 'pending',
  customer_name: 'Ada Lovelace',
  customer_email: 'ada@example.com',
  customer_phone: '07123456789',
  notes: null,
  client_request_id: 'request-1',
  created_at: '2026-05-23T11:00:00.000Z',
  updated_at: '2026-05-23T11:01:00.000Z',
} as BookingRecord;

function cookieRequest(cookies: string[] = [], url = 'https://www.nabatable.com/api/bookings') {
  return new NextRequest(url, {
    method: 'POST',
    headers: cookies.length ? { cookie: cookies.join('; ') } : {},
  });
}

function setCookies(response: Response): string[] {
  return response.headers.getSetCookie();
}

function allowingThrottle() {
  return vi.fn(async () => ({ allowed: true })) as unknown as BookingCreateContactThrottle &
    ReturnType<typeof vi.fn>;
}

function build(
  overrides: Partial<Parameters<typeof buildBookingCreateHttpResponse>[0]> = {},
): Promise<Response> {
  return buildBookingCreateHttpResponse({
    accessSecret: SECRET,
    booking,
    contactEmail: booking.customer_email,
    contactThrottle: allowingThrottle(),
    cookieRequest: cookieRequest(),
    createOrigin: 'inserted',
    creatorCapabilityEligible: true,
    loyaltyPointsAwarded: 0,
    manageLinkEnqueuer: vi.fn(async () => undefined),
    now: () => NOW,
    restaurantId: RESTAURANT_ID,
    useUnifiedValidation: true,
    ...overrides,
  });
}

describe('buildBookingCreateHttpResponse: creator issuance (guest-auth §4.2)', () => {
  it('§23 a new insert sets exactly one __Host-nt_bk.<id> cookie and no sr_access/sr_confirm value', async () => {
    const response = await build();

    expect(response.status).toBe(201);
    expect(response.headers.get('X-Booking-Validation')).toBe('unified');
    await expect(response.json()).resolves.toMatchObject({
      booking: { id: BOOKING_ID },
      duplicate: false,
      clientRequestId: 'request-1',
    });

    const cookies = setCookies(response);
    const creator = cookies.filter((cookie) => cookie.startsWith(`__Host-nt_bk.${BOOKING_ID}=`));
    expect(creator).toHaveLength(1);
    const [cookie] = creator;
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Path=/');
    expect(cookie).not.toContain('Domain=');
    const maxAge = Number(/Max-Age=(\d+)/.exec(cookie ?? '')?.[1]);
    expect(maxAge).toBeGreaterThan(0);
    expect(maxAge).toBeLessThanOrEqual(86_400);

    const token = decodeURIComponent(cookie?.split(';')[0]?.split('=').slice(1).join('=') ?? '');
    const validated = validateBookingAccessToken(token, { secret: SECRET, now: NOW });
    expect(validated.ok && validated.payload.bid).toBe(BOOKING_ID);
    expect(validated.ok && validated.payload.src).toBe('create');

    // Retired cookies are only ever cleared, never issued.
    for (const legacy of cookies.filter((c) => /^sr_(access|confirm)=/.test(c))) {
      expect(legacy).toMatch(/^sr_(access|confirm)=;/);
      expect(legacy).toContain('Max-Age=0');
    }
  });

  it('§24 an eligible key replay returns the same status and body as the insert, with the cookie', async () => {
    const original = await build({ createOrigin: 'inserted' });
    const replay = await build({ createOrigin: 'key_replay' });

    expect(replay.status).toBe(201);
    expect(replay.status).toBe(original.status);
    await expect(replay.json()).resolves.toEqual(await original.json());
    expect(setCookies(replay).some((c) => c.startsWith(`__Host-nt_bk.${BOOKING_ID}=`))).toBe(true);
  });

  it('writes the development cookie name without Secure over plain http outside production', async () => {
    const response = await build({
      cookieRequest: cookieRequest([], 'http://localhost:3000/api/bookings'),
    });

    const cookie = setCookies(response).find((c) => c.startsWith(`nt_bk.${BOOKING_ID}=`));
    expect(cookie).toBeDefined();
    expect(cookie).not.toContain('Secure');
  });

  it('issues no capability without a secret, but still answers with the booking', async () => {
    const response = await build({ accessSecret: null });

    expect(response.status).toBe(201);
    expect(setCookies(response).some((c) => c.includes('nt_bk.'))).toBe(false);
  });

  it('keeps the create successful when minting throws', async () => {
    const response = await build({
      grantMinter: vi.fn(() => {
        throw new Error('boom');
      }),
    });

    expect(response.status).toBe(201);
    expect(setCookies(response).some((c) => c.includes('nt_bk.'))).toBe(false);
  });

  it('drops undecodable booking cookies from the jar when it sets the creator cookie', async () => {
    const other = '11111111-2222-4333-8444-555555555555';
    const response = await build({
      cookieRequest: cookieRequest([`__Host-nt_bk.${other}=garbage`]),
    });

    const cookies = setCookies(response);
    expect(cookies.some((c) => c.startsWith(`__Host-nt_bk.${other}=;`))).toBe(true);
    expect(cookies.some((c) => c.startsWith(`__Host-nt_bk.${BOOKING_ID}=`))).toBe(true);
  });
});

describe('buildBookingCreateHttpResponse: non-creator matches (BOOKING_NOT_COMPLETED)', () => {
  it('§25/§26 answers 409 with no cookie and no booking DTO, and enqueues manage_link', async () => {
    const contactThrottle = allowingThrottle();
    const manageLinkEnqueuer = vi.fn(
      async () => undefined,
    ) as unknown as BookingCreateManageLinkEnqueuer & ReturnType<typeof vi.fn>;

    const response = await build({
      contactThrottle,
      createOrigin: 'recovered',
      creatorCapabilityEligible: false,
      manageLinkEnqueuer,
    });
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toEqual({
      error: BOOKING_NOT_COMPLETED_MESSAGE,
      code: BOOKING_NOT_COMPLETED_CODE,
      message: BOOKING_NOT_COMPLETED_MESSAGE,
      retryable: false,
    });
    const text = JSON.stringify(body);
    for (const leaked of [BOOKING_ID, 'REF123', 'ada@example.com', 'Ada', '07123456789']) {
      expect(text).not.toContain(leaked);
    }
    expect(setCookies(response).some((c) => c.includes('nt_bk.'))).toBe(false);
    expect(response.headers.get('Cache-Control')).toBe('no-store');

    expect(contactThrottle).toHaveBeenCalledWith(
      lookupContactKey({ restaurantId: RESTAURANT_ID, email: 'ada@example.com', secret: SECRET }),
    );
    const bucket = Math.floor(NOW.getTime() / (15 * 60 * 1000));
    expect(manageLinkEnqueuer).toHaveBeenCalledWith(
      { bookingId: BOOKING_ID, restaurantId: RESTAURANT_ID, type: 'manage_link' },
      { jobId: `manage_link:${BOOKING_ID}:${bucket}` },
    );
  });

  it('§24 a stale key replay (outside the window) is refused like a recovery', async () => {
    const response = await build({
      createOrigin: 'key_replay',
      creatorCapabilityEligible: false,
    });

    expect(response.status).toBe(409);
    expect(setCookies(response).some((c) => c.includes('nt_bk.'))).toBe(false);
  });

  it('§27 the 409 body is identical for active, cancelled and past bookings', async () => {
    const bodies = await Promise.all(
      [
        booking,
        { ...booking, status: 'cancelled' },
        { ...booking, start_at: '2026-05-01T17:30:00.000Z', end_at: '2026-05-01T19:00:00.000Z' },
      ].map(async (candidate) => {
        const response = await build({
          booking: candidate as BookingRecord,
          createOrigin: 'recovered',
          creatorCapabilityEligible: false,
        });
        return { status: response.status, body: await response.text() };
      }),
    );

    expect(new Set(bodies.map((entry) => entry.status))).toEqual(new Set([409]));
    expect(new Set(bodies.map((entry) => entry.body)).size).toBe(1);
  });

  it('§27 consumes the throttle but enqueues nothing once the contact is over the limit', async () => {
    const contactThrottle = vi.fn(async () => ({ allowed: false }));
    const manageLinkEnqueuer = vi.fn(async () => undefined);

    const response = await build({
      contactThrottle,
      createOrigin: 'recovered',
      creatorCapabilityEligible: false,
      manageLinkEnqueuer,
    });

    expect(response.status).toBe(409);
    expect(contactThrottle).toHaveBeenCalledTimes(1);
    expect(manageLinkEnqueuer).not.toHaveBeenCalled();
  });

  it('does not enqueue a link for a cancelled or finished booking (still consumes the throttle)', async () => {
    const contactThrottle = allowingThrottle();
    const manageLinkEnqueuer = vi.fn(async () => undefined);

    await build({
      booking: { ...booking, status: 'cancelled' } as BookingRecord,
      contactThrottle,
      createOrigin: 'recovered',
      creatorCapabilityEligible: false,
      manageLinkEnqueuer,
    });

    expect(contactThrottle).toHaveBeenCalledTimes(1);
    expect(manageLinkEnqueuer).not.toHaveBeenCalled();
  });

  it('skips the throttle and the link for a phone-only request or without a secret', async () => {
    for (const overrides of [{ contactEmail: '' }, { accessSecret: null }]) {
      const contactThrottle = allowingThrottle();
      const manageLinkEnqueuer = vi.fn(async () => undefined);
      const response = await build({
        ...overrides,
        contactThrottle,
        createOrigin: 'recovered',
        creatorCapabilityEligible: false,
        manageLinkEnqueuer,
      });

      expect(response.status).toBe(409);
      expect(contactThrottle).not.toHaveBeenCalled();
      expect(manageLinkEnqueuer).not.toHaveBeenCalled();
    }
  });

  it('still answers the neutral 409 when enqueueing fails', async () => {
    const response = await build({
      createOrigin: 'recovered',
      creatorCapabilityEligible: false,
      manageLinkEnqueuer: vi.fn(async () => {
        throw new Error('queue down');
      }),
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ code: BOOKING_NOT_COMPLETED_CODE });
  });
});
