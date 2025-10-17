import { NextRequest } from 'next/server';
import { describe, expect, it, beforeEach, vi } from 'vitest';

import { GET, PUT } from '@/app/api/profile/route';
import { ensureProfileRow, normalizeProfileRow } from '@/lib/profile/server';
import { getRouteHandlerSupabaseClient } from '@/server/supabase';

import type { ProfileResponse } from '@/lib/profile/schema';

type RouteClient = Awaited<ReturnType<typeof getRouteHandlerSupabaseClient>>;
type ProfileRowInput = Parameters<typeof normalizeProfileRow>[0];

vi.mock('@/server/supabase', () => {
  type DefaultResult = { data: null; error: null };
  type InsertResponse = { maybeSingle: () => Promise<DefaultResult> };
  type UpsertResponse = {
    single: () => Promise<DefaultResult>;
    maybeSingle: () => Promise<DefaultResult>;
  };
  type QueryBuilder = {
    select: () => QueryBuilder;
    eq: () => QueryBuilder;
    order: () => QueryBuilder;
    maybeSingle: () => Promise<DefaultResult>;
    insert: () => { select: () => InsertResponse };
    upsert: () => { select: () => UpsertResponse };
  };

  const resolve = async (): Promise<DefaultResult> => ({ data: null, error: null });

  const createQueryBuilder = (): QueryBuilder => {
    const builder: QueryBuilder = {
      select: () => builder,
      eq: () => builder,
      order: () => builder,
      maybeSingle: resolve,
      insert: () => ({
        select: () => ({
          maybeSingle: resolve,
        }),
      }),
      upsert: () => ({
        select: () => ({
          single: resolve,
          maybeSingle: resolve,
        }),
      }),
    };

    builder.select = vi.fn(builder.select) as QueryBuilder['select'];
    builder.eq = vi.fn(builder.eq) as QueryBuilder['eq'];
    builder.order = vi.fn(builder.order) as QueryBuilder['order'];
    builder.maybeSingle = vi.fn(builder.maybeSingle) as QueryBuilder['maybeSingle'];
    builder.insert = vi.fn(builder.insert) as QueryBuilder['insert'];
    builder.upsert = vi.fn(builder.upsert) as QueryBuilder['upsert'];

    return builder;
  };

  const serviceClient = { from: vi.fn(() => createQueryBuilder()) };

  return {
    getRouteHandlerSupabaseClient: vi.fn(),
    getServiceSupabaseClient: vi.fn(() => serviceClient),
  };
});

vi.mock('@/lib/profile/server', () => ({
  ensureProfileRow: vi.fn(),
  normalizeProfileRow: vi.fn(),
  PROFILE_COLUMNS: 'id,name,email,phone,image,created_at,updated_at',
}));

type SupabaseError = { code: string; message: string };
type UpdateResponse = { data: ProfileRowInput | null; error: SupabaseError | null };

function createSupabaseClientMock({
  user,
  updateResult,
}: {
  user: { id: string; email: string | null } | null;
  updateResult?: UpdateResponse;
}) {
  const response = updateResult ?? { data: null, error: null };

  const auth = {
    getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
  };

  const updateSingle = vi.fn(async () => response);
  const updateSelect = vi.fn(() => ({
    single: updateSingle,
  }));
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
    has_access: true,
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
    const fromMock = client.from as unknown as ReturnType<typeof vi.fn>;
    const updateMock = fromMock.mock.results[0]?.value.update as ReturnType<typeof vi.fn>;
    const updateCallArgs = updateMock.mock.calls[0][0];
    expect(updateCallArgs).toMatchObject({ name: 'Ada Lovelace', phone: '+1 415 555 0100' });
  });
});
