import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchJson } from '@/lib/http/fetchJson';

import type { HttpError } from '@/lib/http/errors';

type FetchMock = ReturnType<typeof vi.fn>;

const originalFetch = global.fetch;

describe('fetchJson', () => {
  let fetchSpy: FetchMock;

  beforeEach(() => {
    fetchSpy = vi.fn();
    // @ts-expect-error override for tests
    global.fetch = fetchSpy;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    global.fetch = originalFetch;
  });

  it('returns parsed JSON on success and defaults credentials to include', async () => {
    const payload = { hello: 'world' };
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }),
    );

    const result = await fetchJson<typeof payload>('/api/example');

    expect(result).toEqual(payload);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [, init] = fetchSpy.mock.calls[0];
    expect(init?.credentials).toBe('include');
    const headers = new Headers(init?.headers as HeadersInit);
    expect(headers.get('Accept')).toBe('application/json');
  });

  it('throws HttpError with normalized fields when server returns JSON error body', async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ message: 'Nope', code: 'FORBIDDEN' }), {
        status: 403,
        statusText: 'Forbidden',
        headers: {
          'Content-Type': 'application/json',
        },
      }),
    );

    await expect(fetchJson('/api/example')).rejects.toMatchObject<HttpError>({
      status: 403,
      code: 'FORBIDDEN',
      message: 'Nope',
    });
  });

  it('falls back to status text when response body is not JSON', async () => {
    fetchSpy.mockResolvedValue(
      new Response('plain text error', {
        status: 500,
        statusText: 'Internal Server Error',
      }),
    );

    await expect(fetchJson('/api/example')).rejects.toMatchObject<HttpError>({
      status: 500,
      code: 'HTTP_500',
      message: 'Internal Server Error',
    });
  });

  it('throws when successful response body is invalid JSON', async () => {
    fetchSpy.mockResolvedValue(
      new Response('not json', {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }),
    );

    await expect(fetchJson('/api/example')).rejects.toMatchObject<HttpError>({
      status: 200,
      code: 'INVALID_JSON',
    });
  });
});
