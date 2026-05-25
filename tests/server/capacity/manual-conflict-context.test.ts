import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';

import { getVenuePolicy } from '@/server/capacity/policy';
import {
  buildManualAssignmentConflicts,
  buildManualWindowQuery,
} from '@/server/capacity/table-assignment/manual-conflict-context';

import type { TableHold } from '@/server/capacity/holds';
import type { ContextBookingRow } from '@/server/capacity/table-assignment/supabase';
import type { BookingWindow } from '@/server/capacity/table-assignment/types';

const window = {
  block: {
    start: DateTime.fromISO('2026-05-23T18:00:00.000Z'),
    end: DateTime.fromISO('2026-05-23T19:30:00.000Z'),
  },
} as BookingWindow;

function makeHold(overrides: Partial<TableHold> & { id: string }): TableHold {
  return {
    id: overrides.id,
    bookingId: overrides.bookingId ?? 'booking-2',
    restaurantId: overrides.restaurantId ?? 'restaurant-1',
    zoneId: overrides.zoneId ?? 'zone-1',
    tableIds: overrides.tableIds ?? ['table-1'],
    startAt: overrides.startAt ?? '2026-05-23T18:30:00',
    endAt: overrides.endAt ?? '2026-05-23T19:00:00',
    expiresAt: overrides.expiresAt ?? '2026-05-23T18:10:00',
    createdBy: overrides.createdBy ?? 'user-1',
    metadata: overrides.metadata ?? null,
  };
}

function makeBooking(overrides: Partial<ContextBookingRow> & { id: string }): ContextBookingRow {
  return {
    id: overrides.id,
    party_size: overrides.party_size ?? 2,
    status: overrides.status ?? 'confirmed',
    start_time: overrides.start_time ?? '18:15',
    end_time: overrides.end_time ?? null,
    start_at: overrides.start_at ?? null,
    end_at: overrides.end_at ?? null,
    booking_date: overrides.booking_date ?? '2026-05-23',
    booking_type: overrides.booking_type ?? 'dinner',
    seating_preference: overrides.seating_preference ?? null,
    booking_table_assignments: overrides.booking_table_assignments ?? [{ table_id: 'table-2' }],
  };
}

describe('manual conflict context', () => {
  it('serializes manual conflict window queries', () => {
    expect(buildManualWindowQuery(window)).toEqual({
      startIso: '2026-05-23T18:00:00',
      endIso: '2026-05-23T19:30:00',
    });
  });

  it('extracts hold conflicts for selected tables', () => {
    expect(
      buildManualAssignmentConflicts({
        bookings: [],
        holds: [makeHold({ id: 'hold-1', tableIds: ['table-1'] })],
        policy: getVenuePolicy({ timezone: 'Europe/London' }),
        tableIds: ['table-1'],
        targetBookingId: 'booking-1',
        window,
      }),
    ).toEqual([
      {
        tableId: 'table-1',
        bookingId: 'booking-2',
        startAt: '2026-05-23T18:30:00',
        endAt: '2026-05-23T19:00:00',
        source: 'hold',
      },
    ]);
  });

  it('excludes replaced holds from extracted conflicts', () => {
    expect(
      buildManualAssignmentConflicts({
        bookings: [],
        excludeHoldId: 'hold-1',
        holds: [makeHold({ id: 'hold-1', tableIds: ['table-1'] })],
        policy: getVenuePolicy({ timezone: 'Europe/London' }),
        tableIds: ['table-1'],
        targetBookingId: 'booking-1',
        window,
      }),
    ).toEqual([]);
  });

  it('extracts booking assignment conflicts for selected tables', () => {
    expect(
      buildManualAssignmentConflicts({
        bookings: [
          makeBooking({
            id: 'booking-2',
            booking_table_assignments: [{ table_id: 'table-1' }],
            start_at: '2026-05-23T18:30:00.000Z',
          }),
        ],
        holds: [],
        policy: getVenuePolicy({ timezone: 'Europe/London' }),
        tableIds: ['table-1'],
        targetBookingId: 'booking-1',
        window,
      }),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tableId: 'table-1',
          bookingId: 'booking-2',
          source: 'booking',
        }),
      ]),
    );
  });
});
