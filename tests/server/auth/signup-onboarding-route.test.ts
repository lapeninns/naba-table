import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const consumeRateLimitMock = vi.hoisted(() => vi.fn());
const getMagicLinkFailureMock = vi.hoisted(() => vi.fn());
const getRouteHandlerSupabaseClientMock = vi.hoisted(() => vi.fn());
const isMagicLinkDeliveryErrorMock = vi.hoisted(() => vi.fn());
const sendAuthMagicLinkMock = vi.hoisted(() => vi.fn());
const signUpMock = vi.hoisted(() => vi.fn());
const validateCsrfTokenMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/security/csrf', () => ({
  validateCsrfToken: validateCsrfTokenMock,
}));

vi.mock('@/server/security/rate-limit', () => ({
  consumeRateLimit: consumeRateLimitMock,
}));

vi.mock('@/server/supabase', () => ({
  getRouteHandlerSupabaseClient: getRouteHandlerSupabaseClientMock,
}));

vi.mock('@/server/auth/magic-link-email', () => ({
  getMagicLinkFailure: getMagicLinkFailureMock,
  isMagicLinkDeliveryError: isMagicLinkDeliveryErrorMock,
  sendAuthMagicLink: sendAuthMagicLinkMock,
}));

import { POST } from '@/src/app/api/auth/signup/route';

function buildRateLimitResult(overrides: Partial<{ ok: boolean; remaining: number }> = {}) {
  return {
    ok: overrides.ok ?? true,
    limit: 5,
    remaining: overrides.remaining ?? 4,
    resetAt: Date.now() + 60_000,
    source: 'memory' as const,
  };
}

function request(payload: Record<string, unknown> | string) {
  return new NextRequest('https://www.nabatable.com/api/auth/signup', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      host: 'www.nabatable.com',
    },
    body: typeof payload === 'string' ? payload : JSON.stringify(payload),
  });
}

