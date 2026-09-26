import { NextResponse } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

import { buildAuthenticatedMyBookingsHttpResponse } from '@/server/bookings/my-bookings-auth-response';

type TestUser = { id: string; email?: string; email_confirmed_at?: string | null };

function makeRouteClient(user: TestUser | null, error: unknown = null) {
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
  it('returns unauthenticated when the route auth client reports an error', async () => {
    const response = await buildAuthenticatedMyBookingsHttpResponse({
      routeClientFor: vi.fn(async () =>
        makeRouteClient({ id: 'user-1', email: 'guest@example.com' }, new Error('denied')),
      ) as never,
      searchParams: new URLSearchParams(),
      serviceClientFor: vi.fn(),
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ code: 'UNAUTHENTICATED' });
  });

  it('returns unauthenticated without a user', async () => {
    const response = await buildAuthenticatedMyBookingsHttpResponse({
      routeClientFor: vi.fn(async () => makeRouteClient(null)) as never,
      searchParams: new URLSearchParams(),
      serviceClientFor: vi.fn(),
    });

    expect(response.status).toBe(401);
  });

  it('lists by user id only while email matching is disabled', async () => {
    const serviceClient = { from: vi.fn() };
    const serviceClientFor = vi.fn(() => serviceClient);
    const responseBuilder = vi.fn(async () => NextResponse.json({ bookings: [] }));
    const searchParams = new URLSearchParams('page=2');
    const onPageFetchError = vi.fn();

    const response = await buildAuthenticatedMyBookingsHttpResponse({
      onPageFetchError,
      responseBuilder,
      routeClientFor: vi.fn(async () =>
        makeRouteClient({
          id: 'user-1',
          email: 'Guest@Example.com',
          email_confirmed_at: '2026-01-01T00:00:00.000Z',
        }),
      ) as never,
      searchParams,
      serviceClientFor: serviceClientFor as never,
    });

    expect(response.status).toBe(200);
    expect(responseBuilder).toHaveBeenCalledWith({
      clientFor: expect.any(Function),
      userId: 'user-1',
      email: null,
      emailMatch: false,
      onPageFetchError,
      searchParams,
    });
    expect(serviceClientFor).not.toHaveBeenCalled();

    const [{ clientFor }] = responseBuilder.mock.calls[0] as unknown as [
      { clientFor: () => typeof serviceClient },
    ];
    expect(clientFor()).toBe(serviceClient);
    expect(serviceClientFor).toHaveBeenCalledOnce();
  });

  it('adds the email match only for a confirmed email when enabled', async () => {
    const responseBuilder = vi.fn(async () => NextResponse.json({ bookings: [] }));

    await buildAuthenticatedMyBookingsHttpResponse({
      emailMatchEnabled: true,
      responseBuilder,
      routeClientFor: vi.fn(async () =>
        makeRouteClient({
          id: 'user-1',
          email: 'guest@example.com',
          email_confirmed_at: '2026-01-01T00:00:00.000Z',
        }),
      ) as never,
      searchParams: new URLSearchParams(),
      serviceClientFor: vi.fn(),
    });
    expect(responseBuilder).toHaveBeenLastCalledWith(
      expect.objectContaining({ email: 'guest@example.com', emailMatch: true }),
    );

    await buildAuthenticatedMyBookingsHttpResponse({
      emailMatchEnabled: true,
      responseBuilder,
      routeClientFor: vi.fn(async () =>
        makeRouteClient({ id: 'user-1', email: 'guest@example.com', email_confirmed_at: null }),
      ) as never,
      searchParams: new URLSearchParams(),
      serviceClientFor: vi.fn(),
    });
    expect(responseBuilder).toHaveBeenLastCalledWith(
      expect.objectContaining({ email: null, emailMatch: false }),
    );
  });
});
