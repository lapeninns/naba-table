import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { listActiveHoldsForBooking } from '@/server/capacity/holds';

/**
 * Regression for discovery gap #1: the BASE function listActiveHoldsForBooking
 * used `if (error || !data) return []`, collapsing a real query failure into the
 * "no active holds" answer — a fail-open double-booking risk. The earlier
 * fix-hold-lookup-failclosed test mocked this very function, so it only proved the
 * wrapper propagates and masked the base flaw. This test drives the REAL function
 * with a stub client: an error must throw; a legitimately empty result must not.
 */
function makeClient(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  builder.select = chain;
  builder.eq = chain;
  builder.gt = chain;
  builder.then = (resolve: (value: unknown) => unknown) => resolve(result);
  return { from: () => builder } as never;
}

describe('#1 listActiveHoldsForBooking base function fails closed', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('throws (does not return []) when the holds query errors', async () => {
    const client = makeClient({ data: null, error: { message: 'connection refused', code: '08006' } });

    await expect(listActiveHoldsForBooking({ bookingId: 'b1', client })).rejects.toBeTruthy();
    expect(console.error).toHaveBeenCalled();
  });

  it('returns [] for a legitimately empty result (no error)', async () => {
    const client = makeClient({ data: [], error: null });

    await expect(listActiveHoldsForBooking({ bookingId: 'b1', client })).resolves.toEqual([]);
  });
});
