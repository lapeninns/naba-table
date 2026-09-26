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
  or(filters: string): MyBookingsPageQueryBuilder;
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

const EMAIL_FILTER_UNSAFE = /[,()"\\]/;

/**
 * Bookings owned by the signed-in user: rows bound to `auth_user_id`, plus
 * rows whose email matches only when `emailMatch` is set (the same predicate
 * as the booking detail endpoints, see isVerifiedBookingOwner).
 */
export async function fetchMyBookingsPage({
  client,
  userId,
  email,
  emailMatch = false,
  query,
  todayForTimezone,
}: {
  client: MyBookingsPageQueryClient;
  userId: string;
  email?: string | null;
  emailMatch?: boolean;
  query: MyBookingsQuery;
  todayForTimezone?: (timezone: string) => string;
}): Promise<MyBookingsPageFetchResult> {
  const pageSize = query.pageSize;
  const offset = query.offset;
  const normalizedEmail = email?.trim().toLowerCase() ?? '';
  const includeEmailMatch =
    emailMatch && normalizedEmail.length > 0 && !EMAIL_FILTER_UNSAFE.test(normalizedEmail);

  const baseQuery = client.from('bookings').select(MY_BOOKINGS_SELECT, { count: 'exact' });
  let bookingsQuery = includeEmailMatch
    ? baseQuery.or(`auth_user_id.eq.${userId},customer_email.eq.${normalizedEmail}`)
    : baseQuery.eq('auth_user_id', userId);

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
