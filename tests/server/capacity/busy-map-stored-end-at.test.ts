import { describe, expect, it } from 'vitest';

import { getVenuePolicy } from '@/server/capacity/policy';
import { buildBusyMaps } from '@/server/capacity/table-assignment/availability';

import type { ContextBookingRow } from '@/server/capacity/table-assignment/supabase';

// triage-063 (confirmed P2): the busy map built from existing bookings used only the
// policy-derived window and ignored the booking's persisted end_at, under-reserving the
// table and allowing an overlapping assignment in the gap between the policy end and the
// real end_at. The busy interval must cover the later of the two ends.
function booking(overrides: Partial<ContextBookingRow> & { id: string }): ContextBookingRow {
  return {
    id: overrides.id,
    party_size: overrides.party_size ?? 2,
    status: overrides.status ?? 'confirmed',
    start_time: overrides.start_time ?? null,
    end_time: overrides.end_time ?? null,
    start_at: overrides.start_at ?? null,
    end_at: overrides.end_at ?? null,
    booking_date: overrides.booking_date ?? null,
    booking_type: overrides.booking_type ?? 'dinner',
    seating_preference: overrides.seating_preference ?? null,
    booking_table_assignments: overrides.booking_table_assignments ?? [],
  };
}

function busyEndMsFor(endAt: string | null): number {
  const policy = getVenuePolicy({ timezone: 'Europe/London' });
  const map = buildBusyMaps({
    targetBookingId: 'target',
    bookings: [
      booking({
        id: 'b1',
        start_at: '2026-05-23T18:00:00.000Z',
        booking_date: '2026-05-23',
        start_time: '18:00',
        end_at: endAt,
        booking_table_assignments: [{ table_id: 'T1' }],
      }),
    ],
    holds: [],
    policy,
  });
  const windows = map.get('T1')?.windows ?? [];
  expect(windows).toHaveLength(1);
  return new Date(windows[0].endAt).getTime();
}

describe('triage-063: busy map honors stored end_at', () => {
  it('extends the table busy window when the persisted end_at exceeds the policy window', () => {
    // 5 hours past start — far beyond any dinner policy band/buffer.
    const withLongEnd = busyEndMsFor('2026-05-23T23:00:00.000Z');
    const policyOnly = busyEndMsFor(null);
    expect(withLongEnd).toBeGreaterThan(policyOnly);
  });
});
