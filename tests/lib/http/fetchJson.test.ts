import { afterEach, describe, expect, it, vi } from 'vitest';

import { HttpError } from '@/lib/http/errors';
import { fetchJson } from '@/lib/http/fetchJson';
import { toUserMessage } from '@/lib/http/userMessage';

function stubFetch(response: Response) {
  const fetchMock = vi.fn(async () => response);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

async function captureError(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('expected rejection');
}

describe('fetchJson error contract', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('surfaces a legacy { error } 409 message end to end', async () => {
    stubFetch(
      new Response(JSON.stringify({ error: 'Booking no longer available' }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const error = await captureError(fetchJson('/api/bookings', { method: 'POST' }));
    expect(error).toBeInstanceOf(HttpError);
    expect((error as HttpError).message).toBe('Booking no longer available');
    expect((error as HttpError).status).toBe(409);
    expect(toUserMessage(error)).toBe('Booking no longer available');
  });

  it('passes the Retry-After header through to HttpError.retryAfter', async () => {
    stubFetch(
      new Response(JSON.stringify({ error: 'Too many', code: 'RATE_LIMITED' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json', 'Retry-After': '17' },
      }),
    );
    const error = (await captureError(fetchJson('/api/x'))) as HttpError;
    expect(error.code).toBe('RATE_LIMITED');
    expect(error.retryAfter).toBe(17);
  });

  it('never shows a 5xx server message to the user', async () => {
    stubFetch(
      new Response(JSON.stringify({ error: 'relation "bookings" does not exist' }), {
        status: 500,
      }),
    );
    const error = await captureError(fetchJson('/api/x'));
    expect(toUserMessage(error)).toBe('Something went wrong on our side. Try again.');
  });

  it('does not promote a legacy 5xx { error } string (raw DB text) to HttpError.message', async () => {
    const pgText = 'duplicate key value violates unique constraint "booking_tables_pkey"';
    stubFetch(
      new Response(JSON.stringify({ error: pgText, code: 'ASSIGNMENT_REPOSITORY_ERROR' }), {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const error = (await captureError(fetchJson('/api/ops/bookings/b1/tables'))) as HttpError;
    expect(error).toBeInstanceOf(HttpError);
    expect(error.status).toBe(503);
    expect(error.code).toBe('ASSIGNMENT_REPOSITORY_ERROR');
    expect(error.message).not.toContain('duplicate key');
    expect(error.message).toBe('Service Unavailable');
    expect(error.hasServerMessage).toBe(false);
  });

  it('lets a network failure propagate as a recognisable TypeError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );
    const error = await captureError(fetchJson('/api/x'));
    expect(toUserMessage(error)).toBe(
      "Couldn't reach the server. Check your connection and try again.",
    );
  });
});
