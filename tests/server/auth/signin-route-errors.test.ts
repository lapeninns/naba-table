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

vi.mock('@/lib/posthog/server', () => ({
  captureServerException: vi.fn(),
}));

import { POST } from '@/src/app/api/auth/signin/route';

function signinRequest(body: unknown, rawBody?: string) {
  return new NextRequest('http://localhost:3000/api/auth/signin', {
    method: 'POST',
    headers: { 'content-type': 'application/json', host: 'app.localhost:3000' },
    body: rawBody ?? JSON.stringify(body),
  });
}

const PASSWORD_BODY = {
  mode: 'password',
  email: 'owner@example.com',
  password: 'correct horse battery',
  redirectedFrom: '/dashboard',
};

describe('POST /api/auth/signin error bodies', () => {
  beforeEach(() => {
    validateCsrfTokenMock.mockReset().mockReturnValue(true);
    signInWithPasswordMock.mockReset().mockResolvedValue({ error: null });
    getRouteHandlerSupabaseClientMock.mockReset().mockResolvedValue({
      auth: { signInWithPassword: signInWithPasswordMock },
    });
    consumeRateLimitMock.mockReset().mockResolvedValue({
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

  it('returns 403 CSRF_INVALID without a valid CSRF token', async () => {
    validateCsrfTokenMock.mockReturnValue(false);

    const response = await POST(signinRequest(PASSWORD_BODY));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: 'Invalid or missing CSRF token.',
      code: 'CSRF_INVALID',
      message: 'Invalid or missing CSRF token.',
    });
  });

  it('returns 400 INVALID_REQUEST_BODY for malformed JSON', async () => {
    const response = await POST(signinRequest(null, '{not json'));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: 'INVALID_REQUEST_BODY' });
  });

  it('keeps the first issue message and details.field that OpsSignInForm reads', async () => {
    const response = await POST(signinRequest({ ...PASSWORD_BODY, password: '' }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Enter your password',
      code: 'VALIDATION_FAILED',
      message: 'Enter your password',
      fields: { password: ['Enter your password'] },
      details: { field: 'password' },
    });
  });

  it('returns 401 INVALID_CREDENTIALS for rejected passwords', async () => {
    signInWithPasswordMock.mockResolvedValue({
      error: { status: 400, code: 'invalid_credentials', message: 'Invalid login credentials' },
    });

    const response = await POST(signinRequest(PASSWORD_BODY));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      code: 'INVALID_CREDENTIALS',
      error: 'Invalid email or password',
    });
  });

  it('keeps a provider 5xx status without the provider text', async () => {
    signInWithPasswordMock.mockResolvedValue({
      error: { status: 502, message: 'SECRET_PROVIDER_DETAIL upstream gotrue failure' },
    });

    const response = await POST(signinRequest(PASSWORD_BODY));

    expect(response.status).toBe(502);
    const text = await response.text();
    expect(text).not.toContain('SECRET_PROVIDER_DETAIL');
    expect(JSON.parse(text)).toMatchObject({ code: 'SIGNIN_UNAVAILABLE', retryable: true });
  });

  it('returns 429 RATE_LIMITED with Retry-After and rate headers', async () => {
    consumeRateLimitMock.mockResolvedValue({
      ok: false,
      limit: 5,
      remaining: 0,
      resetAt: Date.now() + 30_000,
      source: 'memory',
    });

    const response = await POST(signinRequest(PASSWORD_BODY));

    expect(response.status).toBe(429);
    expect(Number(response.headers.get('Retry-After'))).toBeGreaterThan(0);
    expect(response.headers.get('X-RateLimit-Limit')).toBe('5');
    await expect(response.json()).resolves.toMatchObject({
      code: 'RATE_LIMITED',
      retryable: true,
    });
  });

  it('returns a generic 500 without raw failure text on unexpected errors', async () => {
    getRouteHandlerSupabaseClientMock.mockRejectedValue(
      new Error('SECRET_DB_DETAIL cookie store unavailable for owner@example.com'),
    );

    const response = await POST(signinRequest(PASSWORD_BODY));

    expect(response.status).toBe(500);
    const text = await response.text();
    expect(text).not.toContain('SECRET_DB_DETAIL');
    expect(text).not.toContain('owner@example.com');
    expect(JSON.parse(text)).toMatchObject({ code: 'INTERNAL_ERROR' });
  });
});
