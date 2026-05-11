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
    expect(spies.eq).toHaveBeenCalledWith('phone_normalized', '447950272147');
  });

  it('reuses an existing customer by email without overwriting a conflicting phone', async () => {
    const existing = {
      id: 'customer-1',
      restaurant_id: 'rest-1',
      email: 'guest@example.com',
      phone: '+447950272147',
      full_name: 'Existing Guest',
      marketing_opt_in: false,
      created_at: '2026-04-01T15:00:00Z',
      updated_at: '2026-04-01T15:00:00Z',
      email_normalized: 'guest@example.com',
      phone_normalized: '447950272147',
      auth_user_id: null,
      user_profile_id: null,
      notes: null,
    };

    const maybeSingle = vi.fn().mockResolvedValue({ data: existing, error: null });
    const update = vi.fn();
    const insert = vi.fn();
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      maybeSingle,
      update,
      insert,
    };
    const from = vi.fn(() => builder);

    const customer = await upsertCustomer({ from } as unknown as DbClient, {
      restaurantId: 'rest-1',
      email: 'guest@example.com',
      phone: '07000 000000',
      name: 'Updated Input',
      marketingOptIn: false,
    });

    expect(customer).toEqual(existing);
    expect(builder.eq).toHaveBeenCalledWith('email_normalized', 'guest@example.com');
    expect(builder.eq).not.toHaveBeenCalledWith('phone_normalized', '447000000000');
    expect(update).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it('fills a missing customer phone when reusing an existing email match', async () => {
    const existing = {
      id: 'customer-1',
      restaurant_id: 'rest-1',
      email: 'guest@example.com',
      phone: '',
      full_name: 'Existing Guest',
      marketing_opt_in: false,
      created_at: '2026-04-01T15:00:00Z',
      updated_at: '2026-04-01T15:00:00Z',
      email_normalized: 'guest@example.com',
      phone_normalized: null,
      auth_user_id: null,
      user_profile_id: null,
      notes: null,
    };
    const updated = {
      ...existing,
      phone: '+447000000000',
      phone_normalized: '447000000000',
    };

    const lookupBuilder = {
      select: vi.fn(() => lookupBuilder),
      eq: vi.fn(() => lookupBuilder),
      maybeSingle: vi.fn().mockResolvedValue({ data: existing, error: null }),
    };
    const updateSingle = vi.fn().mockResolvedValue({ data: updated, error: null });
    const updateBuilder = {
      update: vi.fn(() => updateBuilder),
      eq: vi.fn(() => updateBuilder),
      select: vi.fn(() => updateBuilder),
      single: updateSingle,
    };
    const from = vi.fn().mockReturnValueOnce(lookupBuilder).mockReturnValueOnce(updateBuilder);

    const customer = await upsertCustomer({ from } as unknown as DbClient, {
      restaurantId: 'rest-1',
      email: 'guest@example.com',
      phone: '07000 000000',
      name: 'Existing Guest',
      marketingOptIn: false,
    });

    expect(customer).toEqual(updated);
    expect(updateBuilder.update).toHaveBeenCalledWith({ phone: '+447000000000' });
    expect(updateBuilder.eq).toHaveBeenCalledWith('id', 'customer-1');
  });

  it('keeps the email-matched customer when filling a missing phone conflicts', async () => {
    const existing = {
      id: 'customer-1',
      restaurant_id: 'rest-1',
      email: 'guest@example.com',
      phone: '',
      full_name: 'Existing Guest',
      marketing_opt_in: false,
      created_at: '2026-04-01T15:00:00Z',
      updated_at: '2026-04-01T15:00:00Z',
      email_normalized: 'guest@example.com',
      phone_normalized: null,
      auth_user_id: null,
      user_profile_id: null,
      notes: null,
    };
    const duplicatePhoneError = {
      code: '23505',
      message:
        'duplicate key value violates unique constraint "customers_restaurant_id_phone_normalized_key"',
    };

    const lookupBuilder = {
      select: vi.fn(() => lookupBuilder),
      eq: vi.fn(() => lookupBuilder),
      maybeSingle: vi.fn().mockResolvedValue({ data: existing, error: null }),
    };
    const updateSingle = vi.fn().mockResolvedValue({ data: null, error: duplicatePhoneError });
    const updateBuilder = {
      update: vi.fn(() => updateBuilder),
      eq: vi.fn(() => updateBuilder),
      select: vi.fn(() => updateBuilder),
      single: updateSingle,
    };
    const from = vi.fn().mockReturnValueOnce(lookupBuilder).mockReturnValueOnce(updateBuilder);

    const customer = await upsertCustomer({ from } as unknown as DbClient, {
      restaurantId: 'rest-1',
      email: 'guest@example.com',
      phone: '07000 000000',
      name: 'Existing Guest',
      marketingOptIn: false,
    });

    expect(customer).toEqual(existing);
    expect(updateBuilder.update).toHaveBeenCalledWith({ phone: '+447000000000' });
  });

  it('recovers from duplicate email inserts by retrying the email identity lookup', async () => {
    const existing = {
      id: 'customer-1',
      restaurant_id: 'rest-1',
      email: 'guest@example.com',
      phone: '+447950272147',
      full_name: 'Existing Guest',
      marketing_opt_in: false,
      created_at: '2026-04-01T15:00:00Z',
      updated_at: '2026-04-01T15:00:00Z',
      email_normalized: 'guest@example.com',
      phone_normalized: '447950272147',
      auth_user_id: null,
      user_profile_id: null,
      notes: null,
    };
    const duplicateEmailError = {
      code: '23505',
      message:
        'duplicate key value violates unique constraint "customers_restaurant_id_email_normalized_key"',
    };

    const firstEmailLookup = {
      select: vi.fn(() => firstEmailLookup),
      eq: vi.fn(() => firstEmailLookup),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    const firstPhoneLookup = {
      select: vi.fn(() => firstPhoneLookup),
      eq: vi.fn(() => firstPhoneLookup),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    const insertSingle = vi.fn().mockResolvedValue({ data: null, error: duplicateEmailError });
    const insertSelect = vi.fn(() => ({ single: insertSingle }));
    const insertBuilder = {
      insert: vi.fn(() => ({ select: insertSelect })),
    };
    const secondEmailLookup = {
      select: vi.fn(() => secondEmailLookup),
      eq: vi.fn(() => secondEmailLookup),
      maybeSingle: vi.fn().mockResolvedValue({ data: existing, error: null }),
    };
    const from = vi
      .fn()
      .mockReturnValueOnce(firstEmailLookup)
      .mockReturnValueOnce(firstPhoneLookup)
      .mockReturnValueOnce(insertBuilder)
      .mockReturnValueOnce(secondEmailLookup);

    const customer = await upsertCustomer({ from } as unknown as DbClient, {
      restaurantId: 'rest-1',
      email: 'guest@example.com',
      phone: '07000 000000',
      name: 'Existing Guest',
      marketingOptIn: false,
    });

    expect(customer).toEqual(existing);
    expect(secondEmailLookup.eq).toHaveBeenCalledWith('email_normalized', 'guest@example.com');
  });
});
