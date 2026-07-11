import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const validateCsrfTokenMock = vi.hoisted(() => vi.fn());
const getRouteHandlerSupabaseClientMock = vi.hoisted(() => vi.fn());
const consumeRateLimitMock = vi.hoisted(() => vi.fn());
const signInWithPasswordMock = vi.hoisted(() => vi.fn());
const originalRootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN;

vi.mock('@/server/security/csrf', () => ({
  validateCsrfToken: validateCsrfTokenMock,
}));

vi.mock('@/server/supabase', () => ({
  getRouteHandlerSupabaseClient: getRouteHandlerSupabaseClientMock,
  getServiceSupabaseClient: vi.fn(),
}));

vi.mock('@/server/security/rate-limit', () => ({
  consumeRateLimit: consumeRateLimitMock,
}));

import { POST } from '@/src/app/api/auth/signin/route';

describe('signin route ops redirect host resolution', () => {
  beforeEach(() => {
    validateCsrfTokenMock.mockReturnValue(true);
    signInWithPasswordMock.mockResolvedValue({ error: null });
    getRouteHandlerSupabaseClientMock.mockResolvedValue({
      auth: {
        signInWithPassword: signInWithPasswordMock,
      },
    });
    consumeRateLimitMock.mockResolvedValue({
      ok: true,
      limit: 5,
      remaining: 4,
      resetAt: Date.now() + 60_000,
      source: 'memory',
    });
    process.env.NEXT_PUBLIC_ROOT_DOMAIN = 'localhost';
  });

  afterEach(() => {
    if (typeof originalRootDomain === 'string') {
      process.env.NEXT_PUBLIC_ROOT_DOMAIN = originalRootDomain;
    } else {
      delete process.env.NEXT_PUBLIC_ROOT_DOMAIN;
    }
  });

  it('returns /dashboard for ops password sign-in when Host is app.localhost @api @security', async () => {
    const response = await POST(
      new NextRequest('http://localhost:3000/api/auth/signin', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          host: 'app.localhost:3000',
        },
        body: JSON.stringify({
          mode: 'password',
          email: 'owner@example.com',
          password: 'correct horse battery',
          redirectedFrom: '/dashboard',
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: 'ok',
      redirectTo: '/dashboard',
    });
  });

  it('does not fall back to guest dashboard when ops /app redirect is sent from app.localhost @api @security', async () => {
    const response = await POST(
      new NextRequest('http://localhost:3000/api/auth/signin', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          host: 'app.localhost:3000',
        },
        body: JSON.stringify({
          mode: 'password',
          email: 'owner@example.com',
          password: 'correct horse battery',
          redirectedFrom: '/app',
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: 'ok',
      redirectTo: '/app',
    });
  });
});
