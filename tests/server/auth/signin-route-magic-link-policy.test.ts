import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const validateCsrfTokenMock = vi.hoisted(() => vi.fn());
const consumeMagicLinkSigninThrottleMock = vi.hoisted(() => vi.fn());
const classifySigninSurfaceMock = vi.hoisted(() => vi.fn());
const verifyTurnstileTokenMock = vi.hoisted(() => vi.fn());
const recordMagicLinkSigninAuditMock = vi.hoisted(() => vi.fn());
const sendAuthMagicLinkMock = vi.hoisted(() => vi.fn());
const getServiceSupabaseClientMock = vi.hoisted(() => vi.fn());
const getRouteHandlerSupabaseClientMock = vi.hoisted(() => vi.fn());
const consumeRateLimitMock = vi.hoisted(() => vi.fn());
const cookiesMock = vi.hoisted(() => vi.fn());

vi.mock('next/headers', () => ({
  cookies: cookiesMock,
}));

vi.mock('@/server/security/csrf', () => ({
  validateCsrfToken: validateCsrfTokenMock,
}));

vi.mock('@/server/auth/signin-throttle', () => ({
  consumeMagicLinkSigninThrottle: consumeMagicLinkSigninThrottleMock,
}));

vi.mock('@/server/auth/signin-surface', () => ({
  classifySigninSurface: classifySigninSurfaceMock,
}));

vi.mock('@/server/security/turnstile', () => ({
  verifyTurnstileToken: verifyTurnstileTokenMock,
}));

vi.mock('@/server/auth/signin-audit', () => ({
  recordMagicLinkSigninAudit: recordMagicLinkSigninAuditMock,
}));

vi.mock('@/server/auth/magic-link-email', () => ({
  sendAuthMagicLink: sendAuthMagicLinkMock,
  isMagicLinkDeliveryError: () => false,
}));

vi.mock('@/server/supabase', () => ({
  getServiceSupabaseClient: getServiceSupabaseClientMock,
  getRouteHandlerSupabaseClient: getRouteHandlerSupabaseClientMock,
}));

vi.mock('@/server/security/rate-limit', () => ({
  consumeRateLimit: consumeRateLimitMock,
}));

import { POST } from '@/src/app/api/auth/signin/route';

function buildMagicLinkThrottleOk() {
  return {
    ok: true as const,
    checks: [
      {
        scope: 'ip' as const,
        result: {
          ok: true,
          limit: 5,
          remaining: 4,
          resetAt: Date.now() + 60_000,
          source: 'memory' as const,
        },
      },
      {
        scope: 'global' as const,
        result: {
          ok: true,
          limit: 120,
          remaining: 119,
          resetAt: Date.now() + 60_000,
          source: 'memory' as const,
        },
      },
    ],
  };
}

function buildLookupClient(result: { data: unknown; error: { code?: string; message?: string } | null }) {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const limit = vi.fn().mockReturnValue({ maybeSingle });
  const eq = vi.fn().mockReturnValue({ limit });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });
  return { from };
}

function buildRequest(payload: Record<string, unknown>): NextRequest {
  return new NextRequest('https://www.nabatable.com/api/auth/signin', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      host: 'www.nabatable.com',
    },
    body: JSON.stringify(payload),
  });
}

function buildCallbackRequest(url: string): NextRequest {
  return new NextRequest(url, {
    method: 'GET',
    headers: {
      host: 'www.nabatable.com',
    },
  });
}

