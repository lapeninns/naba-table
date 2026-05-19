import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ensureProfileRowMock = vi.hoisted(() => vi.fn());
const normalizeProfileRowMock = vi.hoisted(() =>
  vi.fn((row: Record<string, unknown>, fallbackEmail: string | null) => ({
    id: row.id,
    email: row.email ?? fallbackEmail,
    name: row.name ?? null,
    phone: row.phone ?? null,
    image: row.image ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  })),
);
const getUserMock = vi.hoisted(() => vi.fn());
const getRouteHandlerSupabaseClientMock = vi.hoisted(() => vi.fn());
const getServiceSupabaseClientMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/profile/server', () => ({
  ensureProfileRow: ensureProfileRowMock,
  normalizeProfileRow: normalizeProfileRowMock,
}));

vi.mock('@/server/supabase', () => ({
  getRouteHandlerSupabaseClient: getRouteHandlerSupabaseClientMock,
  getServiceSupabaseClient: getServiceSupabaseClientMock,
}));

import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from '@/lib/security/csrf';
import { GET, PUT } from '@/src/app/api/profile/route';

const USER = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'guest@example.com',
};
const CSRF_TOKEN = 'guest-profile-csrf-token';

function makeProfile(overrides: Record<string, unknown> = {}) {
  return {
    id: USER.id,
    email: USER.email,
    name: 'Alex Guest',
    phone: '+447700900123',
    image: 'https://cdn.example.test/avatar.png',
    created_at: '2026-05-16T10:00:00.000Z',
    updated_at: '2026-05-16T10:00:00.000Z',
    ...overrides,
  };
}

function csrfHeaders(): Headers {
  return new Headers({
    'content-type': 'application/json',
    [CSRF_HEADER_NAME]: CSRF_TOKEN,
    cookie: `${CSRF_COOKIE_NAME}=${CSRF_TOKEN}`,
  });
}

function putRequest(body: unknown) {
  return new NextRequest('https://www.nabatable.com/api/profile', {
    method: 'PUT',
    headers: csrfHeaders(),
    body: JSON.stringify(body),
  });
}

function installAuthUser(user: typeof USER | null = USER, error: unknown = null) {
  getUserMock.mockResolvedValue({ data: { user }, error });
  getRouteHandlerSupabaseClientMock.mockResolvedValue({
    auth: { getUser: getUserMock },
  });
}

describe('guest profile route', () => {
  beforeEach(() => {
    ensureProfileRowMock.mockReset();
    ensureProfileRowMock.mockResolvedValue(makeProfile());
    normalizeProfileRowMock.mockClear();
    getUserMock.mockReset();
    getRouteHandlerSupabaseClientMock.mockReset();
    getServiceSupabaseClientMock.mockReset();
    installAuthUser();
  });

  it('returns the authenticated guest profile @p0 @api @contract', async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      profile: {
        id: USER.id,
        email: USER.email,
        name: 'Alex Guest',
        phone: '+447700900123',
        image: 'https://cdn.example.test/avatar.png',
        createdAt: '2026-05-16T10:00:00.000Z',
        updatedAt: '2026-05-16T10:00:00.000Z',
      },
    });
    expect(ensureProfileRowMock).toHaveBeenCalledWith(expect.anything(), USER);
  });

  it('maps invalid guest auth to 401 instead of a server error @p0 @api @security', async () => {
    installAuthUser(null, {
      status: 401,
      message: 'invalid jwt',
    });
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      const response = await GET();
      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body).toEqual({
        code: 'UNAUTHENTICATED',
        message: 'Authentication required',
      });
      expect(ensureProfileRowMock).not.toHaveBeenCalled();
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it('rejects unauthenticated profile reads @p0 @api @security', async () => {
    installAuthUser(null);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.code).toBe('UNAUTHENTICATED');
    expect(ensureProfileRowMock).not.toHaveBeenCalled();
  });

  it('rejects attempts to mutate immutable email before profile update @p0 @api @security', async () => {
    const response = await PUT(putRequest({ email: 'other@example.com', name: 'Alex Guest' }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe('EMAIL_IMMUTABLE');
    expect(ensureProfileRowMock).not.toHaveBeenCalled();
    expect(getServiceSupabaseClientMock).not.toHaveBeenCalled();
  });

  it('rejects invalid reversible profile fields before profile update @p0 @api @contract', async () => {
    const response = await PUT(putRequest({ phone: 'abc' }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe('INVALID_PROFILE');
    expect(body.details.fieldErrors.phone).toEqual([
      'Phone can only include digits, spaces, +, -, and parentheses',
      'Phone must include between 7 and 20 digits',
    ]);
    expect(ensureProfileRowMock).not.toHaveBeenCalled();
    expect(getServiceSupabaseClientMock).not.toHaveBeenCalled();
  });
});
