import { describe, expect, it, vi } from 'vitest';

import { normalizePhone, upsertCustomer } from '@/server/customers';

import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database>;

function createLookupClient(existing: {
  id: string;
  restaurant_id: string;
  email: string | null;
  phone: string | null;
  full_name: string | null;
  marketing_opt_in: boolean | null;
  created_at: string;
  updated_at: string;
  email_normalized: string | null;
  phone_normalized: string | null;
  auth_user_id: string | null;
  user_profile_id: string | null;
  notes: string | null;
}) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: existing, error: null });
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    or: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    maybeSingle,
  };
  const from = vi.fn(() => builder);

  return { client: { from } as unknown as DbClient, spies: { from, ...builder } };
}

describe('server/customers', () => {
  it('normalizes equivalent UK phone formats to the same canonical digits', () => {
    expect(normalizePhone('07950 272147')).toBe('447950272147');
    expect(normalizePhone('+447950272147')).toBe('447950272147');
    expect(normalizePhone('447950272147')).toBe('447950272147');
  });

  it('falls back to digits-only normalization for non-UK values', () => {
    expect(normalizePhone('+1 (650) 555-1234')).toBe('16505551234');
  });

  it('reuses an existing customer when the request uses a UK equivalent phone format', async () => {
    const existing = {
      id: 'customer-1',
      restaurant_id: 'rest-1',
      email: null,
      phone: '+447950272147',
      full_name: 'Alex Guest',
      marketing_opt_in: false,
      created_at: '2026-04-01T15:00:00Z',
      updated_at: '2026-04-01T15:00:00Z',
      email_normalized: null,
      phone_normalized: '447950272147',
      auth_user_id: null,
      user_profile_id: null,
      notes: null,
    };

    const { client, spies } = createLookupClient(existing);

    const customer = await upsertCustomer(client, {
      restaurantId: 'rest-1',
      email: null,
      phone: '07950 272147',
      name: 'Alex Guest',
      marketingOptIn: false,
    });

    expect(customer).toEqual(existing);
    expect(spies.from).toHaveBeenCalledWith('customers');
    expect(spies.eq).toHaveBeenCalledWith('restaurant_id', 'rest-1');
    expect(spies.or).toHaveBeenCalledWith('phone_normalized.eq."447950272147"');
  });

  it('does not reuse or overwrite a customer when only one submitted contact matches', async () => {
    const victim = {
      id: 'customer-1',
      restaurant_id: 'rest-1',
      email: 'victim@example.com',
      phone: '+447950272147',
      full_name: 'Victim Guest',
      marketing_opt_in: false,
      created_at: '2026-04-01T15:00:00Z',
      updated_at: '2026-04-01T15:00:00Z',
      email_normalized: 'victim@example.com',
      phone_normalized: '447950272147',
      auth_user_id: 'auth-user-1',
      user_profile_id: 'profile-1',
      notes: null,
    };
    const inserted = {
      ...victim,
      id: 'customer-2',
      phone: '+447000000000',
      phone_normalized: '447000000000',
      auth_user_id: null,
      user_profile_id: null,
    };

    const lookupMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const insertSingle = vi.fn().mockResolvedValue({ data: inserted, error: null });
    const insertSelect = vi.fn(() => ({ single: insertSingle }));
    const insert = vi.fn(() => ({ select: insertSelect }));
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      order: vi.fn(() => builder),
      limit: vi.fn(() => builder),
      maybeSingle: lookupMaybeSingle,
      insert,
    };
    const from = vi.fn(() => builder);

    const customer = await upsertCustomer({ from } as unknown as DbClient, {
      restaurantId: 'rest-1',
      email: 'victim@example.com',
      phone: '07000 000000',
      name: 'Attacker Input',
      marketingOptIn: false,
    });

    expect(customer.id).toBe('customer-2');
    expect(builder.eq).toHaveBeenCalledWith('email_normalized', 'victim@example.com');
    expect(builder.eq).toHaveBeenCalledWith('phone_normalized', '447000000000');
    expect(insert).toHaveBeenCalled();
  });
});
