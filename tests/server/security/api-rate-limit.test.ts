import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const consumeRateLimit = vi.fn();
const recordSecurityEvent = vi.fn();

vi.mock('@/server/security/rate-limit', () => ({
  consumeRateLimit: (...args: unknown[]) => consumeRateLimit(...args),
}));

vi.mock('@/server/security/events', () => ({
  recordSecurityEvent: (...args: unknown[]) => recordSecurityEvent(...args),
}));

import { requireApiRateLimit } from '@/server/security/api-rate-limit';

// 2026-09-26T12:00:00.000Z
const NOW = 1_790_424_000_000;

function request() {
  return new NextRequest('https://app.example.test/api/ops/example', {
    method: 'POST',
    headers: { 'x-forwarded-for': '203.0.113.7' },
  });
}

describe('requireApiRateLimit', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    consumeRateLimit.mockReset();
    recordSecurityEvent.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns null while the caller is under the limit', async () => {
    consumeRateLimit.mockResolvedValue({ ok: true, limit: 5, remaining: 4, resetAt: NOW + 60_000 });

    await expect(
      requireApiRateLimit({ request: request(), scope: 'ops:test', limit: 5, windowMs: 60_000 }),
    ).resolves.toBeNull();
    expect(recordSecurityEvent).not.toHaveBeenCalled();
  });

  it('returns the C1 rate-limited body with Retry-After when the limit is exceeded', async () => {
    consumeRateLimit.mockResolvedValue({
      ok: false,
      limit: 5,
      remaining: 0,
      resetAt: NOW + 12_400,
    });

    const response = await requireApiRateLimit({
      request: request(),
      scope: 'ops:test',
      limit: 5,
      windowMs: 60_000,
      tenantId: 'restaurant-1',
      message: 'Too many resend attempts. Wait a moment and try again.',
    });

    expect(response?.status).toBe(429);
    expect(response?.headers.get('Retry-After')).toBe('13');
    expect(response?.headers.get('X-RateLimit-Limit')).toBe('5');
    expect(response?.headers.get('X-RateLimit-Remaining')).toBe('0');
    expect(response?.headers.get('X-RateLimit-Reset')).toBe(String(NOW + 12_400));
    await expect(response?.json()).resolves.toEqual({
      error: 'Too many resend attempts. Wait a moment and try again.',
      code: 'RATE_LIMITED',
      message: 'Too many resend attempts. Wait a moment and try again.',
      retryable: true,
      retryAfter: 13,
    });
    expect(recordSecurityEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'rate_limit_exceeded', restaurantId: 'restaurant-1' }),
    );
  });

  it('uses the C1 default copy when no message is given', async () => {
    consumeRateLimit.mockResolvedValue({ ok: false, limit: 1, remaining: 0, resetAt: NOW });

    const response = await requireApiRateLimit({
      request: request(),
      scope: 'ops:test',
      limit: 1,
      windowMs: 1_000,
    });

    const body = await response?.json();
    expect(body).toMatchObject({
      code: 'RATE_LIMITED',
      message: 'Too many attempts. Wait a moment and try again.',
      retryable: true,
      retryAfter: 1,
    });
    expect(body.error).toBe(body.message);
  });

  it('fails closed with a safe C1 503 and never echoes the store error', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    consumeRateLimit.mockRejectedValue(new Error('connect ECONNREFUSED 10.0.0.5:6379 secret'));

    const response = await requireApiRateLimit({
      request: request(),
      scope: 'ops:test',
      limit: 5,
      windowMs: 60_000,
    });

    expect(response?.status).toBe(503);
    const body = await response?.json();
    expect(body).toMatchObject({ code: 'RATE_LIMIT_UNAVAILABLE', retryable: true });
    expect(body.error).toBe(body.message);
    expect(JSON.stringify(body)).not.toContain('ECONNREFUSED');
    consoleError.mockRestore();
  });
});
