import { NextRequest } from 'next/server';
import { describe, expect, it, beforeEach, vi } from 'vitest';

import { GET, PUT } from '@/app/api/profile/route';
import { ensureProfileRow, normalizeProfileRow } from '@/lib/profile/server';
import { getRouteHandlerSupabaseClient } from '@/server/supabase';

import type { ProfileResponse } from '@/lib/profile/schema';

type RouteClient = Awaited<ReturnType<typeof getRouteHandlerSupabaseClient>>;
type ProfileRowInput = Parameters<typeof normalizeProfileRow>[0];

vi.mock('@/server/supabase', () => ({
  getRouteHandlerSupabaseClient: vi.fn(),
}));

vi.mock('@/lib/profile/server', () => ({
  ensureProfileRow: vi.fn(),
  normalizeProfileRow: vi.fn(),
  PROFILE_COLUMNS: 'id,name,email,phone,image,created_at,updated_at',
}));

type MockedClient = {
  auth: {
    getUser: ReturnType<typeof vi.fn>;
  };
  from: ReturnType<typeof vi.fn>;
};

function createSupabaseClientMock({
  user,
  updateResult,
}: {
  user: { id: string; email: string | null } | null;
  updateResult?:
    | { data: ProfileRowInput; error: null }
    | { data: null; error: { code: string; message: string } };
}): MockedClient {
  const auth = {
    getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
  };

  const updateSingle = vi.fn().mockResolvedValue(updateResult ?? { data: null, error: null });
  const updateSelect = vi.fn(() => ({ single: updateSingle }));
  const updateEq = vi.fn(() => ({ select: updateSelect }));
  const update = vi.fn(() => ({ eq: updateEq }));

  const from = vi.fn(() => ({ update }));

  return { auth, from };
}

async function readJson(response: Response) {
  const text = await response.text();
  return text ? JSON.parse(text) : {};
}

function makeProfileRow(overrides: Partial<ProfileRowInput> = {}): ProfileRowInput {
  const now = new Date().toISOString();
  return {
    id: 'user-1',
    name: 'Ada',
    email: 'ada@example.com',
    phone: '+14155550100',
    image: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

describe('app/api/profile/route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when user is unauthenticated (GET)', async () => {
    const client = createSupabaseClientMock({ user: null });
    vi.mocked(getRouteHandlerSupabaseClient).mockResolvedValue(client as unknown as RouteClient);

    const response = await GET();
    expect(response.status).toBe(401);
    const json = await readJson(response);
    expect(json.code).toBe('UNAUTHENTICATED');
  });

  it('returns profile when authenticated (GET)', async () => {
    const client = createSupabaseClientMock({ user: { id: 'user-1', email: 'ada@example.com' } });
    vi.mocked(getRouteHandlerSupabaseClient).mockResolvedValue(client as unknown as RouteClient);

    const profile: ProfileResponse = {
      id: 'user-1',
      email: 'ada@example.com',
      name: 'Ada Lovelace',
      phone: '+14155550100',
      image: 'https://example.com/avatar.png',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    vi.mocked(ensureProfileRow).mockResolvedValue(makeProfileRow());
    vi.mocked(normalizeProfileRow).mockReturnValue(profile);

    const response = await GET();
    expect(response.status).toBe(200);
    const json = await readJson(response);
    expect(json).toMatchObject({ profile });
    expect(ensureProfileRow).toHaveBeenCalled();
  });

  it('rejects email change attempts (PUT)', async () => {
    const client = createSupabaseClientMock({ user: { id: 'user-1', email: 'ada@example.com' } });
    vi.mocked(getRouteHandlerSupabaseClient).mockResolvedValue(client as unknown as RouteClient);
    vi.mocked(ensureProfileRow).mockResolvedValue(makeProfileRow());
    vi.mocked(normalizeProfileRow).mockReturnValue({
      id: 'user-1',
      email: 'ada@example.com',
      name: 'Ada',
      phone: '+14155550100',
      image: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const req = new NextRequest('http://localhost/api/profile', {
      method: 'PUT',
      body: JSON.stringify({ email: 'new@example.com' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await PUT(req);
    expect(response.status).toBe(400);
    const json = await readJson(response);
    expect(json.code).toBe('EMAIL_IMMUTABLE');
  });

  it('updates profile successfully (PUT)', async () => {
    const updateResult: { data: ProfileRowInput; error: null } = {
      data: makeProfileRow(),
      error: null,
    };
    const client = createSupabaseClientMock({
      user: { id: 'user-1', email: 'ada@example.com' },
      updateResult,
    });
    vi.mocked(getRouteHandlerSupabaseClient).mockResolvedValue(client as unknown as RouteClient);

    vi.mocked(ensureProfileRow).mockResolvedValue(makeProfileRow());

    const updatedProfile: ProfileResponse = {
      id: 'user-1',
      email: 'ada@example.com',
      name: 'Ada Lovelace',
      phone: '+14155550100',
      image: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    vi.mocked(normalizeProfileRow).mockReturnValue(updatedProfile);

    const req = new NextRequest('http://localhost/api/profile', {
      method: 'PUT',
      body: JSON.stringify({ name: 'Ada Lovelace', phone: '+1 415 555 0100' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await PUT(req);
    expect(response.status).toBe(200);
    const json = await readJson(response);
    expect(json).toMatchObject({ profile: updatedProfile });
    expect(client.from).toHaveBeenCalledWith('profiles');
    const updateCallArgs = client.from.mock.results[0]?.value.update.mock.calls[0][0];
    expect(updateCallArgs).toMatchObject({ name: 'Ada Lovelace', phone: '+1 415 555 0100' });
  });
});