describe('signin route magic-link policy', () => {
  beforeEach(() => {
    validateCsrfTokenMock.mockReset();
    consumeMagicLinkSigninThrottleMock.mockReset();
    classifySigninSurfaceMock.mockReset();
    verifyTurnstileTokenMock.mockReset();
    recordMagicLinkSigninAuditMock.mockReset();
    sendAuthMagicLinkMock.mockReset();
    getServiceSupabaseClientMock.mockReset();
    getRouteHandlerSupabaseClientMock.mockReset();
    consumeRateLimitMock.mockReset();
    cookiesMock.mockReset();

    validateCsrfTokenMock.mockReturnValue(true);
    classifySigninSurfaceMock.mockReturnValue('app_ops');
    consumeMagicLinkSigninThrottleMock.mockResolvedValue(buildMagicLinkThrottleOk());
    verifyTurnstileTokenMock.mockResolvedValue({
      ok: true,
      action: 'guest_signin_magic_link',
      hostname: 'www.nabatable.com',
      errorCodes: [],
    });
    getRouteHandlerSupabaseClientMock.mockResolvedValue({
      auth: {
        signInWithPassword: vi.fn(),
      },
    });
    consumeRateLimitMock.mockResolvedValue({
      ok: true,
      limit: 5,
      remaining: 4,
      resetAt: Date.now() + 60_000,
      source: 'memory',
    });
    cookiesMock.mockResolvedValue({
      getAll: vi.fn().mockReturnValue([]),
    });
  });

  it('returns 202 and suppresses send for unknown email', async () => {
    getServiceSupabaseClientMock.mockReturnValue(
      buildLookupClient({
        data: null,
        error: null,
      }),
    );

    const response = await POST(
      buildRequest({
        mode: 'magic_link',
        email: 'unknown@example.com',
        redirectedFrom: '/guest/dashboard',
      }),
    );

    expect(response.status).toBe(202);
    expect(sendAuthMagicLinkMock).not.toHaveBeenCalled();
    expect(recordMagicLinkSigninAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'suppressed_unknown_email' }),
    );
  });

  it('returns 202 and sends magic link for known email', async () => {
    getServiceSupabaseClientMock.mockReturnValue(
      buildLookupClient({
        data: { id: 'a4f4be11-9d83-4ced-839a-8abbde5336c0' },
        error: null,
      }),
    );
    sendAuthMagicLinkMock.mockResolvedValue(undefined);

    const response = await POST(
      buildRequest({
        mode: 'magic_link',
        email: 'known@example.com',
        redirectedFrom: '/guest/dashboard',
      }),
    );

    expect(response.status).toBe(202);
    expect(sendAuthMagicLinkMock).toHaveBeenCalledTimes(1);
    expect(recordMagicLinkSigninAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'sent' }),
    );
  });

  it('returns 202 and records send_error when delivery fails', async () => {
    getServiceSupabaseClientMock.mockReturnValue(
      buildLookupClient({
        data: { id: '2db9dc1f-2bf0-4d49-ad66-f345d4ecc7c8' },
        error: null,
      }),
    );
    sendAuthMagicLinkMock.mockRejectedValue(new Error('delivery-failed'));

    const response = await POST(
      buildRequest({
        mode: 'magic_link',
        email: 'known@example.com',
        redirectedFrom: '/guest/dashboard',
      }),
    );

    expect(response.status).toBe(202);
    expect(
      recordMagicLinkSigninAuditMock.mock.calls.some(
        ([call]) => call?.outcome === 'send_error',
      ),
    ).toBe(true);
  });

  it('sanitizes unsafe redirect targets and falls back to the guest dashboard', async () => {
    getServiceSupabaseClientMock.mockReturnValue(
      buildLookupClient({
        data: { id: '2db9dc1f-2bf0-4d49-ad66-f345d4ecc7c8' },
        error: null,
      }),
    );
    sendAuthMagicLinkMock.mockResolvedValue(undefined);

    const response = await POST(
      buildRequest({
        mode: 'magic_link',
        email: 'known@example.com',
        redirectedFrom: 'https://evil.example/steal',
      }),
    );

    expect(response.status).toBe(202);
    expect(sendAuthMagicLinkMock).toHaveBeenCalledWith(
      expect.objectContaining({
        emailRedirectTo: expect.stringContaining(
          'redirectedFrom=https%3A%2F%2Fwww.localhost%2Fguest%2Fdashboard',
        ),
      }),
    );
  });
});

describe('auth callback failure redirects', () => {
  beforeEach(() => {
    getRouteHandlerSupabaseClientMock.mockReset();
    getServiceSupabaseClientMock.mockReset();
  });

  it('redirects expired code failures to guest sign-in with guest-safe copy', async () => {
    const exchangeCodeForSession = vi.fn().mockResolvedValue({
      data: { user: null },
      error: { message: 'otp expired', code: 'otp_expired', status: 400, name: 'AuthApiError' },
    });
    cookiesMock.mockResolvedValue({
      getAll: vi.fn().mockReturnValue([]),
    });
    getRouteHandlerSupabaseClientMock.mockResolvedValue({
      auth: {
        exchangeCodeForSession,
        getUser: vi.fn(),
      },
    });

    const { GET } = await import('@/src/app/api/auth/callback/route');
    const response = await GET(
      buildCallbackRequest(
        'https://www.nabatable.com/api/auth/callback?code=expired-code&redirectedFrom=%2Fguest%2Fbookings',
      ),
    );

    expect(response.status).toBe(307);
    const location = response.headers.get('location');
    const decodedLocation = decodeURIComponent((location ?? '').replace(/\+/g, ' '));
    expect(location).toContain('/auth?');
    expect(location).toContain('error=link_expired');
    expect(decodedLocation).toContain('Your magic link has expired. Please request a new one.');
    expect(decodedLocation).not.toContain('otp_expired');
  });

  it('redirects already-used token_hash failures to guest sign-in with guest-safe copy', async () => {
    const verifyOtp = vi.fn().mockResolvedValue({
      data: { session: null },
      error: {
        message: 'Token has already been used',
        code: 'otp_disabled',
        status: 400,
        name: 'AuthApiError',
      },
    });
    cookiesMock.mockResolvedValue({
      getAll: vi.fn().mockReturnValue([]),
    });
    getRouteHandlerSupabaseClientMock.mockResolvedValue({
      auth: {
        verifyOtp,
      },
    });

    const { GET } = await import('@/src/app/api/auth/callback/route');
    const response = await GET(
      buildCallbackRequest(
        'https://www.nabatable.com/api/auth/callback?token_hash=used-token&redirectedFrom=%2Fguest%2Fdashboard',
      ),
    );

    expect(response.status).toBe(307);
    const location = response.headers.get('location');
    const decodedLocation = decodeURIComponent((location ?? '').replace(/\+/g, ' '));
    expect(location).toContain('/auth?');
    expect(location).toContain('error=link_used');
    expect(decodedLocation).toContain(
      'This magic link has already been used. Please request a new one.',
    );
    expect(decodedLocation).not.toContain('otp_disabled');
    expect(decodedLocation).not.toContain('Token has already been used');
  });
});
