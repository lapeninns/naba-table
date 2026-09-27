import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

const loggerErrorMock = vi.hoisted(() => vi.fn());
const loggerWarnMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/logger', async (importOriginal) => {
  const actual = await importOriginal<typeof LoggerModule>();
  return { ...actual, logger: { error: loggerErrorMock, warn: loggerWarnMock } };
});

import {
  apiError,
  conflict,
  forbidden,
  internalError,
  notFound,
  rateLimited,
  unauthenticated,
  validationError,
} from '@/lib/api/errors';

import type * as LoggerModule from '@/lib/logger';

describe('lib/api/errors (C1 flat contract)', () => {
  beforeEach(() => {
    loggerErrorMock.mockReset();
  });

  it('apiError returns a flat body with error mirroring message', async () => {
    const response = apiError(409, 'SLUG_TAKEN', 'That address is already in use.', {
      retryable: false,
      details: { slug: 'taken' },
      headers: { 'X-Test': '1' },
    });
    expect(response.status).toBe(409);
    expect(response.headers.get('X-Test')).toBe('1');
    expect(await response.json()).toEqual({
      error: 'That address is already in use.',
      code: 'SLUG_TAKEN',
      message: 'That address is already in use.',
      retryable: false,
      details: { slug: 'taken' },
    });
  });

  it('apiError omits optional keys that were not provided', async () => {
    const body = (await apiError(400, 'BAD_INPUT', 'Bad input.').json()) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(['code', 'error', 'message']);
  });

  it('validationError maps zod issues to dot-path fields', async () => {
    const schema = z.object({
      guest: z.object({ name: z.string().min(1, 'Enter a name.') }),
      party: z.number().int().min(1, 'At least one guest.'),
      tags: z.array(z.string()),
    });
    const result = schema.safeParse({ guest: { name: '' }, party: 0, tags: ['ok', 3] });
    expect(result.success).toBe(false);
    if (result.success) return;

    const response = validationError(result.error);
    expect(response.status).toBe(400);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(body.message).toBe('Some fields need attention.');
    expect(body.error).toBe('Some fields need attention.');
    expect(body.fields).toEqual({
      'guest.name': ['Enter a name.'],
      party: ['At least one guest.'],
      'tags.1': [expect.any(String)],
    });
  });

  it('validationError groups repeated messages for the same path', async () => {
    const schema = z
      .object({ a: z.string().min(3, 'Too short.').regex(/^x/, 'Must start with x.') })
      .refine(() => false, { message: 'Whole form invalid.' });
    const result = schema.safeParse({ a: 'y' });
    if (result.success) throw new Error('expected failure');
    const body = (await validationError(result.error, 'Check the form.').json()) as {
      fields: Record<string, string[]>;
      message: string;
    };
    expect(body.message).toBe('Check the form.');
    expect(body.fields.a).toEqual(['Too short.', 'Must start with x.']);
  });

  it('status helpers use the documented statuses and codes', async () => {
    const cases: Array<[Response, number, string]> = [
      [unauthenticated(), 401, 'UNAUTHENTICATED'],
      [forbidden(), 403, 'FORBIDDEN'],
      [forbidden('NOT_A_MEMBER', 'You are not a member.'), 403, 'NOT_A_MEMBER'],
      [notFound(), 404, 'NOT_FOUND'],
      [notFound('BOOKING_NOT_FOUND', 'Booking not found.'), 404, 'BOOKING_NOT_FOUND'],
      [conflict('BOOKING_STATE_CONFLICT', 'Booking changed.'), 409, 'BOOKING_STATE_CONFLICT'],
    ];
    for (const [response, status, code] of cases) {
      expect(response.status).toBe(status);
      const body = (await response.json()) as { code: string; message: string; error: string };
      expect(body.code).toBe(code);
      expect(body.message.length).toBeGreaterThan(0);
      expect(body.error).toBe(body.message);
    }
  });

  it('rateLimited sets Retry-After and marks the body retryable', async () => {
    const response = rateLimited(30);
    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('30');
    const body = (await response.json()) as Record<string, unknown>;
    expect(body).toMatchObject({ code: 'RATE_LIMITED', retryable: true, retryAfter: 30 });
  });

  it('rateLimited rounds fractional seconds up and never goes below zero', () => {
    expect(rateLimited(1.2).headers.get('Retry-After')).toBe('2');
    expect(rateLimited(-5).headers.get('Retry-After')).toBe('0');
  });

  it('internalError returns the generic 500 and never echoes the raw message', async () => {
    const raw = Object.assign(
      new Error(
        'duplicate key value violates unique constraint "guests_email_key" jane@example.com',
      ),
      { code: '23505' },
    );
    const response = internalError(raw, { route: 'POST /api/bookings', restaurantId: 'r1' });
    expect(response.status).toBe(500);
    const text = await response.text();
    expect(text).not.toContain('duplicate key');
    expect(text).not.toContain('jane@example.com');
    expect(JSON.parse(text)).toEqual({
      error: 'Something went wrong on our side. Try again.',
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong on our side. Try again.',
    });

    expect(loggerErrorMock).toHaveBeenCalledTimes(1);
    const [event, meta] = loggerErrorMock.mock.calls[0] as [string, Record<string, unknown>];
    expect(event).toBe('api.internal_error');
    expect(meta).toMatchObject({
      route: 'POST /api/bookings',
      restaurantId: 'r1',
      errorName: 'Error',
      errorKind: '23505',
    });
    expect(meta.errorMessage).toContain('duplicate key value violates unique constraint');
    expect(meta.errorMessage).toContain('[redacted-email]');
    expect(typeof meta.errorStack).toBe('string');
    expect(JSON.stringify(meta)).not.toContain('jane@example.com');
  });

  it('internalError handles non-Error throwables and redacts their text in logs', async () => {
    const response = internalError(
      'boom for jane@example.com',
      { route: 'GET /x' },
      'Could not load.',
    );
    const body = (await response.json()) as Record<string, unknown>;
    expect(body.message).toBe('Could not load.');
    expect(JSON.stringify(body)).not.toContain('boom');
    const [, meta] = loggerErrorMock.mock.calls[0] as [string, Record<string, unknown>];
    expect(meta.errorName).toBe('string');
    expect(meta.errorMessage).toBe('boom for [redacted-email]');
  });
});

