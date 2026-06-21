import { describe, expect, it } from 'vitest';

import { legacyTableAvailabilityCheck } from '@/server/capacity/table-assignment/availability';

import type { DbClient } from '@/server/capacity/table-assignment/supabase';

// triage-079 (confirmed P3): the legacy availability fallback pre-filtered on the NULLABLE
// assignment-level start_at/end_at columns (.lt/.gt). Rows with NULL assignment times were dropped
// by the DB before the in-loop fallback to the booking's own times could detect an overlap,
// allowing a double assignment. The query must not use those nullable time predicates.

type Call = [string, ...unknown[]];

function makeSupabase(rows: unknown[], calls: Call[]): DbClient {
  const builder: Record<string, unknown> = {};
  builder.select = (...a: unknown[]) => { calls.push(['select', ...a]); return builder; };
  builder.eq = (...a: unknown[]) => { calls.push(['eq', ...a]); return builder; };
  builder.lt = (...a: unknown[]) => { calls.push(['lt', ...a]); return builder; };
  builder.gt = (...a: unknown[]) => { calls.push(['gt', ...a]); return builder; };
  builder.then = (resolve: (v: { data: unknown; error: null }) => unknown) =>
    resolve({ data: rows, error: null });
  return { from: () => builder } as unknown as DbClient;
}

describe('legacyTableAvailabilityCheck null assignment times (triage-079)', () => {
  it('does not pre-filter on nullable start_at/end_at and detects a NULL-times overlap', async () => {
    const calls: Call[] = [];
    // Assignment row with NULL assignment-level times, whose booking (18:00-20:00) overlaps the
    // requested 19:00-19:30 window only via the booking's own times.
    const rows = [
      {
        table_id: 'T1',
        start_at: null,
        end_at: null,
        bookings: {
          id: 'b2',
          status: 'confirmed',
          start_at: '2026-05-23T18:00:00.000Z',
          end_at: '2026-05-23T20:00:00.000Z',
        },
      },
    ];

    const available = await legacyTableAvailabilityCheck({
      supabase: makeSupabase(rows, calls),
      tableId: 'T1',
      startAt: '2026-05-23T19:00:00.000Z',
      endAt: '2026-05-23T19:30:00.000Z',
    });

    // the query must NOT use the nullable time predicates (they would drop the NULL-times row)
    expect(calls.some((c) => c[0] === 'lt')).toBe(false);
    expect(calls.some((c) => c[0] === 'gt')).toBe(false);
    // and the overlap is detected via the booking fallback -> table is NOT available
    expect(available).toBe(false);
  });
});
