import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const validateCsrfTokenMock = vi.hoisted(() => vi.fn());
const consumeMagicLinkSigninThrottleMock = vi.hoisted(() => vi.fn());
const classifySigninSurfaceMock = vi.hoisted(() => vi.fn());
const verifyTurnstileTokenMock = vi.hoisted(() => vi.fn());
const recordMagicLinkSigninAuditMock = vi.hoisted(() => vi.fn());
const sendAuthMagicLinkMock = vi.hoisted(() => vi.fn());
const getServiceSupabaseClientMock = vi.hoisted(() => vi.fn());
const getRouteHandlerSupabaseClientMock = vi.hoisted(() => vi.fn());
const consumeRateLimitMock = vi.hoisted(() => vi.fn());
const originalTurnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

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

function buildQuery(result: {
  data: unknown;
  error: { code?: string; message?: string } | null;
}) {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const limit = vi.fn().mockReturnValue({ maybeSingle });
  const eq = vi.fn().mockReturnValue({ limit });
  const select = vi.fn().mockReturnValue({ eq });
  return { select };
}

function buildLookupClient(params: {
  profile?: { data: unknown; error: { code?: string; message?: string } | null };
  userProfile?: { data: unknown; error: { code?: string; message?: string } | null };
}) {
  const profile = params.profile ?? { data: null, error: null };
  const userProfile = params.userProfile ?? { data: null, error: null };
  const from = vi.fn((table: string) => {
    if (table === 'profiles') {
      return buildQuery(profile);
    }
    if (table === 'user_profiles') {
      return buildQuery(userProfile);
    }
    throw new Error(`Unexpected table lookup: ${table}`);
  });
  return { from };
}

function buildKnownProfile(id = 'a4f4be11-9d83-4ced-839a-8abbde5336c0') {
  return buildLookupClient({
    profile: { data: { id }, error: null },
    userProfile: { data: { id }, error: null },
  });
}

function buildRequest(
  payload: Record<string, unknown>,
  host = 'www.nabatable.com',
): NextRequest {
  return new NextRequest(`https://${host}/api/auth/signin`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      host,
    },
    body: JSON.stringify(payload),
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
    delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

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
  });

  afterEach(() => {
    if (typeof originalTurnstileSiteKey === 'string') {
      process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = originalTurnstileSiteKey;
    } else {
      delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    }
  });

  it('returns 202 and suppresses send for unknown email', async () => {
    getServiceSupabaseClientMock.mockReturnValue(
      buildLookupClient({
        profile: { data: null, error: null },
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

  it('returns 202 and suppresses send when profile email has no guest profile row', async () => {
    getServiceSupabaseClientMock.mockReturnValue(
      buildLookupClient({
        profile: { data: { id: 'd60c704f-72be-4e3d-bce8-d37eed63800e' }, error: null },
        userProfile: { data: null, error: null },
      }),
    );

    const response = await POST(
      buildRequest({
        mode: 'magic_link',
        email: 'known-without-guest-profile@example.com',
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
    getServiceSupabaseClientMock.mockReturnValue(buildKnownProfile());
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

  it('verifies public guest Turnstile tokens against the request hostname', async () => {
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = 'turnstile-site-key';
    classifySigninSurfaceMock.mockReturnValue('public_guest');
    getServiceSupabaseClientMock.mockReturnValue(
      buildKnownProfile('42de3a3b-4138-4084-a7e2-611f79777850'),
    );
    sendAuthMagicLinkMock.mockResolvedValue(undefined);

    const response = await POST(
      buildRequest(
        {
          mode: 'magic_link',
          email: 'known@example.com',
          redirectedFrom: '/guest/dashboard',
          captchaToken: 'valid-turnstile-token',
        },
        'staging.nabatable.com',
      ),
    );

    expect(response.status).toBe(202);
    expect(verifyTurnstileTokenMock).toHaveBeenCalledWith({
      token: 'valid-turnstile-token',
      remoteIp: 'unknown',
      expectedAction: 'guest_signin_magic_link',
      expectedHostname: 'staging.nabatable.com',
    });
    expect(sendAuthMagicLinkMock).toHaveBeenCalledTimes(1);
  });

  it('allows local public guest magic links without CAPTCHA when Turnstile is not configured', async () => {
    classifySigninSurfaceMock.mockReturnValue('public_guest');
    getServiceSupabaseClientMock.mockReturnValue(
      buildKnownProfile('5b4ab85f-40d6-49c8-aa46-6bfc7d3ffedb'),
    );
    sendAuthMagicLinkMock.mockResolvedValue(undefined);

    const response = await POST(
      buildRequest(
        {
          mode: 'magic_link',
          email: 'known@example.com',
          redirectedFrom: '/guest/dashboard',
        },
        'localhost:3000',
      ),
    );

    expect(response.status).toBe(202);
    expect(verifyTurnstileTokenMock).not.toHaveBeenCalled();
    expect(sendAuthMagicLinkMock).toHaveBeenCalledTimes(1);
  });

  it('returns 202 and records send_error when delivery fails', async () => {
    getServiceSupabaseClientMock.mockReturnValue(
      buildKnownProfile('2db9dc1f-2bf0-4d49-ad66-f345d4ecc7c8'),
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
});
