import { NextRequest } from 'next/server';
import { readFileSync } from 'node:fs';
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
const getRouteHandlerSupabaseClientMock = vi.hoisted(() => vi.fn());
const getServiceSupabaseClientMock = vi.hoisted(() => vi.fn());
const loggerMock = vi.hoisted(() => ({
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
}));

vi.mock('@/lib/logger', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@/lib/logger');
  return { ...actual, logger: loggerMock };
});

vi.mock('@/lib/profile/server', () => ({
  ensureProfileRow: ensureProfileRowMock,
  normalizeProfileRow: normalizeProfileRowMock,
}));

vi.mock('@/server/security/csrf', () => ({
  withCsrfProtectedMutation: (_request: Request, handler: () => Promise<Response>) => handler(),
}));

vi.mock('@/server/supabase', () => ({
  getRouteHandlerSupabaseClient: getRouteHandlerSupabaseClientMock,
  getServiceSupabaseClient: getServiceSupabaseClientMock,
}));

import { PUT } from '@/src/app/api/profile/route';

const USER = { id: '11111111-1111-4111-8111-111111111111', email: 'guest@example.com' };

function makeProfile(overrides: Record<string, unknown> = {}) {
  return {
    id: USER.id,
    email: USER.email,
    name: 'Alex Guest',
    phone: null,
    image: null,
    created_at: '2026-05-16T10:00:00.000Z',
    updated_at: '2026-05-16T10:00:00.000Z',
    ...overrides,
  };
}

function makeRequest(body: unknown, idempotencyKey = 'profile-key-1') {
  return new NextRequest('https://app.nabatable.com/api/profile', {
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
      'idempotency-key': idempotencyKey,
    },
    body: JSON.stringify(body),
  });
}

describe('PUT /api/profile idempotency', () => {
  beforeEach(() => {
    ensureProfileRowMock.mockReset();
    ensureProfileRowMock.mockResolvedValue(makeProfile());
    normalizeProfileRowMock.mockClear();
    getRouteHandlerSupabaseClientMock.mockReset();
    getRouteHandlerSupabaseClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: USER }, error: null }),
      },
    });
    getServiceSupabaseClientMock.mockReset();
    loggerMock.error.mockReset();
    loggerMock.warn.mockReset();
  });

  it('logs an unexpected failure without the submitted name or phone', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    getServiceSupabaseClientMock.mockReturnValue({
      rpc: vi.fn().mockRejectedValue(new Error('socket hang up')),
    });

    try {
      const response = await PUT(makeRequest({ name: 'Secret Person', phone: '+44 7700 900123' }));
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.code).toBe('INTERNAL_ERROR');
      expect(JSON.stringify(body)).not.toContain('socket hang up');
      expect(loggerMock.error).toHaveBeenCalledWith(
        'api.internal_error',
        expect.objectContaining({ route: 'profile.put', fieldNames: ['name', 'phone'] }),
      );
      const logged = JSON.stringify([...loggerMock.error.mock.calls, ...consoleSpy.mock.calls]);
      expect(logged).not.toContain('Secret Person');
      expect(logged).not.toContain('7700');
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it('returns a generic C1 500 when the RPC fails, without database text', async () => {
    getServiceSupabaseClientMock.mockReturnValue({
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { code: 'XX000', message: 'relation profile_update_idempotency leaked' },
      }),
    });

    const response = await PUT(makeRequest({ name: 'Alex Guest' }));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toMatchObject({ code: 'INTERNAL_ERROR', message: expect.any(String) });
    expect(JSON.stringify(body)).not.toContain('leaked');
    expect(JSON.stringify(loggerMock.error.mock.calls)).not.toContain('leaked');
  });

  it('applies profile updates through the atomic RPC', async () => {
    const from = vi.fn();
    const rpc = vi.fn().mockResolvedValue({
      data: [{ status: 'applied', profile: makeProfile({ name: 'Updated Guest' }) }],
      error: null,
    });
    getServiceSupabaseClientMock.mockReturnValue({ rpc, from });

    const response = await PUT(makeRequest({ name: 'Updated Guest' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('Idempotency-Key')).toBe('profile-key-1');
    expect(body).toEqual({
      profile: expect.objectContaining({ id: USER.id, name: 'Updated Guest' }),
      idempotent: false,
    });
    expect(rpc).toHaveBeenCalledWith(
      'apply_profile_update_idempotent',
      expect.objectContaining({
        p_profile_id: USER.id,
        p_idempotency_key: 'profile-key-1',
        p_set_name: true,
        p_name: 'Updated Guest',
        p_set_phone: false,
        p_phone: null,
        p_set_image: false,
        p_image: null,
      }),
    );
    expect(from).not.toHaveBeenCalled();
  });

  it('returns idempotent success for matching replayed requests', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ status: 'idempotent', profile: makeProfile({ name: 'Alex Guest' }) }],
      error: null,
    });
    getServiceSupabaseClientMock.mockReturnValue({ rpc });

    const response = await PUT(makeRequest({ name: 'Alex Guest' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.idempotent).toBe(true);
  });

  it('returns a conflict before applying mismatched idempotency replays', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ status: 'conflict', profile: makeProfile({ name: 'Existing Guest' }) }],
      error: null,
    });
    getServiceSupabaseClientMock.mockReturnValue({ rpc });

    const response = await PUT(makeRequest({ name: 'Different Guest' }));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.code).toBe('IDEMPOTENCY_KEY_CONFLICT');
  });

  it('keeps the migration atomic around idempotency claim and profile update', () => {
    const migration = readFileSync(
      'supabase/migrations/20260516120400_atomic_profile_update_idempotency.sql',
      'utf8',
    );

    expect(migration).toContain(
      'CREATE UNIQUE INDEX IF NOT EXISTS profile_update_requests_profile_id_idempotency_key_idx',
    );
    expect(migration).toContain('ON CONFLICT (profile_id, idempotency_key) DO NOTHING');
    expect(migration).toContain('UPDATE public.profiles');
    expect(migration).toContain('RETURN QUERY SELECT');
    expect(migration).toContain('TO service_role');
  });
});
