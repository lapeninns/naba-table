import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const envMock = vi.hoisted(() => ({
  security: {
    turnstileSecretKey: 'turnstile-secret',
    turnstileExpectedHostname: 'www.nabatable.com',
  },
}));

vi.mock('@/lib/env', () => ({
  env: envMock,
}));

import { verifyTurnstileToken } from '@/server/security/turnstile';

const fetchMock = vi.fn();

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
    },
  });
}

describe('verifyTurnstileToken', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    envMock.security.turnstileSecretKey = 'turnstile-secret';
    envMock.security.turnstileExpectedHostname = 'www.nabatable.com';
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns success for a valid token verification response', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        success: true,
        action: 'guest_signin_magic_link',
        hostname: 'www.nabatable.com',
        'error-codes': [],
      }),
    );

    const result = await verifyTurnstileToken({
      token: 'token-123',
      remoteIp: '203.0.113.10',
      expectedAction: 'guest_signin_magic_link',
      expectedHostname: 'www.nabatable.com',
    });

    expect(result).toEqual({
      ok: true,
      action: 'guest_signin_magic_link',
      hostname: 'www.nabatable.com',
      errorCodes: [],
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://challenges.cloudflare.com/turnstile/v0/siteverify');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({
      'Content-Type': 'application/x-www-form-urlencoded',
    });
    expect(String(init.body)).toContain('secret=turnstile-secret');
    expect(String(init.body)).toContain('response=token-123');
    expect(String(init.body)).toContain('remoteip=203.0.113.10');
  });

  it('returns verification_failed when token verification fails', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        success: false,
        action: 'guest_signin_magic_link',
        hostname: 'www.nabatable.com',
        'error-codes': ['invalid-input-response'],
      }),
    );

    const result = await verifyTurnstileToken({
      token: 'invalid-token',
      expectedAction: 'guest_signin_magic_link',
      expectedHostname: 'www.nabatable.com',
    });

    expect(result).toEqual({
      ok: false,
      reason: 'verification_failed',
      action: 'guest_signin_magic_link',
      hostname: 'www.nabatable.com',
      errorCodes: ['invalid-input-response'],
    });
  });

  it('returns verify_unavailable when verification endpoint is unreachable', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network timeout'));

    const result = await verifyTurnstileToken({
      token: 'token-123',
      expectedAction: 'guest_signin_magic_link',
      expectedHostname: 'www.nabatable.com',
    });

    expect(result).toEqual({
      ok: false,
      reason: 'verify_unavailable',
      action: null,
      hostname: null,
      errorCodes: ['verification-request-failed'],
    });
  });
});
