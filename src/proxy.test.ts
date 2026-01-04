import { NextRequest } from 'next/server';
import { describe, expect, it, beforeEach, vi } from 'vitest';

vi.mock('@/server/supabase', async (importOriginal) => {
  const actual = await importOriginal<typeof supabaseModule>();
  const getMiddlewareSupabaseClient = vi.fn();
  return { ...actual, getMiddlewareSupabaseClient };
});

// Import after mocks
import * as supabaseModule from '@/server/supabase';

import { handleRouting } from './proxy';

const getMiddlewareSupabaseClient =
  supabaseModule.getMiddlewareSupabaseClient as unknown as vi.Mock;

function buildRequest(pathname: string, host = 'example.com') {
  const url = new URL(`https://${host}${pathname}`);
  return new NextRequest(url);
}

function stubAuth(
  options: {
    authenticated?: boolean;
    memberships?: unknown[];
    throwMembershipError?: boolean;
  } = {},
) {
  const {
    authenticated = true,
    memberships = [{ role: 'owner' }],
    throwMembershipError = false,
  } = options;

  getMiddlewareSupabaseClient.mockReturnValue({
    auth: {
      getUser: vi
        .fn()
        .mockResolvedValue({
          data: { user: authenticated ? { id: 'user-1' } : null },
          error: null,
        }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          limit: vi
            .fn()
            .mockResolvedValue(
              throwMembershipError
                ? { data: null, error: new Error('membership error') }
                : { data: memberships, error: null },
            ),
        }),
      }),
    }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_ROOT_DOMAIN = 'example.com';
});

describe('middleware host routing', () => {
  it('redirects root /app/* to app host without /app prefix', async () => {
    stubAuth();
    const req = buildRequest('/app/dashboard', 'example.com');
    const res = await handleRouting(req);
    expect(res.status).toBe(308);
    expect(res.headers.get('location')).toBe('https://app.example.com/dashboard');
  });

  it('redirects root /ops to app management', async () => {
    stubAuth();
    const req = buildRequest('/ops', 'example.com');
    const res = await handleRouting(req);
    expect(res.status).toBe(308);
    expect(res.headers.get('location')).toBe('https://app.example.com/app/management');
  });

  it('strips /app prefix on app host to keep clean URLs', async () => {
    stubAuth();
    const req = buildRequest('/app/app/dashboard', 'app.example.com');
    const res = await handleRouting(req);
    expect(res.status).toBe(308);
    expect(res.headers.get('location')).toBe('https://app.example.com/dashboard');
  });

  it('redirects guest path on app host back to root host', async () => {
    stubAuth();
    const req = buildRequest('/guest/dashboard', 'app.example.com');
    const res = await handleRouting(req);
    expect(res.status).toBe(308);
    expect(res.headers.get('location')).toBe('https://example.com/guest/dashboard');
  });

  it('treats app.localhost.com as an app host when ROOT_DOMAIN is localhost', async () => {
    const previousRoot = process.env.NEXT_PUBLIC_ROOT_DOMAIN;
    process.env.NEXT_PUBLIC_ROOT_DOMAIN = 'localhost';
    stubAuth();
    const req = buildRequest('/guest/dashboard', 'app.localhost.com');
    const res = await handleRouting(req);
    expect(res.status).toBe(308);
    expect(res.headers.get('location')).toBe('https://localhost/guest/dashboard');
    process.env.NEXT_PUBLIC_ROOT_DOMAIN = previousRoot;
  });

  it('skips static/framework assets', async () => {
    stubAuth();
    const req = buildRequest('/_next/static/chunk.js', 'example.com');
    const res = await handleRouting(req);
    expect(res.headers.get('location')).toBeNull();
    expect(res.status).toBe(200);
  });

  it('redirects unauthenticated page access to /auth/signin', async () => {
    stubAuth({ authenticated: false });
    const req = buildRequest('/dashboard', 'app.example.com');
    const res = await handleRouting(req);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/auth/signin');
  });
});

describe('ops api rewrite & guard', () => {
  it('rewrites app host ops service and enforces auth', async () => {
    stubAuth();
    const req = buildRequest('/api/bookings', 'app.example.com');
    const res = await handleRouting(req);
    const rewrite = res.headers.get('x-middleware-rewrite');
    expect(rewrite).toContain('/api/ops/bookings');
  });

  it('returns 401 for unauthenticated /api/ops access', async () => {
    stubAuth({ authenticated: false });
    const req = buildRequest('/api/ops/bookings', 'example.com');
    const res = await handleRouting(req);
    expect(res.status).toBe(401);
  });
});
