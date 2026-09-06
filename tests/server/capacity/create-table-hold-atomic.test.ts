import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/server/runtime-policy', () => ({ getHoldMinTtlSeconds: () => 5 }));
vi.mock('@/server/supabase', () => ({ getServiceSupabaseClient: vi.fn() }));
vi.mock('@/server/capacity/telemetry', () => ({ emitHoldCreated: vi.fn() }));

import { createTableHold, HoldConflictError, HoldPersistenceError } from '@/server/capacity/holds';

import type { CreateTableHoldInput } from '@/server/capacity/holds';

const row = {
  id: 'hold-1',
  booking_id: null,
  restaurant_id: 'restaurant-1',
  zone_id: 'zone-1',
  start_at: '2026-10-01T12:00:00Z',
  end_at: '2026-10-01T13:00:00Z',
  expires_at: '2026-09-06T10:03:00.000Z',
  created_by: null,
  metadata: { source: 'test' },
};
function fixture(result: unknown = { data: [row], error: null }) {
  const rpc = vi.fn().mockResolvedValue(result);
  const from = vi.fn(() => {
    throw new Error('Non-atomic table access forbidden');
  });
  const input: CreateTableHoldInput = {
    bookingId: null,
    restaurantId: row.restaurant_id,
    zoneId: row.zone_id,
    tableIds: ['table-1', 'table-1'],
    startAt: row.start_at,
    endAt: row.end_at,
    expiresAt: row.expires_at,
    createdBy: 'not-a-uuid',
    metadata: row.metadata,
    client: { rpc, from } as unknown as CreateTableHoldInput['client'],
  };
  return { input, rpc, from };
}
afterEach(() => vi.useRealTimers());

describe('atomic table hold creation', () => {
  it('creates hold and members only through one atomic RPC and preserves normalized fields', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-06T10:00:00Z'));
    const { input, rpc, from } = fixture();
    const hold = await createTableHold(input);
    expect(rpc).toHaveBeenCalledExactlyOnceWith('create_table_hold_atomic', {
      p_booking_id: null,
      p_restaurant_id: row.restaurant_id,
      p_zone_id: row.zone_id,
      p_table_ids: ['table-1'],
      p_start_at: row.start_at,
      p_end_at: row.end_at,
      p_expires_at: row.expires_at,
      p_created_by: null,
      p_metadata: row.metadata,
    });
    expect(hold).toMatchObject({
      id: 'hold-1',
      bookingId: null,
      tableIds: ['table-1'],
      metadata: row.metadata,
      expiresAt: row.expires_at,
    });
    expect(from).not.toHaveBeenCalled();
  });
  it.each(['invalid', '2026-09-06T09:59:00Z'])(
    'normalizes minimum TTL (%s) and preserves UUID actor',
    async (expiry) => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-09-06T10:00:00Z'));
      const { input, rpc } = fixture();
      input.expiresAt = expiry;
      input.createdBy = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
      await createTableHold(input);
      expect(rpc).toHaveBeenCalledWith(
        'create_table_hold_atomic',
        expect.objectContaining({
          p_expires_at: '2026-09-06T10:00:05.000Z',
          p_created_by: input.createdBy,
        }),
      );
    },
  );
  it('maps database contention to a safe conflict without another read or write', async () => {
    const { input, rpc, from } = fixture({
      data: null,
      error: { code: '23P01', message: 'provider-secret-sentinel' },
    });
    await expect(createTableHold(input)).rejects.toBeInstanceOf(HoldConflictError);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(from).not.toHaveBeenCalled();
  });
  it.each(['PGRST202', 'PGRST204', '23514', '42501'])(
    'fails closed on %s without legacy orphan-producing fallback',
    async (code) => {
      const { input, rpc, from } = fixture({
        data: null,
        error: { code, message: 'provider-secret-sentinel table_hold_members schema cache' },
      });
      await expect(createTableHold(input)).rejects.toMatchObject({
        name: 'HoldPersistenceError',
        code,
        message: 'Failed to create table hold',
      });
      expect(rpc).toHaveBeenCalledTimes(1);
      expect(from).not.toHaveBeenCalled();
    },
  );
  it.each([null, [], [row, row]])('rejects an invalid success cardinality', async (data) => {
    const { input, from } = fixture({ data, error: null });
    await expect(createTableHold(input)).rejects.toBeInstanceOf(HoldPersistenceError);
    expect(from).not.toHaveBeenCalled();
  });
  it('suppresses unexpected transport details', async () => {
    const { input, rpc, from } = fixture();
    rpc.mockRejectedValue(new Error('provider-secret-sentinel'));
    await expect(createTableHold(input)).rejects.toMatchObject({
      name: 'HoldPersistenceError',
      message: 'Failed to create table hold',
    });
    expect(from).not.toHaveBeenCalled();
  });
});
