import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { findHoldConflicts, listActiveHoldsForBooking } from '@/server/capacity/holds';

import type { DbClient } from '@/server/capacity/table-assignment/supabase';

/**
 * Regression for skew-pad gap #3.
 *
 * The clock-skew pad (HOLD_EXPIRY_SKEW_MS) was applied to the date/window readers
 * in table-assignment/supabase.ts but NOT to the manual-path conflict detectors
 * in holds.ts (findHoldConflicts, listActiveHoldsForBooking), which still
 * filtered on a raw `new Date().toISOString()`. Under app-clock-ahead skew that
 * lets a still-live hold read as expired — a fail-OPEN gap that risks
 * double-booking. Both must now query an `expires_at` lower bound that sits in
 * the past by the skew allowance.
 */

type Captured = { expiresAtGt?: string };

function createClient(captured: Captured, rows: unknown[] = []): DbClient {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  builder.select = chain;
  builder.eq = chain;
  builder.in = chain;
  builder.lt = chain;
  builder.filter = chain;
  builder.gt = (column: string, value: string) => {
    if (column === 'expires_at') {
      captured.expiresAtGt = value;
    }
    return builder;
  };
  builder.then = (resolve: (value: { data: unknown[]; error: null }) => unknown) =>
    resolve({ data: rows, error: null });

  return {
    from: () => builder,
    rpc: async (name: string) => {
      // configureHoldStrictConflictSession verifies strict mode is honored.
      if (name === 'is_holds_strict_conflicts_enabled') {
        return { data: true, error: null };
      }
      return { data: null, error: null };
    },
  } as unknown as DbClient;
}

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('holds.ts skew-padded expiry bound (#3)', () => {
  it('listActiveHoldsForBooking filters expires_at by a skew-padded (past) lower bound', async () => {
    const captured: Captured = {};
    const client = createClient(captured);

    await listActiveHoldsForBooking({ bookingId: 'booking-1', client });

    expect(captured.expiresAtGt).toBeDefined();
    const boundMs = new Date(captured.expiresAtGt!).getTime();
    // The bound must sit in the past (skew subtracted), not at a raw now().
    expect(boundMs).toBeLessThan(Date.now());
    expect(Date.now() - boundMs).toBeGreaterThanOrEqual(4_000);
  });

  it('findHoldConflicts filters expires_at by a skew-padded (past) lower bound', async () => {
    const captured: Captured = {};
    const client = createClient(captured);

    await findHoldConflicts({
      restaurantId: 'restaurant-1',
      tableIds: ['table-a'],
      startAt: '2026-07-01T18:00:00.000Z',
      endAt: '2026-07-01T19:30:00.000Z',
      client,
    });

    expect(captured.expiresAtGt).toBeDefined();
    const boundMs = new Date(captured.expiresAtGt!).getTime();
    expect(boundMs).toBeLessThan(Date.now());
    expect(Date.now() - boundMs).toBeGreaterThanOrEqual(4_000);
  });
});
