import { describe, expect, it, vi } from 'vitest';

import { loadCachedConfirmationResult } from '@/server/capacity/table-assignment/confirmation-cache';

function chain(result: unknown) {
  const calls: Array<[string, unknown]> = [];
  const builder = {
    calls,
    select: vi.fn(() => builder),
    eq: vi.fn((column: string, value: unknown) => {
      calls.push([column, value]);
      return builder;
    }),
    limit: vi.fn(() => builder),
    maybeSingle: vi.fn(async () => result),
    then(resolve: (value: unknown) => void) {
      resolve(result);
    },
  };
  return builder;
}

describe('confirmation cache lookups', () => {
  it('binds cached confirmation and assignment reads to booking, hold, and restaurant', async () => {
    const confirmation = chain({ data: { idempotency_key: 'confirm-key' }, error: null });
    const assignments = chain({
      data: [
        {
          id: 'assignment-1',
          table_id: 'table-1',
          start_at: '2026-07-01T18:00:00Z',
          end_at: '2026-07-01T20:00:00Z',
          merge_group_id: null,
        },
      ],
      error: null,
    });
    const from = vi.fn((table: string) =>
      table === 'booking_confirmation_results' ? confirmation : assignments,
    );

    const result = await loadCachedConfirmationResult({
      supabase: { from } as never,
      bookingId: 'booking-1',
      holdId: 'hold-1',
      restaurantId: 'restaurant-1',
      idempotencyKey: 'confirm-key',
    });

    expect(result).toHaveLength(1);
    expect(confirmation.calls).toEqual(
      expect.arrayContaining([
        ['booking_id', 'booking-1'],
        ['hold_id', 'hold-1'],
        ['restaurant_id', 'restaurant-1'],
        ['idempotency_key', 'confirm-key'],
      ]),
    );
    expect(assignments.calls).toEqual(
      expect.arrayContaining([
        ['booking_id', 'booking-1'],
        ['hold_id', 'hold-1'],
        ['restaurant_id', 'restaurant-1'],
        ['idempotency_key', 'confirm-key'],
      ]),
    );
  });

  it('#4: treats a cached confirmation with a non-matching idempotency key as a miss', async () => {
    // The request omits an idempotency key, but the cached row carries a (different)
    // key. The guard must NOT serve those assignments — otherwise confirmations with
    // distinct keys would share assignments. It must also not read the assignments
    // table at all for the non-matching row.
    const confirmation = chain({ data: { idempotency_key: 'some-other-key' }, error: null });
    let assignmentsRead = 0;
    const assignments = chain({
      data: [
        {
          id: 'assignment-1',
          table_id: 'table-1',
          start_at: '2026-07-01T18:00:00Z',
          end_at: '2026-07-01T20:00:00Z',
          merge_group_id: null,
        },
      ],
      error: null,
    });
    const from = vi.fn((table: string) => {
      if (table === 'booking_confirmation_results') {
        return confirmation;
      }
      assignmentsRead += 1;
      return assignments;
    });

    const result = await loadCachedConfirmationResult({
      supabase: { from } as never,
      bookingId: 'booking-1',
      holdId: 'hold-1',
      restaurantId: 'restaurant-1',
      idempotencyKey: null,
    });

    expect(result).toBeNull();
    expect(assignmentsRead).toBe(0);
  });
});
