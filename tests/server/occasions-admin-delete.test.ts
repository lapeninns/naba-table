import { describe, expect, it, vi } from 'vitest';

vi.mock('@/server/supabase', () => ({
  getServiceSupabaseClient: () => {
    throw new Error('tests pass an explicit client');
  },
}));

import { deleteOccasion } from '@/server/occasions/admin';

import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

function clientReturning(result: { data: unknown; error: unknown }) {
  const rpc = vi.fn().mockResolvedValue(result);
  const from = vi.fn(() => {
    throw new Error('deleteOccasion must not read or write tables directly');
  });
  return { client: { rpc, from } as unknown as SupabaseClient<Database>, rpc };
}

describe('deleteOccasion', () => {
  it('removes the type with ONE transactional RPC call', async () => {
    const { client, rpc } = clientReturning({ data: { status: 'deleted' }, error: null });

    await expect(deleteOccasion('brunch', 'admin-1', client)).resolves.toEqual({
      status: 'deleted',
    });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('delete_booking_occasion', {
      p_key: 'brunch',
      p_actor_id: 'admin-1',
    });
  });

  it('maps the in-use refusal with its counts', async () => {
    const { client } = clientReturning({
      data: { status: 'in_use', future_bookings: 3, service_periods: 1 },
      error: null,
    });

    await expect(deleteOccasion('brunch', 'admin-1', client)).resolves.toEqual({
      status: 'in_use',
      futureBookings: 3,
      servicePeriods: 1,
    });
  });

  it.each(['not_found', 'builtin'] as const)('maps %s', async (status) => {
    const { client } = clientReturning({ data: { status }, error: null });
    await expect(deleteOccasion('brunch', 'admin-1', client)).resolves.toEqual({ status });
  });

  it('throws on a database error or an unexpected result', async () => {
    await expect(
      deleteOccasion('x', 'a', clientReturning({ data: null, error: { code: '57014' } }).client),
    ).rejects.toMatchObject({ code: '57014' });
    await expect(
      deleteOccasion('x', 'a', clientReturning({ data: { status: 'odd' }, error: null }).client),
    ).rejects.toThrow('unexpected result');
  });
});
