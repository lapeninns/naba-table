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

  const queryBuilder: Record<string, unknown> = {};
  queryBuilder.select = vi.fn(() => queryBuilder);
  queryBuilder.eq = vi.fn(() => queryBuilder);
  queryBuilder.order = vi.fn(() => queryBuilder);
  queryBuilder.limit = vi.fn(async (_count: number) => ({ data: records, error: null }));

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

    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null }) as () => Promise<{
      data: null;
      error: null;
    }>;
    const eq = vi.fn().mockReturnValue({ maybeSingle }) as (
      column: string,
      value: string,
    ) => { maybeSingle: typeof maybeSingle };
    const select = vi.fn().mockReturnValue({ eq }) as () => { eq: typeof eq };

    const insertedRow: ProfilesTableRow = {
      id: 'user-1',
      email: 'ada@example.com',
      name: 'Ada Example',
      phone: '+44 1234 567890',
      image: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      has_access: true,
    };

    const upsertSingle = vi
      .fn()
      .mockResolvedValue({ data: insertedRow, error: null }) as () => Promise<{
      data: ProfilesTableRow | null;
      error: null;
    }>;
    const upsertSelect = vi.fn().mockReturnValue({ single: upsertSingle }) as () => {
      single: typeof upsertSingle;
    };
    const upsert = vi.fn().mockReturnValue({ select: upsertSelect }) as () => {
      select: typeof upsertSelect;
    };

    const from = vi.fn((table: string) => {
      if (table !== 'profiles') {
        throw new Error(`Unexpected table: ${table}`);
      }
      return { select, upsert };
    }) as (table: string) => { select: typeof select; upsert: typeof upsert };

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
      has_access: true,
    };

    const maybeSingle = vi
      .fn()
      .mockResolvedValue({ data: existingRow, error: null }) as () => Promise<{
      data: ProfilesTableRow | null;
      error: null;
    }>;
    const eqSelect = vi.fn().mockReturnValue({ maybeSingle }) as (
      column: string,
      value: string,
    ) => { maybeSingle: typeof maybeSingle };
    const select = vi.fn().mockReturnValue({ eq: eqSelect }) as () => { eq: typeof eqSelect };

    const patchedRow: ProfilesTableRow = {
      ...existingRow,
      name: 'Ada Example',
      phone: '+44 7777 888999',
      updated_at: new Date().toISOString(),
      has_access: true,
    };

    const updateSingle = vi
      .fn()
      .mockResolvedValue({ data: patchedRow, error: null }) as () => Promise<{
      data: ProfilesTableRow | null;
      error: null;
    }>;
    const updateSelect = vi.fn().mockReturnValue({ single: updateSingle }) as () => {
      single: typeof updateSingle;
    };
    const updateEq = vi.fn().mockReturnValue({ select: updateSelect }) as (
      column: string,
      value: string,
    ) => { select: typeof updateSelect };
    const update = vi.fn().mockReturnValue({ eq: updateEq }) as (
      payload: Partial<ProfilesTableRow>,
    ) => { eq: typeof updateEq };

    const from = vi.fn((table: string) => {
      if (table !== 'profiles') {
        throw new Error(`Unexpected table: ${table}`);
      }
      return { select, update };
    }) as (table: string) => { select: typeof select; update: typeof update };

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
