import { BOOKING_BLOCKING_STATUSES } from '@/lib/enums';
import { selectActiveMyBookingsPage, type MyBookingRow } from '@/server/bookings/my-bookings-dto';

import type { MyBookingsQuery } from '@/server/bookings/my-bookings-query';

const MY_BOOKINGS_SELECT =
  'id, restaurant_id, booking_date, start_time, end_time, start_at, end_at, party_size, status, notes, restaurants(id, name, slug, timezone, reservation_interval_minutes)';

export type MyBookingsPageQueryResult = {
  data: unknown[] | null;
  error: unknown;
  count?: number | null;
};

export type MyBookingsPageQueryBuilder = PromiseLike<MyBookingsPageQueryResult> & {
  eq(column: string, value: string): MyBookingsPageQueryBuilder;
  in(column: string, values: readonly string[]): MyBookingsPageQueryBuilder;
  gte(column: string, value: string): MyBookingsPageQueryBuilder;
  lt(column: string, value: string): MyBookingsPageQueryBuilder;
  order(column: string, options: { ascending: boolean }): MyBookingsPageQueryBuilder;
  range(from: number, to: number): PromiseLike<MyBookingsPageQueryResult>;
};

export type MyBookingsPageQueryClient = {
  from(table: 'bookings'): {
    select(columns: string, options: { count: 'exact' }): MyBookingsPageQueryBuilder;
  };
};

export type MyBookingsPageFetchResult =
  | {
      ok: true;
      rows: MyBookingRow[];
      total: number;
    }
  | {
      ok: false;
      error: unknown;
    };

export async function fetchMyBookingsPage({
  client,
  email,
  query,
  todayForTimezone,
}: {
  client: MyBookingsPageQueryClient;
  email: string;
  query: MyBookingsQuery;
  todayForTimezone?: (timezone: string) => string;
}): Promise<MyBookingsPageFetchResult> {
  const pageSize = query.pageSize;
  const offset = query.offset;

  let bookingsQuery = client
    .from('bookings')
    .select(MY_BOOKINGS_SELECT, { count: 'exact' })
    .eq('customer_email', email);

  if (query.status === 'active') {
    bookingsQuery = bookingsQuery.in('status', BOOKING_BLOCKING_STATUSES);
  }

  if (query.restaurantId) {
    bookingsQuery = bookingsQuery.eq('restaurant_id', query.restaurantId);
  }

  if (query.status && query.status !== 'active') {
    bookingsQuery = bookingsQuery.eq('status', query.status);
  }

  if (query.fromIso) {
    bookingsQuery = bookingsQuery.gte('booking_date', query.fromIso);
  }

  if (query.toIso) {
    bookingsQuery = bookingsQuery.lt('booking_date', query.toIso);
  }

  bookingsQuery = bookingsQuery
    .order('booking_date', { ascending: query.sort === 'asc' })
    .order('start_time', { ascending: query.sort === 'asc' });

  if (query.status === 'active') {
    const { data, error } = await bookingsQuery;

    if (error) {
      return { ok: false, error };
    }

    const activePage = selectActiveMyBookingsPage({
      rows: (data ?? []) as MyBookingRow[],
      offset,
      pageSize,
      todayForTimezone,
    });

    return { ok: true, rows: activePage.rows, total: activePage.total };
  }

  const { data, error, count } = await bookingsQuery.range(offset, offset + pageSize - 1);

  if (error) {
    return { ok: false, error };
  }

  const rows = (data ?? []) as MyBookingRow[];
  return { ok: true, rows, total: count ?? rows.length };
}
