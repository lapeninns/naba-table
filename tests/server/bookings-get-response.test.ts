import { NextResponse } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

import { buildBookingsGetHttpResponse } from '@/server/bookings/bookings-get-response';

describe('bookings GET response orchestration', () => {
  it('delegates me=1 requests to the authenticated my-bookings response builder', async () => {
    const myBookingsResponseBuilder = vi.fn(async () => NextResponse.json({ items: [] }));
    const searchParams = new URLSearchParams('me=1&page=2');

    const response = await buildBookingsGetHttpResponse({
      myBookingsResponseBuilder,
      searchParams,
    });

    expect(response.status).toBe(200);
    expect(myBookingsResponseBuilder).toHaveBeenCalledWith({
      onPageFetchError: expect.any(Function),
      searchParams,
    });
  });

  it.each([
    'email=guest%40example.com&phone=07700900123&restaurantId=11111111-1111-4111-8111-111111111111',
    'email=guest%40example.com',
    '',
    'me=0',
  ])('answers the removed contact lookup (%s) with 410 and no query', async (query) => {
    const myBookingsResponseBuilder = vi.fn();

    const response = await buildBookingsGetHttpResponse({
      cookieAccessToken: 'sr2.a.b.c',
      guestLookupPolicyEnabled: true,
      myBookingsResponseBuilder,
      searchParams: new URLSearchParams(query),
      sessionRecoverySecret: 'secret',
    });
    const body = await response.json();

    expect(response.status).toBe(410);
    expect(body).toMatchObject({ code: 'CONTACT_LOOKUP_REMOVED' });
    expect(body).not.toHaveProperty('bookings');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(myBookingsResponseBuilder).not.toHaveBeenCalled();
  });

  it('maps unexpected GET failures to a generic 500', async () => {
    const logger = vi.fn();
    const response = await buildBookingsGetHttpResponse({
      logger,
      myBookingsResponseBuilder: vi.fn(async () => {
        throw new Error('boom');
      }),
      searchParams: new URLSearchParams('me=1'),
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({ code: 'INTERNAL_ERROR' });
    expect(logger).toHaveBeenCalledWith('[bookings][GET]', expect.any(String));
  });
});
