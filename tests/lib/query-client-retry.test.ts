import { QueryObserver } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { HttpError } from '@/lib/http/errors';
import { createAppQueryClient } from '@/lib/query/client';

// Fake timers drive the client's real retryDelay, so no delay is overridden here.
async function countRequests(error: unknown): Promise<number> {
  const client = createAppQueryClient();
  const queryFn = vi.fn(() => Promise.reject(error));
  const observer = new QueryObserver(client, { queryKey: ['retry-policy'], queryFn });
  const unsubscribe = observer.subscribe(() => {});
  await vi.runAllTimersAsync();
  expect(observer.getCurrentResult().status).toBe('error');
  unsubscribe();
  client.clear();
  return queryFn.mock.calls.length;
}

function httpError(status: number) {
  return new HttpError({ message: 'Request failed', status });
}

describe('createAppQueryClient retry policy', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([400, 401, 403, 404, 409, 422])('does not retry an HTTP %i', async (status) => {
    expect(await countRequests(httpError(status))).toBe(1);
  });

  it.each([408, 429, 500, 502, 503])('retries an HTTP %i twice', async (status) => {
    expect(await countRequests(httpError(status))).toBe(3);
  });

  it('retries a network failure twice', async () => {
    expect(await countRequests(new TypeError('Failed to fetch'))).toBe(3);
  });

  it('does not retry an unparseable response', async () => {
    const error = new HttpError({ message: 'bad', status: 200, code: 'INVALID_JSON' });
    expect(await countRequests(error)).toBe(1);
  });

  it('does not retry a schema validation error', async () => {
    const result = z.object({ id: z.string() }).safeParse({ id: 1 });
    expect(result.success).toBe(false);
    expect(await countRequests(result.error)).toBe(1);
  });
});
