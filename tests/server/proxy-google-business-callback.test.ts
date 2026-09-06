import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getMiddlewareSupabaseClientMock = vi.hoisted(() => vi.fn());
const requireOpsAuthMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/auth/ops-guard', () => ({
  requireOpsAuth: requireOpsAuthMock,
}));

vi.mock('@/server/supabase', () => ({
  getMiddlewareSupabaseClient: getMiddlewareSupabaseClientMock,
}));

vi.mock('@/lib/security/csrf', () => ({
  buildCsrfCookieOptions: vi.fn(() => ({})),
  CSRF_COOKIE_NAME: 'csrf',
}));

import { APP_REQUEST_PATH_HEADER } from '@/lib/url/app-request-path';
import proxy, { handleRouting } from '@/src/proxy';

describe('proxy GBP callback public API routing', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_ROOT_DOMAIN', 'localhost');
    vi.stubEnv('NEXT_PUBLIC_APP_URL', '');
    vi.stubEnv('NEXT_PUBLIC_LOCAL_APP_HOSTS', '');
    getMiddlewareSupabaseClientMock.mockReset();
    requireOpsAuthMock.mockReset();
  });

  it('does not require ops auth for the per-restaurant Google Business callback', async () => {
    const response = await handleRouting(
      new NextRequest(
        'http://app.localhost/api/ops/restaurants/rest-1/google-business/callback?state=s&code=c',
      ),
    );

    expect(response.headers.get('x-middleware-next')).toBe('1');
    expect(requireOpsAuthMock).not.toHaveBeenCalled();
  });

  it('still requires ops auth for non-public ops APIs', async () => {
    requireOpsAuthMock.mockResolvedValue(NextResponse.json({ error: 'auth' }, { status: 401 }));

    const response = await handleRouting(
      new NextRequest('http://app.localhost/api/ops/restaurants/rest-1/google-business'),
    );

    expect(response.status).toBe(401);
    expect(requireOpsAuthMock).toHaveBeenCalledTimes(1);
  });

  it('strips client-supplied ops user headers and forwards the validated user id', async () => {
    const validatedUserId = '11111111-1111-4111-8111-111111111111';
    requireOpsAuthMock.mockResolvedValue({ userId: validatedUserId, supabase: {} });

    const response = await handleRouting(
      new NextRequest('http://app.localhost/api/ops/bookings/booking-1/dialog', {
        headers: {
          'x-ops-user-id': '22222222-2222-4222-8222-222222222222',
        },
      }),
    );

    const forwardedHeader = response.headers.get('x-middleware-request-x-ops-user-id');

    expect(response.headers.get('x-middleware-next')).toBe('1');
    expect(requireOpsAuthMock).toHaveBeenCalledTimes(1);
    expect(forwardedHeader).toBe(validatedUserId);
    expect(forwardedHeader).not.toBe('22222222-2222-4222-8222-222222222222');
  });

  it('passes retired legacy root-host ops paths through without app redirect', async () => {
    const response = await handleRouting(new NextRequest('http://localhost/ops?from=legacy'));

    expect(response.headers.get('x-middleware-next')).toBe('1');
    expect(response.headers.get('location')).toBeNull();
    expect(requireOpsAuthMock).not.toHaveBeenCalled();
  });

  it('redirects canonical root-host app transport to the app host', async () => {
    const response = await handleRouting(
      new NextRequest('http://localhost/app/settings/restaurant/profile?tab=details'),
    );

    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe(
      'http://app.localhost/settings/restaurant/profile?tab=details',
    );
    expect(requireOpsAuthMock).not.toHaveBeenCalled();
  });

  it('forwards the canonical app request path on authenticated app-host rewrites', async () => {
    getMiddlewareSupabaseClientMock.mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }),
      },
    });

    const response = await handleRouting(
      new NextRequest('http://app.localhost/settings/restaurant/service-periods?tab=schedule'),
    );

    expect(response.headers.get('x-middleware-rewrite')).toBe(
      'http://app.localhost/app/settings/restaurant/service-periods?tab=schedule',
    );
    expect(response.headers.get(`x-middleware-request-${APP_REQUEST_PATH_HEADER}`)).toBe(
      '/app/settings/restaurant/service-periods?tab=schedule',
    );
  });

  it('forwards the requested /app path in root-host single-host mode', async () => {
    vi.stubEnv('NEXT_PUBLIC_LOCAL_APP_HOSTS', 'localhost');

    const response = await handleRouting(
      new NextRequest('http://localhost/app/settings/restaurant/email-templates?source=legacy'),
    );

    expect(response.headers.get('x-middleware-next')).toBe('1');
    expect(response.headers.get(`x-middleware-request-${APP_REQUEST_PATH_HEADER}`)).toBe(
      '/app/settings/restaurant/email-templates?source=legacy',
    );
    expect(response.headers.get('location')).toBeNull();
  });

  it('rewrites guest routes on the app host in local dev instead of redirecting', async () => {
    const response = await handleRouting(
      new NextRequest('http://app.localhost:3000/guest/dashboard'),
    );

    expect(response.headers.get('location')).toBeNull();
    expect(response.headers.get('x-middleware-rewrite')).toBe(
      'http://app.localhost:3000/guest/dashboard',
    );
    expect(requireOpsAuthMock).not.toHaveBeenCalled();
  });

  it('does not let double-slash app paths redirect to an external host', async () => {
    const response = await handleRouting(new NextRequest('http://localhost/app//evil'));

    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe('http://app.localhost/evil');
    expect(requireOpsAuthMock).not.toHaveBeenCalled();
  });

  it('propagates W3C trace and request identity through every matched root request', async () => {
    const response = await proxy(
      new NextRequest('http://localhost/api/events', {
        headers: {
          traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
          'x-request-id': 'request-123',
        },
      }),
    );

    expect(response.headers.get('traceparent')).toMatch(
      /^00-4bf92f3577b34da6a3ce929d0e0e4736-[0-9a-f]{16}-01$/u,
    );
    expect(response.headers.get('x-request-id')).toBe('request-123');
    expect(response.headers.get('server-timing')).toMatch(/^proxy;dur=\d+(?:\.\d+)?$/u);
    expect(response.headers.get('x-middleware-request-traceparent')).toBe(
      response.headers.get('traceparent'),
    );
  });
});

