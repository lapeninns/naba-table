import { describe, expect, it } from 'vitest';

import {
  fetchMyBookingsPage,
  type MyBookingsPageQueryBuilder,
  type MyBookingsPageQueryClient,
  type MyBookingsPageQueryResult,
} from '@/server/bookings/my-bookings-page';

import type { MyBookingRow } from '@/server/bookings/my-bookings-dto';
import type { MyBookingsQuery } from '@/server/bookings/my-bookings-query';

const baseRow: MyBookingRow = {
  id: 'booking-1',
  restaurant_id: 'restaurant-1',
  booking_date: '2026-05-23',
  start_time: '18:30',
  end_time: '20:00',
  start_at: null,
  end_at: null,
  party_size: 4,
  status: 'confirmed',
  notes: null,
  restaurants: {
    id: 'restaurant-1',
    name: 'Old Crown',
    slug: 'old-crown',
    timezone: 'Europe/London',
    reservation_interval_minutes: 30,
  },
};

type QueryCall =
  | ['from', string]
  | ['select', string, { count: 'exact' }]
  | ['eq', string, string]
  | ['or', string]
  | ['in', string, readonly string[]]
  | ['gte', string, string]
  | ['lt', string, string]
  | ['order', string, { ascending: boolean }]
  | ['range', number, number];

function createQueryClient({
  result,
  rangeResult,
}: {
  result: MyBookingsPageQueryResult;
  rangeResult?: MyBookingsPageQueryResult;
}): { client: MyBookingsPageQueryClient; calls: QueryCall[] } {
  const calls: QueryCall[] = [];

  const builder: MyBookingsPageQueryBuilder = {
    eq(column, value) {
      calls.push(['eq', column, value]);
      return builder;
    },
    or(filters) {
      calls.push(['or', filters]);
      return builder;
    },
    in(column, values) {
      calls.push(['in', column, values]);
      return builder;
    },
    gte(column, value) {
      calls.push(['gte', column, value]);
      return builder;
    },
    lt(column, value) {
      calls.push(['lt', column, value]);
      return builder;
    },
    order(column, options) {
      calls.push(['order', column, options]);
      return builder;
    },
    range(from, to) {
      calls.push(['range', from, to]);
      return Promise.resolve(rangeResult ?? result);
    },
    then(onfulfilled, onrejected) {
      return Promise.resolve(result).then(onfulfilled, onrejected);
    },
  };

  return {
    calls,
    client: {
      from(table) {
        calls.push(['from', table]);
        return {
          select(columns, options) {
            calls.push(['select', columns, options]);
            return builder;
          },
        };
      },
    },
  };
}

function buildQuery(overrides: Partial<MyBookingsQuery> = {}): MyBookingsQuery {
  return {
    me: '1',
    sort: 'asc',
    page: 1,
    pageSize: 10,
    offset: 0,
    ...overrides,
  };
}

describe('fetchMyBookingsPage', () => {
  it('fetches active bookings with blocking statuses and in-memory active paging', async () => {
    const { client, calls } = createQueryClient({
      result: {
        data: [
          { ...baseRow, id: 'past', booking_date: '2026-05-22' },
          { ...baseRow, id: 'today', booking_date: '2026-05-23' },
          { ...baseRow, id: 'future', booking_date: '2026-05-24' },
        ],
        error: null,
      },
    });

    await expect(
      fetchMyBookingsPage({
        client,
        userId: 'user-1',
        email: 'guest@example.com',
        query: buildQuery({ status: 'active', pageSize: 1, offset: 1 }),
        todayForTimezone: () => '2026-05-23',
      }),
    ).resolves.toEqual({
      ok: true,
      rows: [expect.objectContaining({ id: 'future' })],
      total: 2,
    });

    expect(calls).toContainEqual(['eq', 'auth_user_id', 'user-1']);
    expect(calls).not.toContainEqual(['eq', 'customer_email', 'guest@example.com']);
    expect(calls).toContainEqual(['in', 'status', ['pending', 'pending_allocation', 'confirmed']]);
    expect(calls).not.toContainEqual(['range', expect.any(Number), expect.any(Number)]);
  });

  it('fetches filtered non-active bookings with database pagination', async () => {
    const { client, calls } = createQueryClient({
      result: { data: [], error: null },
      rangeResult: { data: [baseRow], error: null, count: 42 },
    });

    await expect(
      fetchMyBookingsPage({
        client,
        userId: 'user-1',
        email: 'guest@example.com',
        query: buildQuery({
          status: 'confirmed',
          restaurantId: '11111111-1111-4111-8111-111111111111',
          fromIso: '2026-05-23T00:00:00.000Z',
          toIso: '2026-05-24T00:00:00.000Z',
          sort: 'desc',
          page: 2,
          pageSize: 20,
          offset: 20,
        }),
      }),
    ).resolves.toEqual({
      ok: true,
      rows: [baseRow],
      total: 42,
    });

    expect(calls).toContainEqual(['eq', 'restaurant_id', '11111111-1111-4111-8111-111111111111']);
    expect(calls).toContainEqual(['eq', 'status', 'confirmed']);
    expect(calls).toContainEqual(['gte', 'booking_date', '2026-05-23T00:00:00.000Z']);
    expect(calls).toContainEqual(['lt', 'booking_date', '2026-05-24T00:00:00.000Z']);
    expect(calls).toContainEqual(['order', 'booking_date', { ascending: false }]);
    expect(calls).toContainEqual(['order', 'start_time', { ascending: false }]);
    expect(calls).toContainEqual(['range', 20, 39]);
  });

  it('adds email-matched rows only when email matching is enabled', async () => {
    const enabled = createQueryClient({
      result: { data: [], error: null },
      rangeResult: { data: [], error: null, count: 0 },
    });
    await fetchMyBookingsPage({
      client: enabled.client,
      userId: 'user-1',
      email: 'Guest@Example.com',
      emailMatch: true,
      query: buildQuery(),
    });
    expect(enabled.calls).toContainEqual([
      'or',
      'auth_user_id.eq.user-1,customer_email.eq.guest@example.com',
    ]);

    const unsafe = createQueryClient({
      result: { data: [], error: null },
      rangeResult: { data: [], error: null, count: 0 },
    });
    await fetchMyBookingsPage({
      client: unsafe.client,
      userId: 'user-1',
      email: 'a,b@example.com',
      emailMatch: true,
      query: buildQuery(),
    });
    expect(unsafe.calls).toContainEqual(['eq', 'auth_user_id', 'user-1']);
    expect(unsafe.calls.some((call) => call[0] === 'or')).toBe(false);
  });

  it('returns query errors without mapping them to HTTP responses', async () => {
    const error = { message: 'database unavailable' };
    const { client } = createQueryClient({
      result: { data: null, error: null },
      rangeResult: { data: null, error },
    });

    await expect(
      fetchMyBookingsPage({
        client,
        userId: 'user-1',
        email: 'guest@example.com',
        query: buildQuery({ status: 'cancelled' }),
      }),
    ).resolves.toEqual({ ok: false, error });
  });
});
