import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const cookiesMock = vi.hoisted(() => vi.fn());
const headersMock = vi.hoisted(() => vi.fn());
const createServerClientMock = vi.hoisted(() => vi.fn());
const signOutMock = vi.hoisted(() => vi.fn());

vi.mock('next/headers', () => ({
  cookies: cookiesMock,
  headers: headersMock,
}));

vi.mock('@supabase/ssr', () => ({
  createServerClient: createServerClientMock,
}));

vi.mock('@/server/security/events', () => ({
  recordSecurityEvent: vi.fn(),
}));

import { POST } from '@/src/app/api/auth/signout/route';

import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from '@/lib/security/csrf';

const CSRF_TOKEN = 'signout-csrf-token';

type CookieRecord = { name: string; value: string };

function createCookieStore(initial: CookieRecord[] = []) {
  const jar = new Map(initial.map((cookie) => [cookie.name, cookie.value]));
  return {
    getAll: vi.fn(() => Array.from(jar, ([name, value]) => ({ name, value }))),
    set: vi.fn((cookie: CookieRecord & Record<string, unknown>) => {
      jar.set(cookie.name, String(cookie.value));
    }),
    delete: vi.fn((name: string) => {
      jar.delete(name);
    }),
  };
}

function csrfHeaders() {
  return {
    [CSRF_HEADER_NAME]: CSRF_TOKEN,
    cookie: `${CSRF_COOKIE_NAME}=${CSRF_TOKEN}`,
  };
}

function signOutRequest(headers: Record<string, string> = {}) {
  return new NextRequest('https://app.nabatable.com/api/auth/signout', {
    method: 'POST',
    headers,
  });
}

describe('POST /api/auth/signout', () => {
  beforeEach(() => {
    cookiesMock.mockReset();
    headersMock.mockReset();
    createServerClientMock.mockReset();
    signOutMock.mockReset();
    headersMock.mockResolvedValue(new Headers());
    signOutMock.mockResolvedValue({ error: null });
    createServerClientMock.mockReturnValue({ auth: { signOut: signOutMock } });
  });

  it('@api @security rejects sign-out without a CSRF token before touching the session', async () => {
    const response = await POST(signOutRequest());
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.code).toBe('CSRF_INVALID');
    expect(cookiesMock).not.toHaveBeenCalled();
    expect(createServerClientMock).not.toHaveBeenCalled();
    expect(signOutMock).not.toHaveBeenCalled();
  });

  it('@api signs out the session and expires only supabase auth cookies', async () => {
    const store = createCookieStore([
      { name: 'sb-access-token', value: 'jwt-value' },
      { name: 'sb-refresh-token', value: 'refresh-value' },
      { name: 'theme', value: 'dark' },
    ]);
    cookiesMock.mockResolvedValue(store);

    const response = await POST(signOutRequest(csrfHeaders()));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      alreadySignedOut: false,
    });
    expect(signOutMock).toHaveBeenCalledTimes(1);
    for (const name of ['sb-access-token', 'sb-refresh-token']) {
      expect(store.set).toHaveBeenCalledWith(
        expect.objectContaining({ name, value: '', maxAge: 0, expires: new Date(0) }),
      );
      expect(store.delete).toHaveBeenCalledWith(name);
    }
    const expiredNames = store.set.mock.calls.map(([cookie]) => cookie.name);
    expect(expiredNames).not.toContain('theme');
    expect(store.delete).not.toHaveBeenCalledWith('theme');
  });

  it('@api @security creates the sign-out client with the anon key, never the service role', async () => {
    cookiesMock.mockResolvedValue(createCookieStore([{ name: 'sb-access-token', value: 'jwt' }]));

    const response = await POST(signOutRequest(csrfHeaders()));

    expect(response.status).toBe(200);
    expect(createServerClientMock).toHaveBeenCalledTimes(1);
    expect(createServerClientMock).toHaveBeenCalledWith(
      'https://example.supabase.co',
      'test-anon-key',
      expect.objectContaining({ cookies: expect.any(Object) }),
    );
    expect(JSON.stringify(createServerClientMock.mock.calls)).not.toContain(
      'test-service-role-key',
    );
  });

  it('@api treats a missing session as an already-signed-out success', async () => {
    cookiesMock.mockResolvedValue(createCookieStore());
    signOutMock.mockResolvedValue({ error: { message: 'Auth session missing!' } });

    const response = await POST(signOutRequest(csrfHeaders()));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      alreadySignedOut: true,
    });
  });

  it('@api @security does not leak session tokens or sign-out errors in the response', async () => {
    cookiesMock.mockResolvedValue(
      createCookieStore([{ name: 'sb-access-token', value: 'super-secret-jwt' }]),
    );
    signOutMock.mockResolvedValue({
      error: { message: 'invalid JWT: super-secret-jwt' },
    });

    const response = await POST(signOutRequest(csrfHeaders()));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(Object.keys(body).sort()).toEqual(['alreadySignedOut', 'success']);
    expect(body).toEqual({ success: true, alreadySignedOut: false });
    expect(JSON.stringify(body)).not.toContain('super-secret-jwt');
  });
});
