import { describe, expect, it } from 'vitest';

import { getVenuePolicy } from '@/server/capacity/policy';
import { buildBusyMaps } from '@/server/capacity/table-assignment/availability';

import type { TableHold } from '@/server/capacity/holds';
import type { ContextBookingRow } from '@/server/capacity/table-assignment/supabase';

// GAP #8 regression: a context booking that carries table assignments but lacks
// sufficient temporal data (null start_at AND null booking_date/start_time) makes
// computeBookingWindowWithFallback throw (ManualSelectionInputError). Previously the
// unguarded call inside buildBusyMaps let that throw abort the ENTIRE busy-map build
// for the current assignment, dropping every well-formed booking from the map (and
// crashing the lookahead). The malformed booking must instead be SKIPPED while every
// well-formed booking is still represented.
function makeBooking(overrides: Partial<ContextBookingRow> & { id: string }): ContextBookingRow {
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
    booking_table_assignments: overrides.booking_table_assignments ?? null,
  };
}

describe('buildBusyMaps null temporal fields (regression)', () => {
  const policy = getVenuePolicy({ timezone: 'Europe/London' });

  // A booking with a concrete start_at and a table assignment -> a valid window.
  const wellFormed = makeBooking({
    id: 'booking-well-formed',
    start_at: '2026-05-23T18:30:00.000Z',
    booking_table_assignments: [{ table_id: 'table-well-formed' }],
  });

  // A booking that has a table assignment but no temporal data at all.
  // computeBookingWindowWithFallback throws ManualSelectionInputError on this row.
  const malformed = makeBooking({
    id: 'booking-malformed',
    start_at: null,
    booking_date: null,
    start_time: null,
    booking_table_assignments: [{ table_id: 'table-malformed' }],
  });

  const holds: TableHold[] = [];

  it('does not throw when a context booking lacks start_at/booking_date/start_time', () => {
    expect(() =>
      buildBusyMaps({
        targetBookingId: 'booking-target',
        // Malformed row listed FIRST so the old (unguarded) code throws before the
        // well-formed booking is ever processed.
        bookings: [malformed, wellFormed],
        holds,
        policy,
      }),
    ).not.toThrow();
  });

  it('still represents the well-formed booking and skips the malformed one', () => {
    const map = buildBusyMaps({
      targetBookingId: 'booking-target',
      bookings: [malformed, wellFormed],
      holds,
      policy,
    });

    // Well-formed booking's table must be present with its busy window attributed
    // to that booking.
    const wellFormedEntry = map.get('table-well-formed');
    expect(wellFormedEntry).toBeDefined();
    expect(
      wellFormedEntry!.windows.some((w) => w.bookingId === 'booking-well-formed'),
    ).toBe(true);

    // The malformed booking contributed no usable window, so its table is absent.
    expect(map.has('table-malformed')).toBe(false);
  });
});
