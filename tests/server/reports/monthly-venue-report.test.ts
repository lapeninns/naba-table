import { DateTime, Settings } from 'luxon';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getServiceSupabaseClientMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/supabase', () => ({
  getServiceSupabaseClient: getServiceSupabaseClientMock,
}));

import {
  computeMonthlyVenueReport,
  isFirstWednesdayOfMonth,
} from '@/server/reports/monthly-venue-report';

const RESTAURANT_ID = '11111111-1111-4111-8111-111111111111';

type QueryCall = { method: string; args: unknown[] };
type RecordedQuery = { table: string; calls: QueryCall[] };

function createSupabaseStub(
  resolve: (query: RecordedQuery) => { data?: unknown; error?: unknown },
) {
  const queries: RecordedQuery[] = [];
  const from = vi.fn((table: string) => {
    const query: RecordedQuery = { table, calls: [] };
    queries.push(query);
    const builder: Record<string, unknown> = {};
    for (const method of ['select', 'eq', 'gte', 'lte', 'lt', 'is', 'not', 'in', 'order']) {
      builder[method] = (...args: unknown[]) => {
        query.calls.push({ method, args });
        return builder;
      };
    }
    builder.maybeSingle = () => {
      query.calls.push({ method: 'maybeSingle', args: [] });
      return Promise.resolve().then(() => resolve(query));
    };
    builder.then = (
      onFulfilled?: (value: unknown) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) =>
      Promise.resolve()
        .then(() => resolve(query))
        .then(onFulfilled, onRejected);
    return builder;
  });
  return { client: { from }, queries };
}

const hasCall = (query: RecordedQuery, method: string) =>
  query.calls.some((call) => call.method === method);
const argsOf = (query: RecordedQuery, method: string) =>
  query.calls.find((call) => call.method === method)?.args;

type Dataset = {
  venue?: { data: unknown; error: unknown };
  monthBookings?: unknown[];
  hours?: unknown[];
  customers?: unknown[];
  monthEmails?: unknown[];
  monthSms?: unknown[];
  allBookings?: unknown[];
  allEmails?: unknown[];
  allSms?: unknown[];
};

function makeVenue(overrides: Record<string, unknown> = {}) {
  return {
    id: RESTAURANT_ID,
    name: 'The Golden Fork',
    timezone: 'Europe/London',
    contact_email: 'owner@example.com',
    manager_name: 'Priya',
    ...overrides,
  };
}

function installDataset(dataset: Dataset) {
  const stub = createSupabaseStub((query) => {
    switch (query.table) {
      case 'restaurants':
        return dataset.venue ?? { data: makeVenue(), error: null };
      case 'bookings':
        return {
          data: hasCall(query, 'gte')
            ? dataset.monthBookings ?? []
            : dataset.allBookings ?? dataset.monthBookings ?? [],
          error: null,
        };
      case 'restaurant_operating_hours':
        return { data: dataset.hours ?? [], error: null };
      case 'customers':
        return { data: dataset.customers ?? [], error: null };
      case 'email_delivery_log':
        return {
          data: hasCall(query, 'gte')
            ? dataset.monthEmails ?? []
            : dataset.allEmails ?? dataset.monthEmails ?? [],
          error: null,
        };
      case 'sms_delivery_log':
        return {
          data: hasCall(query, 'gte')
            ? dataset.monthSms ?? []
            : dataset.allSms ?? dataset.monthSms ?? [],
          error: null,
        };
      default:
        throw new Error(`Unexpected table ${query.table}`);
    }
  });
  getServiceSupabaseClientMock.mockReturnValue(stub.client);
  return stub;
}

function booking(overrides: Record<string, unknown> = {}) {
  return {
    customer_id: 'cust-1',
    status: 'confirmed',
    party_size: 2,
    booking_date: '2026-06-05',
    booking_type: 'lunch',
    source: 'api',
    created_at: '2026-06-01T10:00:00Z',
    ...overrides,
  };
}

