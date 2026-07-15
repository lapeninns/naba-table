import { describe, expect, it } from 'vitest';

import { isAuthorized, isValidLocalDate, json, readJson } from '../src/gateway-http';

describe('sms gateway HTTP boundary', () => {
  it('serializes JSON with the service content type', async () => {
    const response = json({ ok: true }, { status: 202 });

    expect(response.status).toBe(202);
    expect(response.headers.get('content-type')).toBe('application/json; charset=utf-8');
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it('requires an exact non-empty bearer token', () => {
    expect(
      isAuthorized(
        new Request('https://worker.test', {
          headers: { authorization: 'Bearer expected-token' },
        }),
        'expected-token',
      ),
    ).toBe(true);
    expect(isAuthorized(new Request('https://worker.test'), 'expected-token')).toBe(false);
    expect(
      isAuthorized(
        new Request('https://worker.test', { headers: { authorization: 'Bearer wrong' } }),
        'expected-token',
      ),
    ).toBe(false);
  });

  it('accepts object JSON and rejects arrays or malformed bodies', async () => {
    await expect(
      readJson(
        new Request('https://worker.test', {
          method: 'POST',
          body: JSON.stringify({ restaurantId: 'restaurant-1' }),
        }),
      ),
    ).resolves.toEqual({ restaurantId: 'restaurant-1' });
    await expect(
      readJson(
        new Request('https://worker.test', {
          method: 'POST',
          body: JSON.stringify(['restaurant-1']),
        }),
      ),
    ).resolves.toBeNull();
    await expect(
      readJson(new Request('https://worker.test', { method: 'POST', body: '{' })),
    ).resolves.toBeNull();
  });

  it('recognizes only ISO local calendar dates', () => {
    expect(isValidLocalDate('2026-07-15')).toBe(true);
    expect(isValidLocalDate('15-07-2026')).toBe(false);
    expect(isValidLocalDate(null)).toBe(false);
  });
});
