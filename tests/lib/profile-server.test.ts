import { beforeEach, describe, expect, it, vi } from 'vitest';

const getServiceSupabaseClientMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/supabase', () => ({
  getServiceSupabaseClient: getServiceSupabaseClientMock,
}));

vi.mock('@/server/customers', () => ({
  normalizeEmail: vi.fn((value: string) => value.trim().toLowerCase()),
}));

import { ensureProfileRow } from '@/lib/profile/server';

import type { Database } from '@/types/supabase';
import type { SupabaseClient, User } from '@supabase/supabase-js';

type ProfileRecord = Pick<
  Database['public']['Tables']['profiles']['Row'],
  'id' | 'name' | 'email' | 'phone' | 'image' | 'created_at' | 'updated_at'
>;

const USER_ID = 'user-1';

function makeUser(): User {
  return {
    id: USER_ID,
    email: 'Guest@Example.com',
    user_metadata: {},
  } as User;
}

function makeProfile(overrides: Partial<ProfileRecord> = {}): ProfileRecord {
  return {
    id: USER_ID,
    email: 'guest@example.com',
    name: null,
    phone: '',
    image: null,
    created_at: '2026-05-16T10:00:00.000Z',
    updated_at: '2026-05-16T10:05:00.000Z',
    ...overrides,
  };
}

function makeCustomerService() {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    or: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(async () => ({
      data: [
        {
          full_name: 'Hydrated Guest',
          phone: '07123 456789',
          updated_at: '2026-05-16T10:10:00.000Z',
          created_at: '2026-05-16T10:00:00.000Z',
          auth_user_id: USER_ID,
          user_profile_id: null,
        },
      ],
      error: null,
    })),
  };

  return {
    service: {
      from: vi.fn(() => chain),
    },
    chain,
  };
}

function makeProfileClient(args: { existing: ProfileRecord; updated?: ProfileRecord | null }) {
  const initialSelectChain = {
    eq: vi.fn(() => initialSelectChain),
    maybeSingle: vi.fn(async () => ({ data: args.existing, error: null })),
  };
  const updateChain = {
    eq: vi.fn(() => updateChain),
    is: vi.fn(() => updateChain),
    select: vi.fn(() => updateChain),
    maybeSingle: vi.fn(async () => ({ data: args.updated ?? null, error: null })),
  };
  const table = {
    select: vi.fn(() => initialSelectChain),
    update: vi.fn(() => updateChain),
  };
  const client = {
    from: vi.fn(() => table),
  };

  return {
    client: client as unknown as SupabaseClient<Database>,
    table,
    updateChain,
  };
}

describe('ensureProfileRow', () => {
  beforeEach(() => {
    getServiceSupabaseClientMock.mockReset();
  });

  it('hydrates missing fields only while the same blank values are still present', async () => {
    const customerService = makeCustomerService();
    getServiceSupabaseClientMock.mockReturnValue(customerService.service);
    const existing = makeProfile();
    const updated = makeProfile({
      name: 'Hydrated Guest',
      phone: '07123 456789',
      updated_at: '2026-05-16T10:15:00.000Z',
    });
    const { client, table, updateChain } = makeProfileClient({ existing, updated });

    const row = await ensureProfileRow(client, makeUser());

    expect(row).toEqual(updated);
    expect(table.update).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Hydrated Guest',
        phone: '07123 456789',
        updated_at: expect.any(String),
      }),
    );
    expect(updateChain.eq).toHaveBeenCalledWith('id', USER_ID);
    expect(updateChain.eq).toHaveBeenCalledWith('updated_at', existing.updated_at);
    expect(updateChain.is).toHaveBeenCalledWith('name', null);
    expect(updateChain.eq).toHaveBeenCalledWith('phone', '');
  });

  it('uses authenticated user metadata to hydrate an existing blank profile name', async () => {
    const customerService = makeCustomerService();
    getServiceSupabaseClientMock.mockReturnValue(customerService.service);
    customerService.chain.limit.mockResolvedValueOnce({ data: [], error: null });
    const existing = makeProfile({ phone: '07123 456789' });
    const updated = makeProfile({
      name: 'Submitted Invitee',
      phone: '07123 456789',
      updated_at: '2026-05-16T10:15:00.000Z',
    });
    const { client, table } = makeProfileClient({ existing, updated });

    const row = await ensureProfileRow(client, {
      ...makeUser(),
      user_metadata: { name: 'Submitted Invitee' },
    } as User);

    expect(row).toEqual(updated);
    expect(table.update).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Submitted Invitee',
        updated_at: expect.any(String),
      }),
    );
  });

  it('returns the original row when the guarded hydration update no longer matches', async () => {
    const customerService = makeCustomerService();
    getServiceSupabaseClientMock.mockReturnValue(customerService.service);
    const existing = makeProfile();
    const { client } = makeProfileClient({ existing, updated: null });

    const row = await ensureProfileRow(client, makeUser());

    expect(row).toEqual(existing);
  });
});
