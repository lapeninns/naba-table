import { beforeEach, describe, expect, it, vi } from 'vitest';

const getServerComponentSupabaseClientMock = vi.hoisted(() => vi.fn());
const getUserMock = vi.hoisted(() => vi.fn());
// Stand-in for React's per-request `cache()` (a passthrough outside a React
// Server Components render). Memoise so the test can assert that repeated
// calls within one "request" share a single Supabase `getUser()` round trip.
// A plain function (not vi.fn) so the global `clearMocks` does not wipe the
// record of the module-load-time wrap before the test runs.
const cacheState = vi.hoisted(() => ({ wrapCount: 0 }));
const cacheMock = vi.hoisted(
  () =>
    <Args extends unknown[], Result>(fn: (...args: Args) => Result) => {
      cacheState.wrapCount += 1;
      let memo: { value: Result } | null = null;
      return (...args: Args): Result => {
        if (!memo) memo = { value: fn(...args) };
        return memo.value;
      };
    },
);

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof React>();
  return { ...actual, cache: cacheMock };
});

vi.mock('@/server/supabase', () => ({
  getServerComponentSupabaseClient: getServerComponentSupabaseClientMock,
}));

import { getRequestUser } from '@/server/auth/request-user';

import type * as React from 'react';

const USER_ID = '22222222-2222-4222-8222-222222222222';

describe('getRequestUser', () => {
  beforeEach(() => {
    getUserMock.mockReset();
    getServerComponentSupabaseClientMock.mockReset();
    getServerComponentSupabaseClientMock.mockResolvedValue({ auth: { getUser: getUserMock } });
  });

  it('is wrapped in React cache() so layouts share one getUser per request', async () => {
    expect(cacheState.wrapCount).toBe(1);
    getUserMock.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });

    const [first, second] = await Promise.all([getRequestUser(), getRequestUser()]);

    expect(first.user?.id).toBe(USER_ID);
    expect(second).toBe(first);
    expect(getUserMock).toHaveBeenCalledTimes(1);
  });
});

describe('getRequestUser (uncached call shape)', () => {
  it('returns a null user with the auth error instead of throwing', async () => {
    vi.resetModules();
    getServerComponentSupabaseClientMock.mockResolvedValue({ auth: { getUser: getUserMock } });
    getUserMock.mockResolvedValue({
      data: { user: null },
      error: { message: 'Auth session missing!' },
    });
    const { getRequestUser: freshGetRequestUser } = await import('@/server/auth/request-user');

    const result = await freshGetRequestUser();

    expect(result.user).toBeNull();
    expect(result.error?.message).toBe('Auth session missing!');
  });
});