describe('POST /api/auth/signup onboarding contract', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_ROOT_DOMAIN = 'nabatable.com';
    consumeRateLimitMock.mockReset().mockResolvedValue(buildRateLimitResult());
    getMagicLinkFailureMock.mockReset().mockReturnValue({
      message: 'We could not send a magic link right now. Please try again.',
      status: 503,
    });
    getRouteHandlerSupabaseClientMock.mockReset().mockResolvedValue({
      auth: {
        signUp: signUpMock,
      },
    });
    isMagicLinkDeliveryErrorMock.mockReset().mockReturnValue(false);
    sendAuthMagicLinkMock.mockReset().mockResolvedValue(undefined);
    signUpMock.mockReset().mockResolvedValue({
      data: { session: null },
      error: null,
    });
    validateCsrfTokenMock.mockReset().mockReturnValue(true);
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_ROOT_DOMAIN;
  });

  it('rejects missing CSRF before parsing onboarding signup payloads', async () => {
    validateCsrfTokenMock.mockReturnValue(false);

    const response = await POST(request('{not-json'));

    expect(response.status).toBe(403);
    expect(consumeRateLimitMock).not.toHaveBeenCalled();
    expect(signUpMock).not.toHaveBeenCalled();
    expect(sendAuthMagicLinkMock).not.toHaveBeenCalled();
  });

  it('returns field-level validation errors without leaving onboarding', async () => {
    const response = await POST(
      request({
        mode: 'password',
        email: 'owner@example.com',
        password: 'short',
        redirectedFrom: '/onboarding/profile',
      }),
    );

    await expect(response.json()).resolves.toMatchObject({
      message: expect.any(String),
      details: { field: 'password' },
    });
    expect(response.status).toBe(400);
    expect(signUpMock).not.toHaveBeenCalled();
  });

  it('creates password signups with the safe onboarding callback path', async () => {
    const response = await POST(
      request({
        mode: 'password',
        email: 'OWNER@EXAMPLE.COM',
        password: 'Correct horse battery staple 1',
        redirectedFrom: 'https://evil.example/onboarding/profile',
      }),
    );

    await expect(response.json()).resolves.toEqual({
      status: 'confirmation_required',
      redirectTo: '/onboarding/profile',
    });
    expect(response.status).toBe(201);
    expect(signUpMock).toHaveBeenCalledWith({
      email: 'owner@example.com',
      password: 'Correct horse battery staple 1',
      options: {
        emailRedirectTo:
          'https://www.nabatable.com/api/auth/callback?redirectedFrom=%2Fonboarding%2Fprofile&rememberMe=0',
      },
    });
  });

  it('builds password signup callbacks from trusted auth hosts, not attacker request origins', async () => {
    const response = await POST(
      new NextRequest('https://evil.example/api/auth/signup', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          host: 'evil.example',
        },
        body: JSON.stringify({
          mode: 'password',
          email: 'owner@example.com',
          password: 'Correct horse battery staple 1',
          redirectedFrom: '/onboarding/profile',
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(signUpMock).toHaveBeenCalledWith(
      expect.objectContaining({
        options: {
          emailRedirectTo:
            'https://www.nabatable.com/api/auth/callback?redirectedFrom=%2Fonboarding%2Fprofile&rememberMe=0',
        },
      }),
    );
  });

  it('does not reveal existing accounts during signup', async () => {
    signUpMock.mockResolvedValue({
      data: { session: null },
      error: {
        status: 400,
        message: 'A user with this email address has already been registered',
      },
    });

    const response = await POST(
      request({
        mode: 'password',
        email: 'owner@example.com',
        password: 'Correct horse battery staple 1',
        redirectedFrom: '/onboarding/profile',
      }),
    );

    await expect(response.json()).resolves.toEqual({
      status: 'confirmation_required',
      redirectTo: '/onboarding/profile',
    });
    expect(response.status).toBe(201);
  });

  it('uses an aggregate IP signup rate limit before the email-specific bucket', async () => {
    await POST(
      request({
        mode: 'password',
        email: 'owner@example.com',
        password: 'Correct horse battery staple 1',
        redirectedFrom: '/onboarding/profile',
      }),
    );

    expect(consumeRateLimitMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        identifier: expect.stringMatching(/^signup:password:/),
        limit: 20,
      }),
    );
    expect(consumeRateLimitMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        identifier: expect.stringContaining(':owner@example.com'),
        limit: 5,
      }),
    );
  });

  it('sends magic-link signup through the onboarding callback without provider mutation leaks', async () => {
    const response = await POST(
      request({
        mode: 'magic_link',
        email: 'owner@example.com',
        redirectedFrom: '/onboarding/profile',
      }),
    );

    await expect(response.json()).resolves.toEqual({
      status: 'magic_link_sent',
      redirectTo: '/onboarding/profile',
    });
    expect(response.status).toBe(202);
    expect(sendAuthMagicLinkMock).toHaveBeenCalledWith({
      email: 'owner@example.com',
      emailRedirectTo:
        'https://www.nabatable.com/api/auth/callback?redirectedFrom=%2Fonboarding%2Fprofile&rememberMe=0',
      intent: 'signup',
      data: { intent: 'onboarding_signup' },
    });
  });

  const passwordPayload = {
    mode: 'password',
    email: 'owner@example.com',
    password: 'Correct horse battery staple 1',
    redirectedFrom: '/onboarding/profile',
  };

  it('maps provider sign-up failures to safe C1 copy without provider text', async () => {
    signUpMock.mockResolvedValue({
      data: { session: null },
      error: { status: 422, code: 'signup_disabled', message: 'Signups not allowed for otp' },
    });

    const response = await POST(request(passwordPayload));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe('SIGNUP_FAILED');
    expect(JSON.stringify(body)).not.toContain('otp');
  });

  it('maps a weak password rejection to a password field error', async () => {
    signUpMock.mockResolvedValue({
      data: { session: null },
      error: { status: 422, code: 'weak_password', message: 'Password is known to be weak' },
    });

    const response = await POST(request(passwordPayload));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({ code: 'WEAK_PASSWORD', fields: { password: expect.any(Array) } });
  });

  it('never exposes a 5xx provider message', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    signUpMock.mockResolvedValue({
      data: { session: null },
      error: { status: 500, message: 'Database error saving new user' },
    });

    try {
      const response = await POST(request(passwordPayload));
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.code).toBe('INTERNAL_ERROR');
      expect(JSON.stringify(body)).not.toContain('Database error');
    } finally {
      consoleError.mockRestore();
    }
  });

  it('reports confirmation_required for password sign-ups without a session', async () => {
    const response = await POST(request(passwordPayload));

    await expect(response.json()).resolves.toMatchObject({ status: 'confirmation_required' });
  });

  it('returns the C1 rate-limit contract with Retry-After', async () => {
    consumeRateLimitMock.mockResolvedValueOnce(buildRateLimitResult({ ok: false, remaining: 0 }));

    const response = await POST(request(passwordPayload));
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body).toMatchObject({ code: 'RATE_LIMITED', retryable: true });
    expect(Number(response.headers.get('Retry-After'))).toBeGreaterThan(0);
  });
});
