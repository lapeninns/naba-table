import { AuthSessionMissingError } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Row = Record<string, unknown>;

const table = vi.hoisted(() => ({ rows: [] as Array<Record<string, unknown>> }));

/**
 * A tiny in-memory `bookings` table: enough of the PostgREST builder for the
 * claim (`update().eq().eq().is().select()`) and for fetchMyBookingsPage (`select().eq()...range()`).
 */
vi.mock('@/server/supabase', () => {
  function updateChain(patch: Record<string, unknown>) {
    const filters: Array<(row: Record<string, unknown>) => boolean> = [];
    const chain = {
      eq(column: string, value: unknown) {
        filters.push((row) => row[column] === value);
        return chain;
      },
      is(column: string, value: unknown) {
        filters.push((row) => (row[column] ?? null) === value);
        const matched: Array<Record<string, unknown>> = [];
        for (const row of table.rows) {
          if (filters.every((match) => match(row))) {
            Object.assign(row, patch);
            matched.push(row);
          }
        }
        const result = { error: null };
        return {
          // `await update()...is()` (no representation) still resolves like PostgREST.
          then(resolve: (value: { error: null }) => unknown) {
            return Promise.resolve(result).then(resolve);
          },
          // `.select('id')` returns the changed rows, as PostgREST does with Prefer: return=representation.
          select(_columns: string) {
            return Promise.resolve({
              data: matched.map((row) => ({ id: row.id })),
              error: null,
            });
          },
        };
      },
    };
    return chain;
  }

  return {
    getServiceSupabaseClient: () => ({
      from: () => ({ update: updateChain }),
    }),
    getRouteHandlerSupabaseClient: vi.fn(),
  };
});

import { logger } from '@/lib/logger';
import {
  bindCreatedBookingToSessionOwner,
  resolveCreatorSessionUser,
} from '@/server/bookings/create-owner-binding';
import { fetchMyBookingsPage } from '@/server/bookings/my-bookings-page';

import type { BookingRecord } from '@/server/bookings';
import type { MyBookingsPageQueryClient } from '@/server/bookings/my-bookings-page';
import type { MyBookingsQuery } from '@/server/bookings/my-bookings-query';

const USER_ID = '5b0f2c1e-3d4a-4b6c-9e8f-0a1b2c3d4e5f';
const CONFIRMED = '2026-06-01T00:00:00.000Z';

function newBooking(overrides: Partial<Row> = {}): BookingRecord {
  return {
    id: '2a9d6c4e-1b3f-4e5a-8c7d-9f0e1d2c3b4a',
    restaurant_id: '11111111-1111-4111-8111-111111111111',
    booking_date: '2026-07-01',
    start_time: '19:00:00',
    end_time: '20:30:00',
    start_at: null,
    end_at: null,
    party_size: 4,
    status: 'confirmed',
    notes: null,
    customer_email: 'alex@example.com',
    auth_user_id: null,
    restaurants: {
      id: '11111111-1111-4111-8111-111111111111',
      name: 'The Venue',
      slug: 'the-venue',
      timezone: 'Europe/London',
      reservation_interval_minutes: 15,
    },
    ...overrides,
  } as unknown as BookingRecord;
}

/** Filters the shared table the way PostgREST would for the "My bookings" list. */
function myBookingsClient(): MyBookingsPageQueryClient {
  return {
    from: () => ({
      select: () => {
        const filters: Array<(row: Row) => boolean> = [];
        const builder = {
          eq(column: string, value: string) {
            filters.push((row) => row[column] === value);
            return builder;
          },
          or() {
            throw new Error('email matching must stay off');
          },
          in(column: string, values: readonly string[]) {
            filters.push((row) => values.includes(String(row[column])));
            return builder;
          },
          gte: () => builder,
          lt: () => builder,
          order: () => builder,
          range: async () => {
            const data = table.rows.filter((row) => filters.every((match) => match(row)));
            return { data, error: null, count: data.length };
          },
          then(resolve: (value: { data: Row[]; error: null }) => unknown) {
            const data = table.rows.filter((row) => filters.every((match) => match(row)));
            return Promise.resolve({ data, error: null }).then(resolve);
          },
        };
        return builder;
      },
    }),
  };
}