const fullWeekHours = Array.from({ length: 7 }, (_, dow) => ({
  day_of_week: dow,
  opens_at: '09:00',
  closes_at: '23:00',
  is_closed: false,
}));

describe('computeMonthlyVenueReport', () => {
  beforeEach(() => {
    getServiceSupabaseClientMock.mockReset();
  });

  it('@contract aggregates covers, booking mix, guests, communications and moments for a mixed month', async () => {
    installDataset({
      monthBookings: [
        booking({ customer_id: 'c1', status: 'confirmed', party_size: 3, booking_date: '2026-06-05', source: 'api', created_at: '2026-06-01T10:00:00Z' }),
        booking({ customer_id: 'c2', status: 'completed', party_size: 4, booking_date: '2026-06-05', source: 'walk-in', created_at: '2026-06-02T11:00:00Z' }),
        booking({ customer_id: 'c3', status: 'cancelled', party_size: 3, booking_date: '2026-06-10', booking_type: 'dinner', source: 'api', created_at: '2026-06-03T09:00:00Z' }),
        booking({ customer_id: 'c1', status: 'no_show', party_size: 2, booking_date: '2026-06-12', booking_type: 'dinner', source: 'api', created_at: '2026-06-04T20:00:00Z' }),
        booking({ customer_id: 'c2', status: 'checked_in', party_size: 6, booking_date: '2026-06-21', source: 'walk-in', created_at: '2026-06-05T12:00:00Z' }),
      ],
      hours: fullWeekHours,
      customers: [
        { id: 'c1', created_at: '2026-05-20T09:00:00Z' },
        { id: 'c2', created_at: '2026-06-02T11:00:00Z' },
        { id: 'c3', created_at: '2026-06-03T09:00:00Z' },
      ],
      monthEmails: [
        { message_id: 'm1', template_type: 'reminder_24h' },
        { message_id: 'm1', template_type: 'reminder_24h' }, // delivered webhook row for the same send
        { message_id: 'm2', template_type: 'review_request' },
        { message_id: 'm3', template_type: 'modification_confirmed' },
        { message_id: 'm4', template_type: 'cancelled' },
      ],
      monthSms: [{ message_sid: 's1' }, { message_sid: 's1' }, { message_sid: 's2' }],
      allBookings: [
        { status: 'completed', party_size: 10, booking_date: '2025-12-15' },
        { status: 'confirmed', party_size: 3, booking_date: '2026-06-05' },
        { status: 'completed', party_size: 4, booking_date: '2026-06-05' },
        { status: 'cancelled', party_size: 3, booking_date: '2026-06-10' },
        { status: 'no_show', party_size: 2, booking_date: '2026-06-12' },
        { status: 'checked_in', party_size: 6, booking_date: '2026-06-21' },
      ],
      allEmails: [
        { message_id: 'm0' },
        { message_id: 'm1' },
        { message_id: 'm2' },
        { message_id: 'm3' },
        { message_id: 'm4' },
      ],
      allSms: [{ message_sid: 's0' }, { message_sid: 's1' }, { message_sid: 's2' }],
    });

    const report = await computeMonthlyVenueReport(RESTAURANT_ID, { year: 2026, month: 6 });

    expect(report).not.toBeNull();
    expect(report!.restaurantName).toBe('The Golden Fork');
    expect(report!.managerName).toBe('Priya');
    expect(report!.month).toBe('June 2026');
    expect(report!.monthName).toBe('June');
    expect(report!.timezone).toBe('Europe/London');

    // Covers only count ACTIVE statuses (cancelled + no_show excluded).
    expect(report!.covers).toEqual({ active: 13, fromBookings: 3 });

    // Booking mix: source 'api' is online, 'walk-in' is not; totals include every status.
    expect(report!.bookings).toEqual({
      total: 5,
      onlinePercent: 60,
      completedCount: 1,
      cancelledCount: 1,
      noShowCount: 1,
      noShowPercent: 20,
    });

    // Guests: c2's customer row was created this month -> first-time; c1 predates -> returning.
    expect(report!.guests).toEqual({ firstTime: 1, returning: 1 });

    // All bookings were made inside opening hours.
    expect(report!.timing).toEqual({ afterHoursCount: 0, afterHoursPercent: 0 });

    // Emails dedupe on message_id; template buckets count distinct messages.
    expect(report!.communications).toEqual({
      emailsSent: 4,
      remindersSent: 1,
      reviewRequestsSent: 1,
      changesSentCount: 2,
      smsSent: 2,
    });

    expect(report!.moments).toEqual({
      busiestDateLabel: 'Friday 5 June',
      busiestService: 'Lunch',
      busiestCovers: 7,
      biggestParty: 6,
      repeatGuests: 1,
    });

    expect(report!.quietestDay).toEqual({ dayName: 'Sunday', avgCoversPerDay: 6 });

    expect(report!.lifetime).toEqual({
      coversActive: 23,
      bookingsActive: 4,
      messagesSent: 8,
      joinedLabel: 'December 2025',
    });
  });

  it('@contract @security scopes every query to the venue and builds the month window in the venue timezone', async () => {
    const stub = installDataset({
      venue: { data: makeVenue({ timezone: 'America/New_York' }), error: null },
      monthBookings: [booking()],
    });

    await computeMonthlyVenueReport(RESTAURANT_ID, { year: 2026, month: 6 });

    const venueQuery = stub.queries.find((q) => q.table === 'restaurants')!;
    expect(argsOf(venueQuery, 'eq')).toEqual(['id', RESTAURANT_ID]);
    expect(hasCall(venueQuery, 'maybeSingle')).toBe(true);

    for (const query of stub.queries.filter((q) => q.table !== 'restaurants')) {
      expect(argsOf(query, 'eq')).toEqual(['restaurant_id', RESTAURANT_ID]);
    }

    const monthBookingsQuery = stub.queries.find(
      (q) => q.table === 'bookings' && hasCall(q, 'gte'),
    )!;
    expect(argsOf(monthBookingsQuery, 'gte')).toEqual(['booking_date', '2026-06-01']);
    expect(argsOf(monthBookingsQuery, 'lte')).toEqual(['booking_date', '2026-06-30']);

    // June in America/New_York is UTC-4, so the comms window shifts by 4 hours.
    const monthEmailQuery = stub.queries.find(
      (q) => q.table === 'email_delivery_log' && hasCall(q, 'gte'),
    )!;
    expect(argsOf(monthEmailQuery, 'gte')).toEqual(['occurred_at', '2026-06-01T04:00:00.000Z']);
    expect(argsOf(monthEmailQuery, 'lt')).toEqual(['occurred_at', '2026-07-01T04:00:00.000Z']);

    const hoursQuery = stub.queries.find((q) => q.table === 'restaurant_operating_hours')!;
    expect(argsOf(hoursQuery, 'is')).toEqual(['effective_date', null]);
  });

  it('@contract spans a DST-shifting month rollover for Europe/London July', async () => {
    const stub = installDataset({
      venue: { data: makeVenue({ timezone: 'Europe/London' }), error: null },
      monthBookings: [booking({ booking_date: '2026-07-04' })],
    });

    const report = await computeMonthlyVenueReport(RESTAURANT_ID, { year: 2026, month: 7 });

    expect(report!.month).toBe('July 2026');
    const monthBookingsQuery = stub.queries.find(
      (q) => q.table === 'bookings' && hasCall(q, 'gte'),
    )!;
    expect(argsOf(monthBookingsQuery, 'gte')).toEqual(['booking_date', '2026-07-01']);
    expect(argsOf(monthBookingsQuery, 'lte')).toEqual(['booking_date', '2026-07-31']);

    // July in London is BST (UTC+1): the UTC window starts the evening before.
    const monthSmsQuery = stub.queries.find(
      (q) => q.table === 'sms_delivery_log' && hasCall(q, 'gte'),
    )!;
    expect(argsOf(monthSmsQuery, 'gte')).toEqual(['occurred_at', '2026-06-30T23:00:00.000Z']);
    expect(argsOf(monthSmsQuery, 'lt')).toEqual(['occurred_at', '2026-07-31T23:00:00.000Z']);
  });

  it('@contract defaults a missing venue timezone to UTC', async () => {
    const stub = installDataset({
      venue: { data: makeVenue({ timezone: null }), error: null },
      monthBookings: [booking()],
    });

    const report = await computeMonthlyVenueReport(RESTAURANT_ID, { year: 2026, month: 6 });

    expect(report!.timezone).toBe('UTC');
    const monthEmailQuery = stub.queries.find(
      (q) => q.table === 'email_delivery_log' && hasCall(q, 'gte'),
    )!;
    expect(argsOf(monthEmailQuery, 'gte')).toEqual(['occurred_at', '2026-06-01T00:00:00.000Z']);
  });

  it('@contract returns null when the venue lookup errors or the venue is missing', async () => {
    installDataset({ venue: { data: null, error: { message: 'boom' } } });
    await expect(
      computeMonthlyVenueReport(RESTAURANT_ID, { year: 2026, month: 6 }),
    ).resolves.toBeNull();

    installDataset({ venue: { data: null, error: null } });
    await expect(
      computeMonthlyVenueReport(RESTAURANT_ID, { year: 2026, month: 6 }),
    ).resolves.toBeNull();
  });

  it('@contract returns null for an empty month even when communications exist', async () => {
    installDataset({
      monthBookings: [],
      monthEmails: [{ message_id: 'm1', template_type: 'reminder_24h' }],
    });

    await expect(
      computeMonthlyVenueReport(RESTAURANT_ID, { year: 2026, month: 6 }),
    ).resolves.toBeNull();
  });

  it('@contract classifies bookings made while closed as after-hours in the venue timezone (incl. overnight windows)', async () => {
    installDataset({
      venue: { data: makeVenue({ timezone: 'America/New_York' }), error: null },
      hours: [
        { day_of_week: 2, opens_at: '10:00', closes_at: '22:00', is_closed: false },
        { day_of_week: 3, opens_at: '10:00', closes_at: '22:00', is_closed: false },
        // Friday service runs past midnight.
        { day_of_week: 5, opens_at: '18:00', closes_at: '02:00', is_closed: false },
      ],
      monthBookings: [
        // Tue 2 June 22:30 local (02:30Z on the 3rd) -> after the 22:00 close.
        booking({ created_at: '2026-06-03T02:30:00Z', booking_date: '2026-06-10' }),
        // Wed 3 June 11:00 local -> inside opening hours.
        booking({ created_at: '2026-06-03T15:00:00Z', booking_date: '2026-06-11' }),
        // Fri 5 June 22:00 local -> inside the overnight 18:00-02:00 window.
        booking({ created_at: '2026-06-06T02:00:00Z', booking_date: '2026-06-12' }),
      ],
    });

    const report = await computeMonthlyVenueReport(RESTAURANT_ID, { year: 2026, month: 6 });

    expect(report!.timing).toEqual({ afterHoursCount: 1, afterHoursPercent: 33 });
  });

  it('@contract treats a venue with no usable operating hours as closed for every booking', async () => {
    installDataset({
      hours: [{ day_of_week: 1, opens_at: '10:00', closes_at: '22:00', is_closed: true }],
      monthBookings: [booking(), booking({ created_at: '2026-06-02T12:00:00Z' })],
    });

    const report = await computeMonthlyVenueReport(RESTAURANT_ID, { year: 2026, month: 6 });

    expect(report!.timing).toEqual({ afterHoursCount: 2, afterHoursPercent: 100 });
  });

  it('@contract counts a message again when only its delivered/opened webhook row falls inside the month (KNOWN-ISSUE)', async () => {
    // KNOWN-ISSUE: server/reports/monthly-venue-report.ts:140-151 selects email/sms
    // event rows with no status filter, and :229-249 dedupes by message_id within the
    // month window only. A message SENT in May whose 'delivered'/'opened' webhook row
    // lands in June is therefore re-counted as a June "email sent". Correct behavior
    // would count only send events (filter status='sent') so webhook-derived rows
    // never inflate a later month's totals.
    const stub = installDataset({
      monthBookings: [booking()],
      monthEmails: [
        // The only June row for this message is its delivered webhook event.
        { message_id: 'msg-sent-in-may', template_type: 'reminder_24h' },
      ],
    });

    const report = await computeMonthlyVenueReport(RESTAURANT_ID, { year: 2026, month: 6 });

    expect(report!.communications.emailsSent).toBe(1);
    expect(report!.communications.remindersSent).toBe(1);

    // Pin the mechanism: the month query never filters on an event-status column.
    const monthEmailQuery = stub.queries.find(
      (q) => q.table === 'email_delivery_log' && hasCall(q, 'gte'),
    )!;
    const eqArgs = monthEmailQuery.calls.filter((c) => c.method === 'eq').map((c) => c.args[0]);
    expect(eqArgs).toEqual(['restaurant_id']);
  });

  it('@contract counts a guest who booked ahead last month as returning on their first-visit month (KNOWN-ISSUE)', async () => {
    // KNOWN-ISSUE: server/reports/monthly-venue-report.ts:179-197 keys "first-time"
    // to the month the CUSTOMER ROW was created (when the booking was made), not the
    // month of the first visit. A guest who booked in May for a June meal is counted
    // as "returning" in June — their actual first visit month. Correct behavior would
    // derive first-visit from the earliest active booking_date per customer. (This is
    // the code-side successor of the stale first_booking_at prod bug: the module
    // avoids first_booking_at entirely but still misclassifies book-ahead guests.)
    installDataset({
      monthBookings: [
        booking({ customer_id: 'c9', status: 'confirmed', booking_date: '2026-06-10' }),
      ],
      customers: [{ id: 'c9', created_at: '2026-05-28T19:00:00Z' }],
    });

    const report = await computeMonthlyVenueReport(RESTAURANT_ID, { year: 2026, month: 6 });

    expect(report!.guests).toEqual({ firstTime: 0, returning: 1 });
  });

  it('@contract attributes cancellations to the meal month, hiding same-month cancellations of future bookings (KNOWN-ISSUE)', async () => {
    // KNOWN-ISSUE: server/reports/monthly-venue-report.ts:125-130 selects the month's
    // bookings by booking_date and :175 counts status='cancelled' within that set. A
    // booking cancelled IN June for a July date is invisible to June's cancelledCount
    // (it surfaces a month late), and bookings hard-deleted on cancellation (the
    // missing-cancel-history prod bug) are never counted at all. Correct behavior
    // needs cancellation-event history keyed to when the cancellation happened.
    installDataset({
      monthBookings: [booking({ status: 'confirmed', booking_date: '2026-06-10' })],
      allBookings: [
        { status: 'confirmed', party_size: 2, booking_date: '2026-06-10' },
        // Cancelled during June but the meal was for July.
        { status: 'cancelled', party_size: 4, booking_date: '2026-07-02' },
      ],
    });

    const report = await computeMonthlyVenueReport(RESTAURANT_ID, { year: 2026, month: 6 });

    expect(report!.bookings.cancelledCount).toBe(0);
    expect(report!.bookings.total).toBe(1);
  });

  it('@contract survives malformed rows: null statuses, party sizes, ids, dates and unparsable times', async () => {
    installDataset({
      monthBookings: [
        booking({
          customer_id: null,
          status: null,
          party_size: null,
          booking_date: '2026-06-02',
          booking_type: null,
          source: null,
          created_at: null,
        }),
        booking({
          customer_id: null,
          status: 'confirmed',
          party_size: null,
          booking_date: null,
          source: null,
          created_at: 'not-a-timestamp',
        }),
      ],
      hours: [
        { day_of_week: null, opens_at: '10:00', closes_at: '22:00', is_closed: false },
        { day_of_week: 2, opens_at: 'garbage', closes_at: '22:00', is_closed: false },
      ],
      customers: [{ id: 'c1', created_at: null }],
      monthEmails: [{ message_id: 'm1', template_type: null }],
    });

    const report = await computeMonthlyVenueReport(RESTAURANT_ID, { year: 2026, month: 6 });

    expect(report).not.toBeNull();
    expect(report!.covers).toEqual({ active: 0, fromBookings: 1 });
    expect(report!.bookings.total).toBe(2);
    expect(report!.bookings.onlinePercent).toBe(0);
    // Null created_at rows are skipped; the unparsable one falls outside every
    // window and counts as after-hours.
    expect(report!.timing).toEqual({ afterHoursCount: 1, afterHoursPercent: 50 });
    expect(report!.guests).toEqual({ firstTime: 0, returning: 0 });
    expect(report!.moments.busiestDateLabel).toBeNull();
    expect(report!.moments.biggestParty).toBe(0);
    expect(report!.quietestDay).toBeNull();
    expect(report!.communications.emailsSent).toBe(1);
    expect(report!.communications.remindersSent).toBe(0);
  });

  it('@contract reports a month of only cancelled and no-show bookings without moments', async () => {
    installDataset({
      monthBookings: [
        booking({ status: 'cancelled', party_size: 4, booking_date: '2026-06-02' }),
        booking({ status: 'cancelled', party_size: 2, booking_date: '2026-06-03' }),
        booking({ status: 'no_show', party_size: 5, booking_date: '2026-06-04' }),
      ],
    });

    const report = await computeMonthlyVenueReport(RESTAURANT_ID, { year: 2026, month: 6 });

    expect(report!.covers).toEqual({ active: 0, fromBookings: 0 });
    expect(report!.bookings).toMatchObject({
      total: 3,
      completedCount: 0,
      cancelledCount: 2,
      noShowCount: 1,
      noShowPercent: 33.3,
    });
    expect(report!.guests).toEqual({ firstTime: 0, returning: 0 });
    expect(report!.moments.busiestDateLabel).toBeNull();
    expect(report!.quietestDay).toBeNull();
    // Cancelled rows still anchor the joined label (earliest booking_date of any status).
    expect(report!.lifetime).toMatchObject({
      coversActive: 0,
      bookingsActive: 0,
      joinedLabel: 'June 2026',
    });
  });
});

