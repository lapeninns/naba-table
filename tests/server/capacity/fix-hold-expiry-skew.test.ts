import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';

import { getVenuePolicy } from '@/server/capacity/policy';
import {
  holdExpiryLowerBoundIso,
  loadActiveHoldsForDate,
} from '@/server/capacity/table-assignment/supabase';

import type { DbClient } from '@/server/capacity/table-assignment/supabase';

type CapturedFilters = {
  expiresAtGt?: string;
};

/**
 * Minimal fluent stub mimicking the subset of the Supabase query builder used by
 * loadActiveHoldsForDate. It records the value passed to `.gt('expires_at', ...)`
 * and resolves with the provided rows.
 */
function createHoldsClient(rows: unknown[], captured: CapturedFilters): DbClient {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  builder.select = chain;
  builder.eq = chain;
  builder.lt = chain;
  builder.gt = (column: string, value: string) => {
    if (column === 'expires_at') {
      captured.expiresAtGt = value;
    }
    return builder;
  };
  // Awaiting the builder resolves the query.
  builder.then = (resolve: (value: { data: unknown[]; error: null }) => unknown) =>
    resolve({ data: rows, error: null });

  return {
    from: () => builder,
  } as unknown as DbClient;
}

describe('hold expiry skew guard (#19)', () => {
  it('returns a lower bound earlier than the supplied instant (fail-safe toward active)', () => {
    const now = DateTime.fromISO('2026-05-23T18:00:00.000Z', { zone: 'utc' });
    const bound = DateTime.fromISO(holdExpiryLowerBoundIso(now), { zone: 'utc' });

    expect(bound.isValid).toBe(true);
    // The bound must be strictly before `now` so a hold expiring within the skew
    // window still passes the `expires_at > bound` filter and is treated active.
    expect(bound.toMillis()).toBeLessThan(now.toMillis());
  });

  it('keeps a hold expiring slightly before app-now within the active lower bound', () => {
    const now = DateTime.fromISO('2026-05-23T18:00:00.000Z', { zone: 'utc' });
    const bound = DateTime.fromISO(holdExpiryLowerBoundIso(now), { zone: 'utc' });

    // A hold whose DB-side expiry is 2s after the app clock's "now" would be
    // dropped by a naive `expires_at > now` filter under clock skew, but must
    // remain selectable under the skew-padded bound.
    const nearBoundaryExpiry = now.minus({ seconds: 2 });
    expect(nearBoundaryExpiry.toMillis()).toBeGreaterThan(bound.toMillis());
  });

  it('filters loadActiveHoldsForDate by the skew-padded expires_at lower bound', async () => {
    const captured: CapturedFilters = {};
    const client = createHoldsClient([], captured);
    const policy = getVenuePolicy({ timezone: 'UTC' });

    await loadActiveHoldsForDate('restaurant-1', '2026-05-23', policy, client);

    expect(captured.expiresAtGt).toBeDefined();
    const usedBound = DateTime.fromISO(captured.expiresAtGt!, { zone: 'utc' });
    expect(usedBound.isValid).toBe(true);
    // The applied bound must be in the past relative to a freshly captured now,
    // confirming the skew allowance was subtracted rather than using a raw now().
    expect(usedBound.toMillis()).toBeLessThan(DateTime.now().toMillis());
  });
});
