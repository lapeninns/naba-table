import { NextRequest, NextResponse } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const requireApiRateLimitMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/security/api-rate-limit', () => ({
  requireApiRateLimit: requireApiRateLimitMock,
}));

import { POST } from '@/src/app/api/client-error/route';

describe('client error route', () => {
  beforeEach(() => {
    requireApiRateLimitMock.mockReset().mockResolvedValue(null);
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('accepts safe client error reports and logs a redacted payload', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = await POST(
      new NextRequest('https://www.nabatable.com/api/client-error', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          path: '/guest/dashboard?access_token=path-secret',
          message: 'Guest guest@example.com hit Authorization: Bearer message-secret',
          stack: 'Error: failed for +44 7700 900123\nCookie: session=cookie-secret',
          userId: 'user-1',
          bookingId: 'booking-1',
          ignored: 'drop-me',
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });

    const output = JSON.stringify(errorSpy.mock.calls);
    expect(output).toContain('client error report');
    expect(output).not.toContain('path-secret');
    expect(output).not.toContain('guest@example.com');
    expect(output).not.toContain('message-secret');
    expect(output).not.toContain('+44 7700 900123');
    expect(output).not.toContain('cookie-secret');
    expect(output).not.toContain('drop-me');
    expect(output).toContain('[redacted-email]');
    expect(output).toContain('[redacted-phone]');
  });

  it('rejects malformed JSON without logging the raw body', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const response = await POST(
      new NextRequest('https://www.nabatable.com/api/client-error', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{"message":"token=raw-secret"',
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Invalid client error report' });

    const output = JSON.stringify(warnSpy.mock.calls);
    expect(output).toContain('invalid_json');
    expect(output).not.toContain('raw-secret');
  });

  it('dispatches privacy-safe web exceptions into the repository insight pipeline', async () => {
    vi.stubEnv('ERROR_INSIGHT_GITHUB_TOKEN', 'github-token');
    vi.stubEnv('ERROR_INSIGHT_GITHUB_REPOSITORY', 'lapeninns/nabatable');
    vi.stubEnv('VERCEL_GIT_COMMIT_SHA', 'abc123');
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetcher);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = await POST(
      new NextRequest('https://www.nabatable.com/api/client-error', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-request-id': 'request-123',
          traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
        },
        body: JSON.stringify({
          path: '/guest/dashboard?access_token=path-secret',
          message: 'Guest guest@example.com failed',
          stack: 'Error: guest@example.com failed',
          userId: null,
          bookingId: null,
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const dispatchBody = await new Response(fetcher.mock.calls[0]?.[1]?.body).json();
    expect(dispatchBody).toEqual({
      event_type: 'runtime-error',
      client_payload: {
        service: 'nabatable-web',
        trace_id: '4bf92f3577b34da6a3ce929d0e0e4736',
        deploy_sha: 'abc123',
        request_id: 'request-123',
        method: 'POST',
        path: '/guest/dashboard',
        fingerprint: 'nabatable-web:POST:/guest/dashboard',
      },
    });
    expect(JSON.stringify(dispatchBody)).not.toContain('guest@example.com');
    expect(JSON.stringify(dispatchBody)).not.toContain('path-secret');
  });

  it('rejects malformed client error payloads', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const response = await POST(
      new NextRequest('https://www.nabatable.com/api/client-error', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          path: '/guest/dashboard',
          message: 123,
          stack: null,
          userId: 'user-1',
          bookingId: 'booking-1',
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Invalid client error report' });
    expect(JSON.stringify(warnSpy.mock.calls)).toContain('invalid_payload');
  });

  it('rate limits before parsing client error payloads', async () => {
    requireApiRateLimitMock.mockResolvedValueOnce(
      NextResponse.json({ error: 'Too many client error reports' }, { status: 429 }),
    );

    const request = new NextRequest('https://www.nabatable.com/api/client-error', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{bad-json',
    });

    const response = await POST(request);

    expect(response.status).toBe(429);
    expect(requireApiRateLimitMock).toHaveBeenCalledWith(
      expect.objectContaining({ scope: 'client-error' }),
    );
  });

  it('rejects oversized client error bodies', async () => {
    const response = await POST(
      new NextRequest('https://www.nabatable.com/api/client-error', {
        method: 'POST',
        headers: { 'content-length': String(17 * 1024) },
        body: JSON.stringify({ message: 'too large' }),
      }),
    );

    expect(response.status).toBe(413);
  });
});