describe('internalError with Supabase/PostgREST error objects', () => {
  beforeEach(() => {
    loggerErrorMock.mockReset();
  });

  it('logs the pg code as errorKind and a sanitised message for a plain PostgREST error object', async () => {
    const postgrestError = {
      message: 'duplicate key value violates unique constraint "customers_email_key"',
      code: '23505',
      details: 'Key (email)=(jane@example.com) already exists.',
      hint: null,
    };
    const response = internalError(postgrestError, { route: 'POST /api/x' });
    const text = await response.text();
    expect(text).not.toContain('duplicate key');

    const [, meta] = loggerErrorMock.mock.calls[0] as [string, Record<string, unknown>];
    expect(meta.errorName).toBe('PostgrestError');
    expect(meta.errorKind).toBe('23505');
    expect(meta.errorMessage).toContain('duplicate key value violates unique constraint');
    // details/hint carry row values (PII); they are never logged.
    expect(JSON.stringify(meta)).not.toContain('jane@example.com');
    expect(JSON.stringify(meta)).not.toContain('Key (email)');
  });

  it('redacts PII in the message of an error object and keeps its own name', () => {
    internalError(
      { name: 'AuthApiError', message: 'User jane@example.com not found', code: 'user_not_found' },
      { route: 'GET /x' },
    );
    const [, meta] = loggerErrorMock.mock.calls[0] as [string, Record<string, unknown>];
    expect(meta.errorName).toBe('AuthApiError');
    expect(meta.errorKind).toBe('user_not_found');
    expect(meta.errorMessage).toBe('User [redacted-email] not found');
  });

  it('still reports a shapeless object as errorName object', () => {
    internalError({ foo: 1 }, { route: 'GET /x' });
    const [, meta] = loggerErrorMock.mock.calls[0] as [string, Record<string, unknown>];
    expect(meta).toMatchObject({ errorName: 'object' });
    expect(meta.errorMessage).toBeUndefined();
  });
});

