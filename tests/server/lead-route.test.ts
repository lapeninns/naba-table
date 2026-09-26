import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireApiRateLimitMock = vi.hoisted(() => vi.fn());
const getRouteHandlerSupabaseClientMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/security/api-rate-limit', () => ({
  requireApiRateLimit: requireApiRateLimitMock,
}));

vi.mock('@/server/supabase', () => ({
  getRouteHandlerSupabaseClient: getRouteHandlerSupabaseClientMock,
}));

import { POST } from '@/src/app/api/lead/route';

function makeRequest(email: string) {
  return new NextRequest('https://www.nabatable.com/api/lead', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email }),
  });
}

describe('POST /api/lead', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    requireApiRateLimitMock.mockReset();
    requireApiRateLimitMock.mockResolvedValue(null);
    getRouteHandlerSupabaseClientMock.mockReset();
  });

  it('returns success after the lead insert succeeds', async () => {
    const insert = vi.fn().mockResolvedValue({ data: null, error: null });
    const from = vi.fn(() => ({ insert }));
    getRouteHandlerSupabaseClientMock.mockResolvedValue({ from });

    const response = await POST(makeRequest('guest@example.com'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({});
    expect(from).toHaveBeenCalledWith('leads');
    expect(insert).toHaveBeenCalledWith({ email: 'guest@example.com' });
  });

  it('returns a failure when Supabase resolves an insert error', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const insert = vi.fn().mockResolvedValue({
      data: null,
      error: {
        code: '42501',
        message: 'new row violates row-level security policy SECRET_DB_DETAIL guest@example.com',
      },
    });
    const from = vi.fn(() => ({ insert }));
    getRouteHandlerSupabaseClientMock.mockResolvedValue({ from });

    const response = await POST(makeRequest('guest@example.com'));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({
      error: 'Unable to store lead',
      code: 'INTERNAL_ERROR',
      message: 'Unable to store lead',
    });
    expect(JSON.stringify(body)).not.toContain('SECRET_DB_DETAIL');
    // Logged through lib/logger: the Postgres code survives as errorKind; the
    // raw message and the guest email never reach the log line.
    const logged = consoleError.mock.calls.flat().map(String).join('\n');
    expect(logged).toContain('api.internal_error');
    expect(logged).toContain('"errorKind":"42501"');
    expect(logged).not.toContain('guest@example.com');
  });

  it('returns the rate-limit response before touching Supabase', async () => {
    requireApiRateLimitMock.mockResolvedValue(
      NextResponse.json(
        { error: 'Too many lead requests. Please try again later.' },
        { status: 429 },
      ),
    );

    const response = await POST(makeRequest('guest@example.com'));
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body).toEqual({ error: 'Too many lead requests. Please try again later.' });
    expect(getRouteHandlerSupabaseClientMock).not.toHaveBeenCalled();
  });

  it('returns 400 INVALID_REQUEST_BODY for malformed JSON instead of an unhandled 500', async () => {
    const response = await POST(
      new NextRequest('https://www.nabatable.com/api/lead', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{not json',
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: 'INVALID_REQUEST_BODY' });
    expect(getRouteHandlerSupabaseClientMock).not.toHaveBeenCalled();
  });

  it('returns 400 EMAIL_REQUIRED when the email is missing', async () => {
    const response = await POST(
      new NextRequest('https://www.nabatable.com/api/lead', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Email is required.',
      code: 'EMAIL_REQUIRED',
      message: 'Email is required.',
    });
  });

  it('returns a generic 500 without raw failure text when the client throws', async () => {
    getRouteHandlerSupabaseClientMock.mockRejectedValue(
      new Error('SECRET_DB_DETAIL cookie store unavailable'),
    );

    const response = await POST(makeRequest('guest@example.com'));

    expect(response.status).toBe(500);
    const text = await response.text();
    expect(text).not.toContain('SECRET_DB_DETAIL');
    expect(JSON.parse(text)).toMatchObject({ code: 'INTERNAL_ERROR' });
  });
});
