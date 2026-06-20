import { describe, expect, it } from 'vitest';

import { getVenuePolicy } from '@/server/capacity/policy';
import { buildBusyMaps } from '@/server/capacity/table-assignment/availability';

import type { ContextBookingRow } from '@/server/capacity/table-assignment/supabase';

/**
 * Regression for discovery gap #8: buildBusyMaps called computeBookingWindowWithFallback
 * unguarded. A context booking carrying table assignments but with null start_at AND
 * null booking_date/start_time throws (ManualSelectionInputError), which previously
 * aborted the ENTIRE busy-map / lookahead build for the current assignment. It must now
 * skip the malformed booking and keep evaluating the well-formed ones.
 */
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

describe('#8 buildBusyMaps tolerates context bookings with null temporal fields', () => {
  it('skips a null-temporal booking instead of throwing, and still maps the well-formed one', () => {
    const policy = getVenuePolicy({ timezone: 'Europe/London' });
    // Malformed row FIRST so the throw (on old code) happens before the good one.
    const malformed = booking({
      id: 'bad',
      start_at: null,
      booking_date: null,
      start_time: null,
      booking_table_assignments: [{ table_id: 'T-bad' }],
    });
    const wellFormed = booking({
      id: 'good',
      start_at: '2026-05-23T18:00:00.000Z',
      booking_date: '2026-05-23',
      start_time: '18:00',
      booking_table_assignments: [{ table_id: 'T-good' }],
    });

    let map: ReturnType<typeof buildBusyMaps> | undefined;
    expect(() => {
      map = buildBusyMaps({
        targetBookingId: 'target',
        bookings: [malformed, wellFormed],
        holds: [],
        policy,
      });
    }).not.toThrow();

    expect(map?.has('T-good')).toBe(true);
    expect(map?.has('T-bad')).toBe(false);
  });
});
