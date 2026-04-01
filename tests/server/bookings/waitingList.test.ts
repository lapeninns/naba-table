import { describe, expect, it, vi } from 'vitest';

import { addToWaitingList } from '@/server/bookings';

import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database>;

function createWaitingListClient() {
  const positionMaybeSingle = vi
    .fn()
    .mockResolvedValue({ data: { id: 'wait-1', created_at: '2026-04-01T17:00:00Z' }, error: null });
  const positionEqPhone = vi.fn(() => ({ maybeSingle: positionMaybeSingle }));
  const positionEqEmail = vi.fn(() => ({ eq: positionEqPhone }));
  const positionEqTime = vi.fn(() => ({ eq: positionEqEmail }));
  const positionEqDate = vi.fn(() => ({ eq: positionEqTime }));
  const positionEqRestaurant = vi.fn(() => ({ eq: positionEqDate }));
  const positionSelect = vi.fn(() => ({ eq: positionEqRestaurant }));

  const insert = vi.fn().mockResolvedValue({ error: null });

  const initialMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  const initialLimit = vi.fn(() => ({ maybeSingle: initialMaybeSingle }));
  const initialEqPhone = vi.fn(() => ({ limit: initialLimit }));
  const initialEqEmail = vi.fn(() => ({ eq: initialEqPhone }));
  const initialEqTime = vi.fn(() => ({ eq: initialEqEmail }));
  const initialEqDate = vi.fn(() => ({ eq: initialEqTime }));
  const initialEqRestaurant = vi.fn(() => ({ eq: initialEqDate }));
  const initialSelect = vi.fn(() => ({ eq: initialEqRestaurant }));

  const countLte = vi.fn().mockResolvedValue({ count: 1, error: null });
  const countEqTime = vi.fn(() => ({ lte: countLte }));
  const countEqDate = vi.fn(() => ({ eq: countEqTime }));
  const countEqRestaurant = vi.fn(() => ({ eq: countEqDate }));
  const countSelect = vi.fn(() => ({ eq: countEqRestaurant }));

  const from = vi
    .fn()
    .mockImplementationOnce(() => ({ select: initialSelect }))
    .mockImplementationOnce(() => ({ insert }))
    .mockImplementationOnce(() => ({ select: positionSelect }))
    .mockImplementationOnce(() => ({ select: countSelect }));

  return {
    client: { from } as unknown as DbClient,
    spies: {
      from,
      insert,
      initialEqPhone,
      positionEqPhone,
    },
  };
}

describe('server/bookings addToWaitingList', () => {
  it('canonicalizes equivalent UK phone formats for waitlist dedupe and storage', async () => {
    const { client, spies } = createWaitingListClient();

    const result = await addToWaitingList(client, {
      restaurant_id: 'rest-1',
      booking_date: '2026-04-01',
      desired_time: '19:00',
      party_size: 2,
      seating_preference: 'indoor',
      customer_name: 'Guest Booker',
      customer_email: 'guest@example.com',
      customer_phone: '07950 272147',
      notes: null,
    });

    expect(spies.initialEqPhone).toHaveBeenCalledWith('customer_phone', '+447950272147');
    expect(spies.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        customer_phone: '+447950272147',
      }),
    );
    expect(spies.positionEqPhone).toHaveBeenCalledWith('customer_phone', '+447950272147');
    expect(result).toEqual({ id: 'wait-1', position: 1, existing: false });
  });
});