describe('isFirstWednesdayOfMonth', () => {
  afterEach(() => {
    Settings.defaultZone = 'system';
    vi.useRealTimers();
  });

  it('@contract @worker accepts only Wednesdays that fall on days 1-7', () => {
    const zone = 'utc';
    expect(isFirstWednesdayOfMonth(DateTime.fromISO('2026-07-01T09:00:00', { zone }))).toBe(true);
    expect(isFirstWednesdayOfMonth(DateTime.fromISO('2026-08-05T09:00:00', { zone }))).toBe(true);
    // Second Wednesday.
    expect(isFirstWednesdayOfMonth(DateTime.fromISO('2026-07-08T09:00:00', { zone }))).toBe(false);
    // Day <= 7 but not a Wednesday.
    expect(isFirstWednesdayOfMonth(DateTime.fromISO('2026-07-04T09:00:00', { zone }))).toBe(false);
    expect(isFirstWednesdayOfMonth(DateTime.fromISO('2026-07-02T09:00:00', { zone }))).toBe(false);
  });

  it('@contract @worker defaults to the current clock when no reference is given', () => {
    vi.useFakeTimers();
    Settings.defaultZone = 'utc';

    vi.setSystemTime(new Date('2026-07-01T12:00:00Z'));
    expect(isFirstWednesdayOfMonth()).toBe(true);

    vi.setSystemTime(new Date('2026-07-08T12:00:00Z'));
    expect(isFirstWednesdayOfMonth()).toBe(false);
  });
});
