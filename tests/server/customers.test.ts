import { readFileSync } from 'node:fs';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  normalizePhone,
  recordBookingForCustomerProfile,
  recordCancellationForCustomerProfile,
  upsertCustomer,
} from '@/server/customers';

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
  afterEach(() => {
    vi.restoreAllMocks();
  });

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

  it('does not reuse an existing customer when both public contacts do not match the same row', async () => {
    const inserted = {
      id: 'customer-2',
      restaurant_id: 'rest-1',
      email: 'guest@example.com',
      phone: '+447000000000',
      full_name: 'Updated Input',
      marketing_opt_in: false,
      created_at: '2026-04-01T15:00:00Z',
      updated_at: '2026-04-01T15:00:00Z',
      email_normalized: 'guest@example.com',
      phone_normalized: '447000000000',
      auth_user_id: null,
      user_profile_id: null,
      notes: null,
    };

    const lookupBuilder = {
      select: vi.fn(() => lookupBuilder),
      eq: vi.fn(() => lookupBuilder),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    const insertSingle = vi.fn().mockResolvedValue({ data: inserted, error: null });
    const insertBuilder = {
      insert: vi.fn(() => insertBuilder),
      select: vi.fn(() => insertBuilder),
      single: insertSingle,
    };
    const from = vi.fn().mockReturnValueOnce(lookupBuilder).mockReturnValueOnce(insertBuilder);

    const customer = await upsertCustomer({ from } as unknown as DbClient, {
      restaurantId: 'rest-1',
      email: 'guest@example.com',
      phone: '07000 000000',
      name: 'Updated Input',
      marketingOptIn: false,
    });

    expect(customer).toEqual(inserted);
    expect(lookupBuilder.eq).toHaveBeenCalledWith('email_normalized', 'guest@example.com');
    expect(lookupBuilder.eq).toHaveBeenCalledWith('phone_normalized', '447000000000');
    expect(insertBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'guest@example.com',
        phone: '+447000000000',
      }),
    );
  });

  it('stores NULL (never the empty string) for email-only customers', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const lookupBuilder = {
      select: vi.fn(() => lookupBuilder),
      eq: vi.fn(() => lookupBuilder),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    const insertSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'customer-3',
        restaurant_id: 'rest-1',
        email: 'guest@example.com',
        phone: null,
        full_name: 'Email Only',
        marketing_opt_in: false,
        created_at: '2026-07-20T15:00:00Z',
        updated_at: '2026-07-20T15:00:00Z',
        email_normalized: 'guest@example.com',
        phone_normalized: null,
        auth_user_id: null,
        user_profile_id: null,
        notes: null,
      },
      error: null,
    });
    const insertBuilder = {
      insert: vi.fn(() => insertBuilder),
      select: vi.fn(() => insertBuilder),
      single: insertSingle,
    };
    const from = vi.fn().mockReturnValueOnce(lookupBuilder).mockReturnValueOnce(insertBuilder);

    await upsertCustomer({ from } as unknown as DbClient, {
      restaurantId: 'rest-1',
      email: 'guest@example.com',
      phone: null,
      name: 'Email Only',
    });

    // The '' phone insert violated customers_phone_check (length >= 7) and was
    // the top production booking-500 cause; NULL passes the CHECK.
    expect(insertBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'guest@example.com', phone: null }),
    );
    const payload = (insertBuilder.insert.mock.calls[0] as unknown[])[0] as Record<
      string,
      unknown
    >;
    expect(payload.phone).not.toBe('');
  });

  it('maps NOT NULL contact rejections to a controlled PHONE_REQUIRED error', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const lookupBuilder = {
      select: vi.fn(() => lookupBuilder),
      eq: vi.fn(() => lookupBuilder),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    const insertBuilder = {
      insert: vi.fn(() => insertBuilder),
      select: vi.fn(() => insertBuilder),
      single: vi.fn().mockResolvedValue({
        data: null,
        error: {
          code: '23502',
          message: 'null value in column "phone" of relation "customers"',
        },
      }),
    };
    const from = vi.fn().mockReturnValueOnce(lookupBuilder).mockReturnValueOnce(insertBuilder);

    await expect(
      upsertCustomer({ from } as unknown as DbClient, {
        restaurantId: 'rest-1',
        email: 'guest@example.com',
        phone: null,
        name: 'Email Only',
      }),
    ).rejects.toMatchObject({
      name: 'CustomerContactStorageError',
      code: 'PHONE_REQUIRED',
    });
  });

  it('maps CHECK violations with a submitted phone to INVALID_CONTACT', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const lookupBuilder = {
      select: vi.fn(() => lookupBuilder),
      eq: vi.fn(() => lookupBuilder),
      or: vi.fn(() => lookupBuilder),
      order: vi.fn(() => lookupBuilder),
      limit: vi.fn(() => lookupBuilder),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    const insertBuilder = {
      insert: vi.fn(() => insertBuilder),
      select: vi.fn(() => insertBuilder),
      single: vi.fn().mockResolvedValue({
        data: null,
        error: {
          code: '23514',
          message: 'new row for relation "customers" violates check constraint "customers_phone_check"',
        },
      }),
    };
    const from = vi.fn().mockReturnValueOnce(lookupBuilder).mockReturnValueOnce(insertBuilder);

    await expect(
      upsertCustomer({ from } as unknown as DbClient, {
        restaurantId: 'rest-1',
        email: 'guest@example.com',
        phone: '07000 000000',
        name: 'Guest',
      }),
    ).rejects.toMatchObject({
      name: 'CustomerContactStorageError',
      code: 'INVALID_CONTACT',
    });
  });

  it('does not fall back to a single email match after a strict public insert conflict', async () => {
    const infoSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const duplicateEmailError = {
      code: '23505',
      message:
        'duplicate key value violates unique constraint "customers_restaurant_id_email_normalized_key"',
    };

    const firstLookup = {
      select: vi.fn(() => firstLookup),
      eq: vi.fn(() => firstLookup),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    const insertSingle = vi.fn().mockResolvedValue({ data: null, error: duplicateEmailError });
    const insertBuilder = {
      insert: vi.fn(() => insertBuilder),
      select: vi.fn(() => insertBuilder),
      single: insertSingle,
    };
    const secondLookup = {
      select: vi.fn(() => secondLookup),
      eq: vi.fn(() => secondLookup),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    const from = vi
      .fn()
      .mockReturnValueOnce(firstLookup)
      .mockReturnValueOnce(insertBuilder)
      .mockReturnValueOnce(secondLookup);

    await expect(
      upsertCustomer({ from } as unknown as DbClient, {
        restaurantId: 'rest-1',
        email: 'guest@example.com',
        phone: '07000 000000',
        name: 'Attacker Input',
        marketingOptIn: false,
        identityMatchMode: 'strict',
        allowExistingUpdates: false,
      }),
    ).rejects.toEqual(duplicateEmailError);

    expect(secondLookup.eq).toHaveBeenCalledWith('email_normalized', 'guest@example.com');
    expect(secondLookup.eq).toHaveBeenCalledWith('phone_normalized', '447000000000');

    const logOutput = JSON.stringify([
      ...infoSpy.mock.calls,
      ...warnSpy.mock.calls,
      ...errorSpy.mock.calls,
    ]);
    expect(logOutput).toContain('Unique violation unrecovered by identity re-find');
    expect(logOutput).toContain('customers_restaurant_id_email_normalized_key');
    expect(logOutput).not.toContain('guest@example.com');
    expect(logOutput).not.toContain('07000');
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
      identityMatchMode: 'partial',
      allowExistingUpdates: true,
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
      identityMatchMode: 'partial',
      allowExistingUpdates: true,
    });

    expect(customer).toEqual(existing);
    expect(updateBuilder.update).toHaveBeenCalledWith({ phone: '+447000000000' });
  });

  it('redacts customer update fields and database conflicts in logs', async () => {
    const infoSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const existing = {
      id: 'customer-1',
      restaurant_id: 'rest-1',
      email: 'guest@example.com',
      phone: '',
      full_name: null,
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
      message: 'duplicate key value includes +447000000000 and guest@example.com',
      details: 'phone +447000000000',
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

    await upsertCustomer({ from } as unknown as DbClient, {
      restaurantId: 'rest-1',
      email: 'guest@example.com',
      phone: '07000 000000',
      name: 'Private Guest',
      marketingOptIn: false,
      identityMatchMode: 'partial',
      allowExistingUpdates: true,
    });

    const logOutput = JSON.stringify([...infoSpy.mock.calls, ...warnSpy.mock.calls]);
    expect(logOutput).toContain('"fields":["full_name","phone"]');
    expect(logOutput).toContain('"code":"23505"');
    expect(logOutput).not.toContain('+447000000000');
    expect(logOutput).not.toContain('guest@example.com');
    expect(logOutput).not.toContain('Private Guest');
  });

  it('recovers from exact duplicate contact inserts by retrying the strict identity lookup', async () => {
    const existing = {
      id: 'customer-1',
      restaurant_id: 'rest-1',
      email: 'guest@example.com',
      phone: '+447000000000',
      full_name: 'Existing Guest',
      marketing_opt_in: false,
      created_at: '2026-04-01T15:00:00Z',
      updated_at: '2026-04-01T15:00:00Z',
      email_normalized: 'guest@example.com',
      phone_normalized: '447000000000',
      auth_user_id: null,
      user_profile_id: null,
      notes: null,
    };
    const duplicateEmailError = {
      code: '23505',
      message:
        'duplicate key value violates unique constraint "customers_restaurant_id_email_normalized_key"',
    };

    const firstLookup = {
      select: vi.fn(() => firstLookup),
      eq: vi.fn(() => firstLookup),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    const insertSingle = vi.fn().mockResolvedValue({ data: null, error: duplicateEmailError });
    const insertSelect = vi.fn(() => ({ single: insertSingle }));
    const insertBuilder = {
      insert: vi.fn(() => ({ select: insertSelect })),
    };
    const secondLookup = {
      select: vi.fn(() => secondLookup),
      eq: vi.fn(() => secondLookup),
      maybeSingle: vi.fn().mockResolvedValue({ data: existing, error: null }),
    };
    const from = vi
      .fn()
      .mockReturnValueOnce(firstLookup)
      .mockReturnValueOnce(insertBuilder)
      .mockReturnValueOnce(secondLookup);

    const customer = await upsertCustomer({ from } as unknown as DbClient, {
      restaurantId: 'rest-1',
      email: 'guest@example.com',
      phone: '07000 000000',
      name: 'Existing Guest',
      marketingOptIn: false,
    });

    expect(customer).toEqual(existing);
    expect(secondLookup.eq).toHaveBeenCalledWith('email_normalized', 'guest@example.com');
    expect(secondLookup.eq).toHaveBeenCalledWith('phone_normalized', '447000000000');
  });

  it('records booking aggregates through the atomic database RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    const from = vi.fn();

    await recordBookingForCustomerProfile({ rpc, from } as unknown as DbClient, {
      customerId: '11111111-1111-4111-8111-111111111111',
      createdAt: '2026-05-16T12:00:00.000Z',
      partySize: 4,
      marketingOptIn: true,
      status: 'confirmed',
    });

    expect(rpc).toHaveBeenCalledWith('record_booking_for_customer_profile_atomic', {
      p_customer_id: '11111111-1111-4111-8111-111111111111',
      p_created_at: '2026-05-16T12:00:00.000Z',
      p_party_size: 4,
      p_marketing_opt_in: true,
      p_is_cancelled: false,
    });
    expect(from).not.toHaveBeenCalled();
  });

  it('records cancellation aggregates through the atomic database RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    const from = vi.fn();

    await recordCancellationForCustomerProfile({ rpc, from } as unknown as DbClient, {
      customerId: '11111111-1111-4111-8111-111111111111',
      cancelledAt: '2026-05-16T13:00:00.000Z',
    });

    expect(rpc).toHaveBeenCalledWith('record_cancellation_for_customer_profile_atomic', {
      p_customer_id: '11111111-1111-4111-8111-111111111111',
      p_cancelled_at: '2026-05-16T13:00:00.000Z',
    });
    expect(from).not.toHaveBeenCalled();
  });

  it('keeps customer profile aggregate SQL as atomic increment upserts', () => {
    const migration = readFileSync(
      'supabase/migrations/20260516114919_atomic_customer_profile_aggregates.sql',
      'utf8',
    );

    expect(migration).toContain(
      'CREATE OR REPLACE FUNCTION public.record_booking_for_customer_profile_atomic',
    );
    expect(migration).toContain(
      'CREATE OR REPLACE FUNCTION public.record_cancellation_for_customer_profile_atomic',
    );
    expect(migration).toContain('ON CONFLICT (customer_id) DO UPDATE');
    expect(migration).toContain('total_bookings = public.customer_profiles.total_bookings + 1');
    expect(migration).toContain(
      'total_covers = public.customer_profiles.total_covers + EXCLUDED.total_covers',
    );
    expect(migration).toContain(
      'total_cancellations = public.customer_profiles.total_cancellations + EXCLUDED.total_cancellations',
    );
    expect(migration).toContain(
      'total_cancellations = public.customer_profiles.total_cancellations + 1',
    );
    expect(migration).toContain('GRANT EXECUTE ON FUNCTION');
    expect(migration).toContain('TO service_role');
    expect(migration).toContain('FROM authenticated');
  });
});
