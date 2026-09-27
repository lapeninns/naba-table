import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';

import {
  DEFAULT_RUN_SHEET_PREFERENCES,
  buildOpsRunSheet,
  buildRunSheetRow,
  parseOpsBookingsPrintParams,
  parseRunSheetPreferences,
  planRunSheetColumns,
  shouldAllowPrintTableAssignments,
} from '@/components/features/dashboard/opsBookingsPrintViewDomain';

import type { OpsTodayBooking, OpsTodayBookingsSummary } from '@/types/ops';

const DATE = '2026-05-20';
const ZONE = 'Europe/London';

function makeBooking(overrides: Partial<OpsTodayBooking> = {}): OpsTodayBooking {
  return {
    id: 'booking-1',
    status: 'confirmed',
    bookingType: 'dinner',
    startTime: '19:00:00',
    endTime: '20:30:00',
    partySize: 2,
    customerName: 'Alex Guest',
    customerEmail: 'alex@example.com',
    customerPhone: null,
    notes: null,
    reference: 'REF-1',
    details: null,
    source: null,
    tableAssignments: [],
    requiresTableAssignment: true,
    checkedInAt: null,
    checkedOutAt: null,
    ...overrides,
  };
}

function table(tableNumber: string, section: string | null = 'Main') {
  return {
    groupId: null,
    capacitySum: 2,
    members: [{ tableId: `t-${tableNumber}`, tableNumber, capacity: 2, section }],
  };
}

function makeSummary(bookings: OpsTodayBooking[] = [], date = DATE): OpsTodayBookingsSummary {
  return {
    date,
    timezone: ZONE,
    restaurantId: 'restaurant-1',
    meta: { date, timezone: ZONE, restaurantId: 'restaurant-1' },
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

const at = (time: string, date = DATE) => DateTime.fromISO(`${date}T${time}`, { zone: ZONE });

function sheet(
  bookings: OpsTodayBooking[],
  overrides: Partial<Parameters<typeof buildOpsRunSheet>[0]> = {},
) {
  return buildOpsRunSheet({
    summary: makeSummary(bookings),
    filter: 'all',
    searchQuery: '',
    sortKey: 'time',
    sortDir: 'asc',
    groupMode: 'service',
    now: at('18:00'),
    today: DATE,
    ...overrides,
  });
}

describe('parseOpsBookingsPrintParams', () => {
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
    ).toMatchObject({ filter: 'all', parsedDate: null, sortDir: 'asc', sortKey: 'time' });
  });
});

describe('parseRunSheetPreferences', () => {
  it('returns defaults for missing or malformed stored values', () => {
    expect(parseRunSheetPreferences(null)).toEqual(DEFAULT_RUN_SHEET_PREFERENCES);
    expect(parseRunSheetPreferences('nonsense')).toEqual(DEFAULT_RUN_SHEET_PREFERENCES);
    expect(parseRunSheetPreferences([1, 2])).toEqual(DEFAULT_RUN_SHEET_PREFERENCES);
  });

  it('keeps valid fields and drops invalid ones field by field', () => {
    expect(
      parseRunSheetPreferences({
        groupMode: 'status',
        paper: 'sideways',
        density: 'compact',
        view: 'list',
        columns: { phone: true, notes: 'yes', unknown: true },
      }),
    ).toEqual({
      ...DEFAULT_RUN_SHEET_PREFERENCES,
      groupMode: 'status',
      density: 'compact',
      view: 'list',
      columns: { ...DEFAULT_RUN_SHEET_PREFERENCES.columns, phone: true },
    });
  });

  it('keeps the guest phone column off by default', () => {
    expect(DEFAULT_RUN_SHEET_PREFERENCES.columns.phone).toBe(false);
  });
});

describe('buildRunSheetRow', () => {
  it('builds labels, joined tables, sections and dietary flags', () => {
    const row = buildRunSheetRow(
      makeBooking({
        customerName: '  ',
        notes: '  Window seat  ',
        customerPhone: '07700 900111',
        allergies: ['Peanuts', ' '],
        dietaryRestrictions: ['Vegan'],
        tableAssignments: [table('7', 'Restaurant'), table('8', 'Restaurant'), table('7')],
        requiresTableAssignment: false,
      }),
      { summary: makeSummary(), now: at('18:00'), isToday: true },
    );

    expect(row).toMatchObject({
      guestLabel: 'Walk-in guest',
      notes: 'Window seat',
      phone: '07700 900111',
      startLabel: '19:00',
      endLabel: '20:30',
      tableNumbers: ['7', '8'],
      tableSections: ['Restaurant', 'Main'],
      allergies: ['Peanuts'],
      dietary: ['Vegan'],
      isUnassigned: false,
      category: 'upcoming',
      statusLabel: 'Confirmed',
      statusTone: 'confirmed',
      serviceKey: 'dinner',
      lateMinutes: null,
    });
  });

  it('flags late arrivals only on the live day and only after the grace period', () => {
    const booking = makeBooking({ startTime: '18:00:00' });
    const summary = makeSummary([booking]);

    expect(
      buildRunSheetRow(booking, { summary, now: at('18:10'), isToday: true }).lateMinutes,
    ).toBeNull();
    expect(
      buildRunSheetRow(booking, { summary, now: at('18:25'), isToday: true }).lateMinutes,
    ).toBe(25);
    expect(
      buildRunSheetRow(booking, { summary, now: at('18:25'), isToday: false }).lateMinutes,
    ).toBeNull();
    expect(
      buildRunSheetRow(
        { ...booking, status: 'checked_in' },
        { summary, now: at('18:25'), isToday: true },
      ).lateMinutes,
    ).toBeNull();
  });

  it('never reports finished bookings as unassigned', () => {
    const row = buildRunSheetRow(makeBooking({ status: 'cancelled' }), {
      summary: makeSummary(),
      now: at('18:00'),
      isToday: true,
    });
    expect(row).toMatchObject({ isUnassigned: false, category: 'finished', statusTone: 'done' });
  });
});

