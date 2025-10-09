import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ensureProfileRow } from '@/lib/profile/server';
import { getServiceSupabaseClient } from '@/server/supabase';

import type { Database } from '@/types/supabase';
import type { SupabaseClient, User } from '@supabase/supabase-js';

vi.mock('@/server/supabase', () => {
  return {
    getServiceSupabaseClient: vi.fn(),
  };
});

type ProfilesTableRow = Database['public']['Tables']['profiles']['Row'];

const serviceFrom = vi.fn();
const serviceClient = { from: serviceFrom } as unknown as SupabaseClient<Database>;

function mockCustomerContact(contact: { full_name?: string | null; phone?: string | null }) {
  const records = [
    {
      full_name: contact.full_name ?? null,
      phone: contact.phone ?? null,
      updated_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    },
  ];

  type MockFn<TResult, TArgs extends unknown[] = []> = ReturnType<typeof vi.fn<TArgs, TResult>>;
  type CustomerQueryResult = { data: typeof records; error: null };
  type CustomerQueryBuilder = {
    select: MockFn<CustomerQueryBuilder>;
    eq: MockFn<CustomerQueryBuilder>;
    order: MockFn<CustomerQueryBuilder>;
    limit: MockFn<Promise<CustomerQueryResult>, [number]>;
  };

  const select = vi.fn<[], CustomerQueryBuilder>();
  const eq = vi.fn<[], CustomerQueryBuilder>();
  const order = vi.fn<[], CustomerQueryBuilder>();
  const limit = vi.fn<[number], Promise<CustomerQueryResult>>();

  const queryBuilder: CustomerQueryBuilder = {
    select,
    eq,
    order,
    limit,
  };

  select.mockImplementation(() => queryBuilder);
  eq.mockImplementation(() => queryBuilder);
  order.mockImplementation(() => queryBuilder);
  limit.mockResolvedValue({ data: records, error: null });

  serviceFrom.mockReturnValue(queryBuilder);
  return queryBuilder;
}

function createUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'ada@example.com',
    email_confirmed_at: new Date().toISOString(),
    phone: '',
    confirmed_at: new Date().toISOString(),
    last_sign_in_at: new Date().toISOString(),
    app_metadata: {},
    user_metadata: {},
    identities: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('ensureProfileRow', () => {
  beforeEach(() => {
    serviceFrom.mockReset();
    vi.mocked(getServiceSupabaseClient).mockReturnValue(serviceClient);
  });

  it('hydrates new profiles with customer contact details when metadata is missing', async () => {
    mockCustomerContact({ full_name: 'Ada Example', phone: '+44 1234 567890' });

    const maybeSingle = vi
      .fn<[], Promise<{ data: null; error: null }>>()
      .mockResolvedValue({ data: null, error: null });
    const eq = vi.fn<[string, string], { maybeSingle: typeof maybeSingle }>().mockReturnValue({
      maybeSingle,
    });
    const select = vi.fn<[], { eq: typeof eq }>().mockReturnValue({ eq });

    const insertedRow: ProfilesTableRow = {
      id: 'user-1',
      email: 'ada@example.com',
      name: 'Ada Example',
      phone: '+44 1234 567890',
      image: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const upsertSingle = vi
      .fn<[], Promise<{ data: ProfilesTableRow | null; error: null }>>()
      .mockResolvedValue({ data: insertedRow, error: null });
    const upsertSelect = vi.fn<[], { single: typeof upsertSingle }>().mockReturnValue({
      single: upsertSingle,
    });
    const upsert = vi.fn<[], { select: typeof upsertSelect }>().mockReturnValue({
      select: upsertSelect,
    });

    const from = vi.fn<[string], { select: typeof select; upsert: typeof upsert }>(
      (table: string) => {
        if (table !== 'profiles') {
          throw new Error(`Unexpected table: ${table}`);
        }
        return { select, upsert };
      },
    );

    const client = { from } as unknown as SupabaseClient<Database, 'public'>;
    const user = createUser();

    const result = await ensureProfileRow(client, user);

    expect(result).toEqual(insertedRow);
    expect(maybeSingle).toHaveBeenCalled();
    expect(upsert).toHaveBeenCalledTimes(1);
    const upsertPayload = upsert.mock.calls[0]?.[0] ?? {};
    expect(upsertPayload).toMatchObject({
      id: 'user-1',
      name: 'Ada Example',
      phone: '+44 1234 567890',
    });
    expect(serviceFrom).toHaveBeenCalledWith('customers');
  });

  it('patches existing profiles missing contact details', async () => {
    mockCustomerContact({ full_name: 'Ada Example', phone: '+44 7777 888999' });

    const existingRow: ProfilesTableRow = {
      id: 'user-1',
      email: 'ada@example.com',
      name: null,
      phone: null,
      image: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const maybeSingle = vi
      .fn<[], Promise<{ data: ProfilesTableRow | null; error: null }>>()
      .mockResolvedValue({ data: existingRow, error: null });
    const eqSelect = vi
      .fn<[string, string], { maybeSingle: typeof maybeSingle }>()
      .mockReturnValue({
        maybeSingle,
      });
    const select = vi.fn<[], { eq: typeof eqSelect }>().mockReturnValue({
      eq: eqSelect,
    });

    const patchedRow: ProfilesTableRow = {
      ...existingRow,
      name: 'Ada Example',
      phone: '+44 7777 888999',
      updated_at: new Date().toISOString(),
    };

    const updateSingle = vi
      .fn<[], Promise<{ data: ProfilesTableRow | null; error: null }>>()
      .mockResolvedValue({ data: patchedRow, error: null });
    const updateSelect = vi.fn<[], { single: typeof updateSingle }>().mockReturnValue({
      single: updateSingle,
    });
    const updateEq = vi.fn<[string, string], { select: typeof updateSelect }>().mockReturnValue({
      select: updateSelect,
    });
    const update = vi.fn<[Partial<ProfilesTableRow>], { eq: typeof updateEq }>().mockReturnValue({
      eq: updateEq,
    });

    const from = vi.fn<[string], { select: typeof select; update: typeof update }>(
      (table: string) => {
        if (table !== 'profiles') {
          throw new Error(`Unexpected table: ${table}`);
        }
        return { select, update };
      },
    );

    const client = { from } as unknown as SupabaseClient<Database, 'public'>;
    const user = createUser();

    const result = await ensureProfileRow(client, user);

    expect(result).toEqual(patchedRow);
    expect(update).toHaveBeenCalledTimes(1);
    const updatePayload = update.mock.calls[0]?.[0] ?? {};
    expect(updatePayload).toMatchObject({
      name: 'Ada Example',
      phone: '+44 7777 888999',
    });
    expect(typeof updatePayload.updated_at).toBe('string');
    expect(serviceFrom).toHaveBeenCalledWith('customers');
  });
});
