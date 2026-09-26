import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

const loggerErrorMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/logger', async (importOriginal) => {
  const actual = await importOriginal<typeof LoggerModule>();
  return { ...actual, logger: { error: loggerErrorMock } };
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