describe('buildOpsRunSheet', () => {
  const lunch = makeBooking({
    id: 'lunch',
    bookingType: 'lunch',
    startTime: '12:30:00',
    endTime: '14:00:00',
    partySize: 4,
    status: 'completed',
    tableAssignments: [table('2')],
    requiresTableAssignment: false,
  });
  const seated = makeBooking({
    id: 'seated',
    startTime: '17:30:00',
    endTime: '19:30:00',
    partySize: 6,
    status: 'checked_in',
    allergies: ['Shellfish'],
    tableAssignments: [table('5')],
    requiresTableAssignment: false,
  });
  const upcoming = makeBooking({ id: 'upcoming', customerName: 'Zed Arrival', partySize: 3 });
  const noShow = makeBooking({
    id: 'no-show',
    bookingType: 'lunch',
    startTime: '13:00:00',
    endTime: '14:30:00',
    status: 'no_show',
    partySize: 5,
  });

  it('groups by service with time spans and per-group active covers', () => {
    const result = sheet([upcoming, noShow, seated, lunch]);

    expect(result.groups.map((group) => [group.label, group.spanLabel, group.covers])).toEqual([
      ['Lunch', '12:30–14:30', 4],
      ['Dinner', '17:30–20:30', 9],
    ]);
    expect(result.groups[0]?.rows.map((row) => row.id)).toEqual(['lunch', 'no-show']);
  });

  it('groups by status in seated, upcoming, finished order', () => {
    const result = sheet([lunch, upcoming, seated], { groupMode: 'status' });
    expect(result.groups.map((group) => group.label)).toEqual(['Seated', 'Upcoming', 'Finished']);
  });

  it('returns one unlabelled group without grouping and honours sort direction', () => {
    const result = sheet([lunch, upcoming, seated], {
      groupMode: 'none',
      sortKey: 'party',
      sortDir: 'desc',
    });
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]?.label).toBeNull();
    expect(result.groups[0]?.rows.map((row) => row.id)).toEqual(['seated', 'lunch', 'upcoming']);
  });

  it('computes stats that exclude cancelled and no-show covers', () => {
    expect(sheet([lunch, seated, upcoming, noShow]).stats).toEqual({
      bookings: 4,
      covers: 13,
      lunchCovers: 4,
      dinnerCovers: 9,
      allergyFlags: 1,
      unassigned: 1,
    });
  });

  it('applies search before filter counts so chip counts match the sheet', () => {
    const result = sheet([lunch, seated, upcoming], { searchQuery: 'arrival' });
    expect(result.counts).toMatchObject({ all: 1, upcoming: 1, seated: 0, finished: 0 });
    expect(result.dayBookingCount).toBe(3);
    expect(result.matchingCount).toBe(1);
  });

  it('filters rows with the dashboard filter semantics', () => {
    const result = sheet([lunch, seated, upcoming, noShow], { filter: 'finished' });
    expect(result.groups.flatMap((group) => group.rows.map((row) => row.id))).toEqual([
      'lunch',
      'no-show',
    ]);
    expect(result.criteria).toMatchObject({
      filterLabel: 'Finished',
      sortLabel: 'time',
      sortDirLabel: 'earliest first',
    });
  });
});

describe('planRunSheetColumns', () => {
  it('merges dietary and notes into one detail column on portrait paper', () => {
    const keys = planRunSheetColumns(DEFAULT_RUN_SHEET_PREFERENCES).map((column) => column.key);
    expect(keys).toEqual(['tick', 'time', 'guest', 'party', 'table', 'status', 'detail']);
  });

  it('splits dietary and notes on landscape paper and drops hidden columns', () => {
    const keys = planRunSheetColumns({
      ...DEFAULT_RUN_SHEET_PREFERENCES,
      paper: 'landscape',
      columns: { ...DEFAULT_RUN_SHEET_PREFERENCES.columns, tick: false, status: false },
    }).map((column) => column.key);
    expect(keys).toEqual(['time', 'guest', 'party', 'table', 'diet', 'notes']);
  });

  it('leaves the last column flexible', () => {
    const columns = planRunSheetColumns(DEFAULT_RUN_SHEET_PREFERENCES);
    expect(columns.at(-1)?.widthMm).toBeNull();
    expect(columns.slice(0, -1).every((column) => typeof column.widthMm === 'number')).toBe(true);
  });
});

describe('shouldAllowPrintTableAssignments', () => {
  it('allows table assignments only for ready summaries on today or future dates', () => {
    const futureSummary = { ...makeSummary(), date: '2999-01-01' };
    const pastSummary = { ...futureSummary, date: '2020-01-01' };

    expect(shouldAllowPrintTableAssignments(null, false)).toBe(true);
    expect(shouldAllowPrintTableAssignments(futureSummary, false)).toBe(true);
    expect(shouldAllowPrintTableAssignments(pastSummary, true)).toBe(false);
  });
});