describe('validationError root issues', () => {
  it('keys a path-less issue under _root', async () => {
    const result = z.string().safeParse(42);
    if (result.success) throw new Error('expected failure');
    const body = (await validationError(result.error).json()) as {
      fields: Record<string, string[]>;
    };
    expect(Object.keys(body.fields)).toEqual(['_root']);
  });
});

describe('internalError when the database cannot be reached', () => {
  beforeEach(() => {
    loggerErrorMock.mockReset();
    loggerWarnMock.mockReset();
  });

  const RETRY_COPY = 'We couldn’t reach the server just now. Try again in a moment.';
  const UNKNOWN_COPY = 'We couldn’t confirm this was saved. Refresh to check before trying again.';

  // The request never left the app: nothing can have been written, so any method may retry.
  const beforeSend: Array<[string, unknown]> = [
    ['DNS failure', { message: 'getaddrinfo ENOTFOUND example.supabase.co', code: '' }],
    ['refused connection', { message: 'connect ECONNREFUSED 127.0.0.1:54321', code: '' }],
    ['connect timeout', { message: 'Connect Timeout Error', code: 'UND_ERR_CONNECT_TIMEOUT' }],
  ];
  // The request may have reached the database before the connection dropped.
  const midFlight: Array<[string, unknown]> = [
    [
      'supabase-js fetch failure',
      {
        message: 'TypeError: fetch failed',
        code: '',
        details: 'TypeError: fetch failed',
        hint: '',
      },
    ],
    [
      'socket reset',
      Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNRESET' } }),
    ],
    ['socket hang up', new Error('socket hang up')],
  ];

  it.each([...beforeSend, ...midFlight])(
    'returns a retryable 503 for a read after a %s',
    async (_label, error) => {
      const response = internalError(error, { route: 'ops/tables', method: 'GET' });

      expect(response.status).toBe(503);
      expect(response.headers.get('Retry-After')).toBe('2');
      expect(await response.json()).toEqual({
        error: RETRY_COPY,
        code: 'UPSTREAM_UNAVAILABLE',
        message: RETRY_COPY,
        retryable: true,
        retryAfter: 2,
      });
      // A transient network failure is a warning, not an internal error.
      expect(loggerErrorMock).not.toHaveBeenCalled();
      expect(loggerWarnMock).toHaveBeenCalledWith(
        'api.upstream_unavailable',
        expect.objectContaining({ route: 'ops/tables', method: 'GET', outcome: 'not_sent' }),
      );
    },
  );

  it.each(beforeSend)('lets a write retry after a %s', async (_label, error) => {
    const response = internalError(error, { route: 'ops/zones', method: 'POST' });

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      code: 'UPSTREAM_UNAVAILABLE',
      retryable: true,
    });
  });

  it.each(midFlight)(
    'never invites a write to retry after a %s, because it may have landed',
    async (_label, error) => {
      const response = internalError(error, { route: 'POST /api/ops/zones' });

      expect(response.status).toBe(503);
      expect(response.headers.get('Retry-After')).toBeNull();
      expect(await response.json()).toEqual({
        error: UNKNOWN_COPY,
        code: 'OUTCOME_UNKNOWN',
        message: UNKNOWN_COPY,
      });
      expect(loggerWarnMock).toHaveBeenCalledWith(
        'api.upstream_unavailable',
        expect.objectContaining({ outcome: 'unknown' }),
      );
    },
  );

  it('treats a route without a known method as a write', async () => {
    const response = internalError(new Error('socket hang up'), { route: 'profile.put' });
    expect(await response.json()).toMatchObject({ code: 'OUTCOME_UNKNOWN' });
  });

  it('keeps real database errors as a 500 even when the message mentions fetch', async () => {
    const response = internalError(
      { message: 'function fetch failed does not exist', code: '42883' },
      { route: 'ops/tables/[id]' },
    );
    expect(response.status).toBe(500);
    expect(loggerErrorMock).toHaveBeenCalledTimes(1);
  });
});
