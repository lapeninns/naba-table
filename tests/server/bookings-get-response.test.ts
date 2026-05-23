import { NextResponse } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

import { buildBookingsGetHttpResponse } from '@/server/bookings/bookings-get-response';

const baseArgs = {
  clientIp: '203.0.113.10',
  cookieAccessToken: null,
  guestLookupPepper: 'pepper',
  guestLookupPolicyEnabled: true,
  headers: new Headers(),
  searchParams: new URLSearchParams(),
  sessionRecoverySecret: 'secret',
};

describe('bookings GET response orchestration', () => {
  it('delegates me=1 requests to the authenticated my-bookings response builder', async () => {
    const myBookingsResponseBuilder = vi.fn(async () => NextResponse.json({ bookings: [] }));
    const guestLookupResponseBuilder = vi.fn();
    const searchParams = new URLSearchParams('me=1&page=2');
    const logger = vi.fn();

    const response = await buildBookingsGetHttpResponse({
      ...baseArgs,
      guestLookupResponseBuilder,
      logger,
      myBookingsResponseBuilder,
      searchParams,
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ bookings: [] });
    expect(myBookingsResponseBuilder).toHaveBeenCalledWith({
      onPageFetchError: expect.any(Function),
      searchParams,
    });
    expect(guestLookupResponseBuilder).not.toHaveBeenCalled();

    const { onPageFetchError } = myBookingsResponseBuilder.mock.calls[0][0];
    onPageFetchError(new Error('page fetch failed'));
    expect(logger).toHaveBeenCalledWith('[bookings][GET][me]', expect.any(Error));
  });

  it('delegates guest lookup requests and preserves policy logging', async () => {
    const guestLookupResponseBuilder = vi.fn(async ({ onPolicyLog }) => {
      onPolicyLog?.({ kind: 'rpc_failed', message: 'rpc down' });
      onPolicyLog?.({ kind: 'unexpected_error', message: 'unexpected' });
      return NextResponse.json({ bookings: [], access: { mode: 'contact' } });
    });
    const logger = vi.fn();

    const response = await buildBookingsGetHttpResponse({
      ...baseArgs,
      cookieAccessToken: 'cookie-token',
      guestLookupResponseBuilder,
      logger,
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      bookings: [],
      access: { mode: 'contact' },
    });
    expect(guestLookupResponseBuilder).toHaveBeenCalledWith({
      clientIp: baseArgs.clientIp,
      cookieAccessToken: 'cookie-token',
      guestLookupPepper: baseArgs.guestLookupPepper,
      guestLookupPolicyEnabled: true,
      onPolicyLog: expect.any(Function),
      requestHeaders: baseArgs.headers,
      requestSource: 'api.bookings',
      searchParams: baseArgs.searchParams,
      sessionRecoverySecret: baseArgs.sessionRecoverySecret,
    });
    expect(logger).toHaveBeenCalledWith('[bookings][GET][guest-lookup] rpc failed', 'rpc down');
    expect(logger).toHaveBeenCalledWith(
      '[bookings][GET][guest-lookup] unexpected error',
      'unexpected',
    );
  });

  it('maps unexpected GET failures to the shared unable-to-fetch response', async () => {
    const logger = vi.fn();

    const response = await buildBookingsGetHttpResponse({
      ...baseArgs,
      guestLookupResponseBuilder: vi.fn(async () => {
        throw new Error('lookup unavailable');
      }),
      logger,
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: 'Unable to fetch bookings' });
    expect(logger).toHaveBeenCalledWith(
      '[bookings][GET]',
      expect.stringContaining('lookup unavailable'),
    );
  });
});
