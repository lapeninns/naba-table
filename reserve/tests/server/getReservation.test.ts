import { describe, expect, it, vi } from 'vitest';

import { getReservation, GetReservationError } from '@/server/reservations/getReservation';

import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type MaybeSingleResponse = {
  data: unknown;
  error: { message: string } | null;
};

function createFromStub(response: MaybeSingleResponse | Promise<MaybeSingleResponse>) {
  const maybeSingle = vi.fn(() => Promise.resolve(response)).mockName('maybeSingle');
  const eq = vi.fn(() => ({ maybeSingle })).mockName('eq');
  const select = vi.fn(() => ({ eq })).mockName('select');
  const from = vi.fn(() => ({ select })).mockName('from');
  return Object.assign(from, { select, eq, maybeSingle });
}

function createSupabaseStub(response: MaybeSingleResponse | Promise<MaybeSingleResponse>) {
  const from = createFromStub(response);
  return { from } as unknown as SupabaseClient<Database>;
}

type BookingRecord = {
  id: string;
  restaurant_id: string;
  booking_date: string;
  start_time: string;
  end_time: string | null;
  start_at: string;
  end_at: string | null;
  booking_type: string;
  seating_preference: string | null;
  status: string;
  party_size: number;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  marketing_opt_in: boolean | null;
  notes: string | null;
  reference: string | null;
  client_request_id: string | null;
  idempotency_key: string | null;
  pending_ref: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  restaurants: {
    name: string | null;
  } | null;
};

const BASE_RECORD: BookingRecord = {
  id: '11111111-1111-4111-8111-111111111111',
  restaurant_id: '22222222-2222-4222-8222-222222222222',
  booking_date: '2025-05-01',
  start_time: '18:00',
  end_time: '19:30',
  start_at: '2025-05-01T18:00:00Z',
  end_at: '2025-05-01T19:30:00Z',
  booking_type: 'dinner',
  seating_preference: 'indoor',
  status: 'confirmed',
  party_size: 2,
  customer_name: 'Ada Lovelace',
  customer_email: 'ada@example.com',
  customer_phone: '+441234567890',
  marketing_opt_in: true,
  notes: null,
  reference: 'SRX-ABC123',
  client_request_id: null,
  idempotency_key: null,
  pending_ref: null,
  details: null,
  created_at: '2025-05-01T10:00:00Z',
  updated_at: '2025-05-01T10:05:00Z',
  restaurants: {
    name: 'Sajilo Kitchen',
  },
};

describe('getReservation', () => {
  it('returns reservation data when Supabase responds successfully', async () => {
    const response: MaybeSingleResponse = {
      data: BASE_RECORD,
      error: null,
    };
    const supabase = createSupabaseStub(response);

    const result = await getReservation(BASE_RECORD.id, { supabase });

    expect(result).not.toBeNull();
    expect(result?.reservation.id).toBe(BASE_RECORD.id);
    expect(result?.restaurantName).toBe('Sajilo Kitchen');
  });

  it('returns null when no reservation is found', async () => {
    const response: MaybeSingleResponse = {
      data: null,
      error: null,
    };
    const supabase = createSupabaseStub(response);

    const result = await getReservation('missing-id', { supabase });

    expect(result).toBeNull();
  });

  it('throws GetReservationError when Supabase returns an error', async () => {
    const response: MaybeSingleResponse = {
      data: null,
      error: { message: 'permission denied' },
    };
    const supabase = createSupabaseStub(response);

    await expect(getReservation(BASE_RECORD.id, { supabase })).rejects.toThrow(GetReservationError);
  });

  it('wraps unexpected errors in GetReservationError', async () => {
    const supabase = {
      from: vi.fn(() => {
        throw new Error('boom');
      }),
    } as unknown as SupabaseClient<Database>;

    await expect(getReservation(BASE_RECORD.id, { supabase })).rejects.toThrow(GetReservationError);
  });
});