describe('configured staging ops host separation', () => {
  const publicHost = 'nabatable-staging.vercel.app';
  const opsHost = 'nabatable-staging-ops.vercel.app';
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_ROOT_DOMAIN', publicHost);
    vi.stubEnv('NEXT_PUBLIC_APP_URL', `https://${opsHost}`);
    vi.stubEnv('NEXT_PUBLIC_LOCAL_APP_HOSTS', '');
    requireOpsAuthMock.mockReset();
    getMiddlewareSupabaseClientMock.mockReset();
    getMiddlewareSupabaseClientMock.mockReturnValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    });
  });

  it('keeps the staging public homepage public and redirects /app to the configured HTTPS ops origin', async () => {
    const home = await handleRouting(new NextRequest(`https://${publicHost}/`));
    expect(home.headers.get('x-middleware-next')).toBe('1');
    const app = await handleRouting(
      new NextRequest(`http://${publicHost}/app/dashboard?tab=today`),
    );
    expect(app.status).toBe(308);
    expect(app.headers.get('location')).toBe(`https://${opsHost}/dashboard?tab=today`);
    expect(getMiddlewareSupabaseClientMock).not.toHaveBeenCalled();
  });

  it('requires page authentication on the exact staging ops alias', async () => {
    const response = await handleRouting(new NextRequest(`https://${opsHost}/dashboard?tab=today`));
    expect(response.status).toBe(307);
    const location = new URL(response.headers.get('location') ?? '');
    expect(location.origin).toBe(`https://${opsHost}`);
    expect(location.pathname).toBe('/auth/signin');
    expect(getMiddlewareSupabaseClientMock).toHaveBeenCalledOnce();
  });

  it('rewrites authenticated ops pages and auth pages without exposing them on the public alias', async () => {
    getMiddlewareSupabaseClientMock.mockReturnValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'synthetic-user' } } }) },
    });
    const response = await handleRouting(new NextRequest(`https://${opsHost}/dashboard`));
    expect(response.headers.get('x-middleware-rewrite')).toBe(`https://${opsHost}/app/dashboard`);
    const signin = await handleRouting(new NextRequest(`https://${opsHost}/auth/signin`));
    expect(signin.headers.get('x-middleware-rewrite')).toBe(`https://${opsHost}/app/auth/signin`);
    const publicDashboard = await handleRouting(new NextRequest(`https://${publicHost}/dashboard`));
    expect(publicDashboard.headers.get('x-middleware-rewrite')).toBeNull();
  });

  it('redirects ops guest paths to the configured staging public domain', async () => {
    const response = await handleRouting(
      new NextRequest(`https://${opsHost}/guest/bookings?view=all`),
    );
    expect(response.headers.get('location')).toBe(`https://${publicHost}/guest/bookings?view=all`);
  });

  it.each([publicHost, opsHost])('retains direct ops API authorization on %s', async (host) => {
    requireOpsAuthMock.mockResolvedValue(NextResponse.json({ error: 'auth' }, { status: 401 }));
    const response = await handleRouting(
      new NextRequest(`https://${host}/api/ops/bookings`, {
        headers: { 'x-ops-user-id': 'spoofed-user', 'x-forwarded-host': opsHost },
      }),
    );
    expect(response.status).toBe(401);
    expect(requireOpsAuthMock).toHaveBeenCalledOnce();
  });

  it('retains legacy ops API rewriting plus auth on the configured alias', async () => {
    requireOpsAuthMock.mockResolvedValue(NextResponse.json({ error: 'auth' }, { status: 401 }));
    const response = await handleRouting(new NextRequest(`https://${opsHost}/api/bookings`));
    expect(response.status).toBe(401);
    expect(requireOpsAuthMock).toHaveBeenCalledOnce();
  });

  it.each([`${opsHost}.attacker.test`, `prefix-${opsHost}`, `app.${publicHost}`, publicHost])(
    'does not grant configured ops routing to lookalike or forwarded host %s',
    async (host) => {
      const response = await handleRouting(
        new NextRequest(`https://${host}/dashboard`, {
          headers: { 'x-forwarded-host': opsHost, 'x-original-host': opsHost },
        }),
      );
      expect(response.headers.get('x-middleware-rewrite')).toBeNull();
      expect(getMiddlewareSupabaseClientMock).not.toHaveBeenCalled();
    },
  );

  it.each([
    '',
    'https://app.nabatable.com',
    'http://evil.test',
    'https://user:pass@evil.test',
    'https://evil.test/path',
    'https://evil.test?query=1',
    'https://evil.test/#fragment',
    '//evil.test',
    'invalid',
  ])(
    'preserves production host behavior for its canonical APP_URL or absent/invalid configuration (%s)',
    async (appUrl) => {
      vi.stubEnv('NEXT_PUBLIC_ROOT_DOMAIN', 'nabatable.com');
      vi.stubEnv('NEXT_PUBLIC_APP_URL', appUrl);
      const redirect = await handleRouting(new NextRequest('https://nabatable.com/app/dashboard'));
      expect(redirect.headers.get('location')).toBe('https://app.nabatable.com/dashboard');
      const guarded = await handleRouting(new NextRequest('https://app.nabatable.com/dashboard'));
      expect(guarded.status).toBe(307);
    },
  );
});