const historyQuery = { pageSize: 10, offset: 0, sort: 'asc' } as unknown as MyBookingsQuery;

describe('bindCreatedBookingToSessionOwner', () => {
  beforeEach(() => {
    table.rows = [];
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('binds a fresh insert and the booking then appears in "My bookings" for that user', async () => {
    const booking = newBooking();
    table.rows.push({ ...booking });
    const before = await fetchMyBookingsPage({
      client: myBookingsClient(),
      userId: USER_ID,
      query: historyQuery,
    });
    expect(before).toMatchObject({ ok: true, total: 0 });

    const bound = await bindCreatedBookingToSessionOwner({
      booking,
      createOrigin: 'inserted',
      isOpsWalkIn: false,
      sessionUserResolver: async () => ({
        id: USER_ID,
        email: 'ALEX@example.com',
        email_confirmed_at: CONFIRMED,
      }),
    });

    expect(bound.auth_user_id).toBe(USER_ID);
    expect(table.rows[0]?.auth_user_id).toBe(USER_ID);
    const after = await fetchMyBookingsPage({
      client: myBookingsClient(),
      userId: USER_ID,
      query: historyQuery,
    });
    expect(after).toMatchObject({ ok: true, total: 1 });
    expect(after.ok && after.rows[0]?.id).toBe(booking.id);
  });

  it('does not report a bind when a concurrent claim won the conditional update (0 rows)', async () => {
    const booking = newBooking();
    // Another request bound the row after this booking object was read.
    table.rows.push({ ...booking, auth_user_id: 'someone-else' });
    const infoSpy = vi.spyOn(logger, 'info');

    const result = await bindCreatedBookingToSessionOwner({
      booking,
      createOrigin: 'inserted',
      isOpsWalkIn: false,
      sessionUserResolver: async () => ({
        id: USER_ID,
        email: 'alex@example.com',
        email_confirmed_at: CONFIRMED,
      }),
    });

    expect(result).toBe(booking);
    expect(result.auth_user_id).toBeNull();
    expect(table.rows[0]?.auth_user_id).toBe('someone-else');
    expect(infoSpy).not.toHaveBeenCalledWith(
      'bookings.create.owner_binding.bound',
      expect.anything(),
    );
  });

  it.each([
    ['an unconfirmed email', { email: 'alex@example.com', email_confirmed_at: null }],
    ['a different email', { email: 'friend@example.com', email_confirmed_at: CONFIRMED }],
  ])('does not bind for %s', async (_label, user) => {
    const booking = newBooking();
    table.rows.push({ ...booking });

    const result = await bindCreatedBookingToSessionOwner({
      booking,
      createOrigin: 'inserted',
      isOpsWalkIn: false,
      sessionUserResolver: async () => ({ id: USER_ID, ...user }),
    });

    expect(result).toBe(booking);
    expect(table.rows[0]?.auth_user_id).toBeNull();
  });

  it.each(['key_replay', 'recovered', undefined] as const)(
    'never resolves the session or binds for origin %s',
    async (createOrigin) => {
      const sessionUserResolver = vi.fn();
      const claimer = vi.fn();
      const booking = newBooking();

      const result = await bindCreatedBookingToSessionOwner({
        booking,
        claimer,
        createOrigin,
        isOpsWalkIn: false,
        sessionUserResolver,
      });

      expect(result).toBe(booking);
      expect(sessionUserResolver).not.toHaveBeenCalled();
      expect(claimer).not.toHaveBeenCalled();
    },
  );

  it('never binds an ops walk-in (staff session)', async () => {
    const sessionUserResolver = vi.fn();
    const booking = newBooking();

    const result = await bindCreatedBookingToSessionOwner({
      booking,
      createOrigin: 'inserted',
      isOpsWalkIn: true,
      sessionUserResolver,
    });

    expect(result).toBe(booking);
    expect(sessionUserResolver).not.toHaveBeenCalled();
  });

  it('does not touch a booking that is already bound', async () => {
    const sessionUserResolver = vi.fn();
    const booking = newBooking({ auth_user_id: 'someone-else' });

    const result = await bindCreatedBookingToSessionOwner({
      booking,
      createOrigin: 'inserted',
      isOpsWalkIn: false,
      sessionUserResolver,
    });

    expect(result).toBe(booking);
    expect(sessionUserResolver).not.toHaveBeenCalled();
  });

  it('skips an anonymous request without calling the claim', async () => {
    const claimer = vi.fn();
    const booking = newBooking();

    const result = await bindCreatedBookingToSessionOwner({
      booking,
      claimer,
      createOrigin: 'inserted',
      isOpsWalkIn: false,
      sessionUserResolver: async () => null,
    });

    expect(result).toBe(booking);
    expect(claimer).not.toHaveBeenCalled();
  });

  it('returns the booking unchanged when the claim fails or throws', async () => {
    const booking = newBooking();
    const user = async () => ({
      id: USER_ID,
      email: 'alex@example.com',
      email_confirmed_at: CONFIRMED,
    });
    const warnSpy = vi.spyOn(logger, 'warn');

    await expect(
      bindCreatedBookingToSessionOwner({
        booking,
        claimer: vi.fn(async () => 'failed' as const),
        createOrigin: 'inserted',
        isOpsWalkIn: false,
        sessionUserResolver: user,
      }),
    ).resolves.toBe(booking);

    await expect(
      bindCreatedBookingToSessionOwner({
        booking,
        claimer: vi.fn(async () => {
          throw new Error('db down for alex@example.com');
        }),
        createOrigin: 'inserted',
        isOpsWalkIn: false,
        sessionUserResolver: user,
      }),
    ).resolves.toBe(booking);
    expect(warnSpy).toHaveBeenCalledWith('bookings.create.owner_binding.failed', {
      bookingId: booking.id,
    });
    expect(JSON.stringify(warnSpy.mock.calls)).not.toContain('alex@example.com');
  });
});

describe('resolveCreatorSessionUser', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function routeClient(getUser: () => Promise<unknown>) {
    return async () => ({ auth: { getUser } }) as never;
  }

  it('returns the user with email and confirmation', async () => {
    await expect(
      resolveCreatorSessionUser(
        routeClient(async () => ({
          data: { user: { id: USER_ID, email: 'alex@example.com', email_confirmed_at: CONFIRMED } },
          error: null,
        })),
      ),
    ).resolves.toEqual({ id: USER_ID, email: 'alex@example.com', email_confirmed_at: CONFIRMED });
  });

  it('treats a missing session as anonymous without logging', async () => {
    const warnSpy = vi.spyOn(logger, 'warn');

    await expect(
      resolveCreatorSessionUser(
        routeClient(async () => ({ data: { user: null }, error: new AuthSessionMissingError() })),
      ),
    ).resolves.toBeNull();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('logs other getUser failures by status only and returns null', async () => {
    const warnSpy = vi.spyOn(logger, 'warn');

    await expect(
      resolveCreatorSessionUser(
        routeClient(async () => ({
          data: { user: null },
          error: Object.assign(new Error('bad jwt for alex@example.com'), { status: 401 }),
        })),
      ),
    ).resolves.toBeNull();
    await expect(
      resolveCreatorSessionUser(async () => {
        throw new Error('cookies unavailable');
      }),
    ).resolves.toBeNull();

    expect(warnSpy).toHaveBeenNthCalledWith(1, 'bookings.create.owner_binding.session_failed', {
      status: 401,
    });
    expect(warnSpy).toHaveBeenNthCalledWith(2, 'bookings.create.owner_binding.session_failed', {
      status: null,
    });
    expect(JSON.stringify(warnSpy.mock.calls)).not.toContain('alex@example.com');
  });
});
