import { NextResponse } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

import { buildAuthenticatedMyBookingsHttpResponse } from '@/server/bookings/my-bookings-auth-response';

function makeRouteClient(user: { email?: string } | null, error: unknown = null) {
  return {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user },
        error,
      })),
    },
  };
}

describe('authenticated my-bookings response', () => {
  it('returns unauthorized when the route auth client reports an error', async () => {
    const response = await buildAuthenticatedMyBookingsHttpResponse({
      routeClientFor: vi.fn(async () =>
        makeRouteClient({ email: 'guest@example.com' }, new Error('denied')),
      ),
      searchParams: new URLSearchParams(),
      serviceClientFor: vi.fn(),
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
  });

  it('returns unauthorized when the authenticated user has no email', async () => {
    const response = await buildAuthenticatedMyBookingsHttpResponse({
      routeClientFor: vi.fn(async () => makeRouteClient({})),
      searchParams: new URLSearchParams(),
      serviceClientFor: vi.fn(),
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
  });

  it('delegates authenticated requests to the my-bookings response builder', async () => {
    const serviceClient = { from: vi.fn() };
    const serviceClientFor = vi.fn(() => serviceClient);
    const responseBuilder = vi.fn(async () => NextResponse.json({ bookings: [] }));
    const searchParams = new URLSearchParams('page=2');
    const onPageFetchError = vi.fn();

    const response = await buildAuthenticatedMyBookingsHttpResponse({
      onPageFetchError,
      responseBuilder,
      routeClientFor: vi.fn(async () => makeRouteClient({ email: 'Guest@Example.com' })),
      searchParams,
      serviceClientFor,
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ bookings: [] });
    expect(responseBuilder).toHaveBeenCalledWith({
      clientFor: expect.any(Function),
      email: 'Guest@Example.com',
      onPageFetchError,
      searchParams,
    });
    expect(serviceClientFor).not.toHaveBeenCalled();

    const [{ clientFor }] = responseBuilder.mock.calls[0] as [
      { clientFor: () => typeof serviceClient },
    ];
    expect(clientFor()).toBe(serviceClient);
    expect(serviceClientFor).toHaveBeenCalledOnce();
  });
});
