import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireOpsAuthMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/auth/ops-guard', () => ({
  requireOpsAuth: requireOpsAuthMock,
}));

vi.mock('@/server/supabase', () => ({
  getMiddlewareSupabaseClient: vi.fn(),
}));

vi.mock('@/lib/security/csrf', () => ({
  buildCsrfCookieOptions: vi.fn(() => ({})),
  CSRF_COOKIE_NAME: 'csrf',
}));

import { handleRouting } from '@/src/proxy';

describe('proxy GBP callback public API routing', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_ROOT_DOMAIN', 'localhost');
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
});
