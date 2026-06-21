import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';

import {
  buildOpsBookingsPrintTableRow,
  buildOpsBookingsPrintViewState,
  parseOpsBookingsPrintParams,
  shouldAllowPrintTableAssignments,
} from '@/components/features/dashboard/opsBookingsPrintViewDomain';

import type { OpsTodayBooking, OpsTodayBookingsSummary } from '@/types/ops';

function makeBooking(overrides: Partial<OpsTodayBooking> = {}): OpsTodayBooking {
  return {
    id: overrides.id ?? 'booking-1',
    status: overrides.status ?? 'confirmed',
    startTime: overrides.startTime ?? '19:00',
    endTime: overrides.endTime ?? '20:30',
    partySize: overrides.partySize ?? 2,
    customerName: overrides.customerName ?? 'Alex Guest',
    customerEmail: overrides.customerEmail ?? 'alex@example.com',
    customerPhone: overrides.customerPhone ?? null,
    notes: overrides.notes ?? null,
    reference: overrides.reference ?? 'REF-1',
    details: overrides.details ?? null,
    source: overrides.source ?? null,
    tableAssignments: overrides.tableAssignments ?? [],
    requiresTableAssignment: overrides.requiresTableAssignment ?? false,
    checkedInAt: overrides.checkedInAt ?? null,
    checkedOutAt: overrides.checkedOutAt ?? null,
    ...overrides,
  };
}

function makeSummary(bookings: OpsTodayBooking[] = []): OpsTodayBookingsSummary {
  return {
    date: '2026-05-20',
    timezone: 'Europe/London',
    restaurantId: 'restaurant-1',
    meta: {
      date: '2026-05-20',
      timezone: 'Europe/London',
      restaurantId: 'restaurant-1',
    },
    totals: {
      total: bookings.length,
      confirmed: 0,
      completed: 0,
      pending: 0,
      cancelled: 0,
      noShow: 0,
      upcoming: bookings.length,
      covers: bookings.reduce((total, booking) => total + booking.partySize, 0),
    },
    bookings,
  };
}

describe('opsBookingsPrintViewDomain', () => {
  it('parses print params with date sanitization and safe sort/filter fallbacks', () => {
    expect(
      parseOpsBookingsPrintParams({
        date: ['2026-05-20', '2026-05-21'],
        filter: 'completed',
        search: '  Alex  ',
        sortKey: 'party',
        sortDir: 'desc',
      }),
    ).toEqual({
      filter: 'finished',
      parsedDate: '2026-05-20',
      searchQuery: 'Alex',
      sortDir: 'desc',
      sortKey: 'party',
      targetDate: '2026-05-20',
    });

    expect(
      parseOpsBookingsPrintParams({
        date: 'not-a-date',
        filter: 'unknown',
        sortKey: 'unknown',
        sortDir: 'sideways',
      }),
    ).toMatchObject({
      filter: 'all',
      parsedDate: null,
      searchQuery: '',
      sortDir: 'asc',
      sortKey: 'time',
      targetDate: null,
    });
  });

  it('filters by search and keeps all-filter status grouping before time sort', () => {
    const summary = makeSummary([
      makeBooking({
        id: 'completed',
        status: 'completed',
        startTime: '17:00',
        customerName: 'Completed Guest',
      }),
      makeBooking({
        id: 'upcoming',
        status: 'confirmed',
        startTime: '19:00',
        customerName: 'Alex Arrival',
      }),
      makeBooking({
        id: 'seated',
        status: 'checked_in',
        startTime: '21:00',
        customerName: 'Seated Guest',
      }),
    ]);

    const state = buildOpsBookingsPrintViewState({
      allowTableAssignments: true,
      filter: 'all',
      now: DateTime.fromISO('2026-05-20T18:00:00', { zone: 'Europe/London' }),
      searchQuery: '',
      sortDir: 'asc',
      sortKey: 'time',
      summary,
    });

    expect(state.sortedBookings.map((booking) => booking.id)).toEqual([
      'seated',
      'upcoming',
      'completed',
    ]);

    const searched = buildOpsBookingsPrintViewState({
      allowTableAssignments: true,
      filter: 'all',
      now: DateTime.fromISO('2026-05-20T18:00:00', { zone: 'Europe/London' }),
      searchQuery: 'arrival',
      sortDir: 'asc',
      sortKey: 'time',
      summary,
    });

    expect(searched.sortedBookings.map((booking) => booking.id)).toEqual(['upcoming']);
  });

  it('builds print table rows with fallback labels and de-duplicated table numbers', () => {
    const row = buildOpsBookingsPrintTableRow(
      makeBooking({
        id: 'booking-table',
        customerName: '   ',
        notes: '  Window seat  ',
        tableAssignments: [
          {
            groupId: 'group-1',
            capacitySum: 4,
            members: [
              { tableId: 'table-1', tableNumber: '12', capacity: 2, section: 'Main' },
              { tableId: 'table-2', tableNumber: '12', capacity: 2, section: 'Main' },
              { tableId: 'table-3', tableNumber: '14', capacity: 2, section: 'Main' },
            ],
          },
        ],
      }),
      'Europe/London',
    );

    expect(row).toMatchObject({
      id: 'booking-table',
      nameLabel: 'Walk-in Guest',
      notesLabel: 'Window seat',
      partySize: 2,
      tableLabel: '12, 14',
    });
    expect(row.timeLabel).toContain('19:00');
  });

  it('allows table assignments only for ready summaries on today or future dates', () => {
    const futureSummary = { ...makeSummary(), date: '2999-01-01' };
    const pastSummary = { ...futureSummary, date: '2020-01-01' };

    expect(shouldAllowPrintTableAssignments(null, false)).toBe(true);
    expect(shouldAllowPrintTableAssignments(futureSummary, false)).toBe(true);
    expect(shouldAllowPrintTableAssignments(pastSummary, true)).toBe(false);
  });
});
