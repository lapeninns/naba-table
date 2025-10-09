import { NextRequest } from 'next/server';
import { describe, expect, it, beforeEach, vi } from 'vitest';

import { GET, PUT } from '@/app/api/profile/route';
import { ensureProfileRow, normalizeProfileRow } from '@/lib/profile/server';
import { getRouteHandlerSupabaseClient } from '@/server/supabase';

import type { ProfileResponse } from '@/lib/profile/schema';

type RouteClient = Awaited<ReturnType<typeof getRouteHandlerSupabaseClient>>;
type ProfileRowInput = Parameters<typeof normalizeProfileRow>[0];

vi.mock('@/server/supabase', () => {
  type MockFn<TResult> = ReturnType<typeof vi.fn<[], TResult>>;
  type DefaultResult = { data: null; error: null };
  type InsertSelect = { maybeSingle: MockFn<Promise<DefaultResult>> };
  type UpsertSelect = {
    single: MockFn<Promise<DefaultResult>>;
    maybeSingle: MockFn<Promise<DefaultResult>>;
  };
  type QueryBuilder = {
    select: MockFn<QueryBuilder>;
    eq: MockFn<QueryBuilder>;
    order: MockFn<QueryBuilder>;
    maybeSingle: MockFn<Promise<DefaultResult>>;
    insert: MockFn<{ select: MockFn<InsertSelect> }>;
    upsert: MockFn<{ select: MockFn<UpsertSelect> }>;
  };

  const createQueryBuilder = () => {
    const resolve = (): Promise<DefaultResult> => Promise.resolve({ data: null, error: null });

    const select = vi.fn<[], QueryBuilder>();
    const eq = vi.fn<[], QueryBuilder>();
    const order = vi.fn<[], QueryBuilder>();
    const maybeSingle = vi.fn<[], Promise<DefaultResult>>();
    const insert = vi.fn<[], { select: MockFn<InsertSelect> }>();
    const upsert = vi.fn<[], { select: MockFn<UpsertSelect> }>();

    const builder: QueryBuilder = {
      select,
      eq,
      order,
      maybeSingle,
      insert,
      upsert,
    };

    select.mockImplementation(() => builder);
    eq.mockImplementation(() => builder);
    order.mockImplementation(() => builder);
    maybeSingle.mockImplementation(resolve);

    insert.mockImplementation(() => {
      const innerMaybeSingle = vi.fn<[], Promise<DefaultResult>>(resolve);
      const insertSelect = vi.fn<[], InsertSelect>(() => ({ maybeSingle: innerMaybeSingle }));
      return { select: insertSelect };
    });

    upsert.mockImplementation(() => {
      const innerSingle = vi.fn<[], Promise<DefaultResult>>(resolve);
      const innerMaybe = vi.fn<[], Promise<DefaultResult>>(resolve);
      const upsertSelect = vi.fn<[], UpsertSelect>(() => ({
        single: innerSingle,
        maybeSingle: innerMaybe,
      }));
      return { select: upsertSelect };
    });

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
    getUser: vi
      .fn<
        [],
        Promise<{ data: { user: { id: string; email: string | null } | null }; error: null }>
      >()
      .mockResolvedValue({ data: { user }, error: null }),
  };

  const updateSingle = vi.fn<[], Promise<UpdateResponse>>().mockResolvedValue(response);
  const updateSelect = vi.fn<[], { single: typeof updateSingle }>().mockReturnValue({
    single: updateSingle,
  });
  const updateEq = vi
    .fn<[string, string], { select: typeof updateSelect }>()
    .mockReturnValue({ select: updateSelect });
  const update = vi
    .fn<[Partial<ProfileRowInput>], { eq: typeof updateEq }>()
    .mockReturnValue({ eq: updateEq });

  const from = vi.fn<[string], { update: typeof update }>().mockReturnValue({ update });

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
