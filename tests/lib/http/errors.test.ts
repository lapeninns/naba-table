import { describe, expect, it } from 'vitest';

import { HttpError, normalizeError, parseRetryAfter } from '@/lib/http/errors';

describe('normalizeError (C2)', () => {
  it('reads a string body.error as the message (legacy { error } readers)', () => {
    const error = normalizeError({ status: 409, body: { error: 'Booking no longer available' } });
    expect(error).toBeInstanceOf(HttpError);
    expect(error.message).toBe('Booking no longer available');
    expect(error.code).toBe('HTTP_409');
    expect(error.hasServerMessage).toBe(true);
  });

  it('reads the legacy nested { error: { code, message, details } } shape', () => {
    const error = normalizeError({
      status: 404,
      body: { error: { code: 'NOT_FOUND', message: 'Route not found', details: { id: 'x' } } },
    });
    expect(error.message).toBe('Route not found');
    expect(error.code).toBe('NOT_FOUND');
    expect(error.details).toEqual({ id: 'x' });
  });

  it('reads the flat C1 shape including fields, retryable and retryAfter', () => {
    const error = normalizeError({
      status: 400,
      body: {
        error: 'Some fields need attention.',
        message: 'Some fields need attention.',
        code: 'VALIDATION_FAILED',
        fields: { 'guest.name': ['Enter a name.'], bad: 'not-an-array', mixed: ['ok', 3] },
        retryable: false,
        retryAfter: 12,
        details: { a: 1 },
      },
    });
    expect(error.message).toBe('Some fields need attention.');
    expect(error.code).toBe('VALIDATION_FAILED');
    expect(error.fields).toEqual({ 'guest.name': ['Enter a name.'], mixed: ['ok'] });
    expect(error.retryable).toBe(false);
    expect(error.retryAfter).toBe(12);
    expect(error.details).toEqual({ a: 1 });
  });

  it('prefers body.message over body.error and body.code over nested code', () => {
    const error = normalizeError({
      status: 409,
      body: { message: 'Top', error: { code: 'NESTED', message: 'Nested' }, code: 'TOP' },
    });
    expect(error.message).toBe('Top');
    expect(error.code).toBe('TOP');
  });

  it('never promotes legacy 5xx body text (string error, nested message, loose message)', () => {
    const pg = 'relation "booking_tables" does not exist';
    const cases = [
      { error: pg },
      { error: { code: 'DB', message: pg } },
      { message: pg },
      { message: pg, error: 'something else', code: 'X' },
    ];
    for (const body of cases) {
      const error = normalizeError({ status: 503, statusText: 'Service Unavailable', body });
      expect(error.message).toBe('Service Unavailable');
      expect(error.hasServerMessage).toBe(false);
    }
    const nested = normalizeError({ status: 500, body: { error: { code: 'DB', message: pg } } });
    expect(nested.message).toBe('Request failed with status 500');
    expect(nested.code).toBe('DB');
  });

  it('accepts a 5xx message only in the flat C1 shape (code plus error mirroring message)', () => {
    const error = normalizeError({
      status: 500,
      statusText: 'Internal Server Error',
      body: {
        error: 'Something went wrong on our side. Try again.',
        message: 'Something went wrong on our side. Try again.',
        code: 'INTERNAL_ERROR',
      },
    });
    expect(error.message).toBe('Something went wrong on our side. Try again.');
    expect(error.code).toBe('INTERNAL_ERROR');
    expect(error.hasServerMessage).toBe(true);
  });

  it('falls back to statusText, then the generic message, flagged as not from the server', () => {
    const withStatusText = normalizeError({ status: 500, statusText: 'Internal Server Error' });
    expect(withStatusText.message).toBe('Internal Server Error');
    expect(withStatusText.hasServerMessage).toBe(false);

    const generic = normalizeError({ status: 502, body: { error: '   ' } });
    expect(generic.message).toBe('Request failed with status 502');
    expect(generic.code).toBe('HTTP_502');
    expect(generic.hasServerMessage).toBe(false);
  });

  it('uses the Retry-After header when the body has no retryAfter', () => {
    const headers = new Headers({ 'Retry-After': '45' });
    const error = normalizeError({ status: 429, body: { error: 'Slow down' }, headers });
    expect(error.retryAfter).toBe(45);

    const bodyWins = normalizeError({ status: 429, body: { retryAfter: 5 }, headers });
    expect(bodyWins.retryAfter).toBe(5);
  });

  it('keeps HttpError direct construction working with defaults', () => {
    const error = new HttpError({ message: 'Table not found', status: 404 });
    expect(error.code).toBe('HTTP_404');
    expect(error.hasServerMessage).toBe(true);
    expect(error.fields).toBeUndefined();
    expect(error.retryable).toBeUndefined();
    expect(error.retryAfter).toBeUndefined();
  });
});

describe('parseRetryAfter', () => {
  it('parses delta seconds', () => {
    expect(parseRetryAfter('120')).toBe(120);
    expect(parseRetryAfter(' 0 ')).toBe(0);
  });

  it('parses an HTTP date relative to now, rounding up and clamping at zero', () => {
    const now = Date.parse('2026-09-26T12:00:00Z');
    expect(parseRetryAfter('Sat, 26 Sep 2026 12:00:30 GMT', now)).toBe(30);
    expect(parseRetryAfter('Sat, 26 Sep 2026 11:00:00 GMT', now)).toBe(0);
  });

  it('rejects junk', () => {
    expect(parseRetryAfter(null)).toBeUndefined();
    expect(parseRetryAfter('')).toBeUndefined();
    expect(parseRetryAfter('-3')).toBeUndefined();
    expect(parseRetryAfter('soon')).toBeUndefined();
  });
});
