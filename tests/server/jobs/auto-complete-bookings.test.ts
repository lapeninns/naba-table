import { beforeEach, describe, expect, it, vi } from 'vitest';

const clearBookingTableAssignmentsMock = vi.hoisted(() => vi.fn());
const enqueueCheckOutSideEffectsMock = vi.hoisted(() => vi.fn());
const getServiceSupabaseClientMock = vi.hoisted(() => vi.fn());
const resolveBookingEndAtUtcMock = vi.hoisted(() =>
  vi.fn((booking: { end_at: string | null }) => booking.end_at),
);

vi.mock('@/server/bookings', () => ({
  clearBookingTableAssignments: clearBookingTableAssignmentsMock,
}));

vi.mock('@/server/bookings/booking-access', () => ({
  resolveBookingEndAtUtc: resolveBookingEndAtUtcMock,
}));

vi.mock('@/server/jobs/booking-side-effects', () => ({
  enqueueCheckOutSideEffects: enqueueCheckOutSideEffectsMock,
}));

vi.mock('@/server/supabase', () => ({
  getServiceSupabaseClient: getServiceSupabaseClientMock,
}));

import { autoCompletePastBookings } from '@/server/jobs/auto-complete-bookings';

type BookingFixture = {
  id: string;
  restaurant_id: string;
  status: 'confirmed' | 'checked_in' | 'completed';
  start_at: string;
  end_at: string | null;
  booking_date: string;
  start_time: string;
  end_time: string;
  checked_in_at: string | null;
  checked_out_at: string | null;
  customer_email: string;
};

type RestaurantFixture = {
  id: string;
  name: string;
  timezone: string;
  reservation_lifecycle_grace_minutes: number | null;
};

const RESTAURANT_ID = 'rest-1';
const ACTOR_ID = 'user-1';
const NOW = new Date('2026-05-10T12:00:00.000Z');

class QueryBuilder {
  private filters: Array<(row: Record<string, unknown>) => boolean> = [];
  private limitCount: number | null = null;
  private single = false;

  constructor(
    private readonly table: string,
    private readonly state: {
      restaurants: RestaurantFixture[];
      bookings: BookingFixture[];
      memberships: Array<{ restaurant_id: string; user_id: string; created_at: string }>;
    },
  ) {}

  select() {
    return this;
  }

  order() {
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push((row) => row[column] === value);
    return this;
  }

  in(column: string, values: unknown[]) {
    this.filters.push((row) => values.includes(row[column]));
    return this;
  }

  lte(column: string, value: string) {
    this.filters.push((row) => typeof row[column] === 'string' && row[column] <= value);
    return this;
  }

  gte(column: string, value: string) {
    this.filters.push((row) => typeof row[column] === 'string' && row[column] >= value);
    return this;
  }

  limit(value: number) {
    this.limitCount = value;
    return this;
  }

  maybeSingle() {
    this.single = true;
    return this.execute();
  }

  then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return this.execute().then(onfulfilled, onrejected);
  }

  private async execute() {
    let rows = this.rows().filter((row) => this.filters.every((filter) => filter(row)));
    if (this.limitCount !== null) {
      rows = rows.slice(0, this.limitCount);
    }
    if (this.single) {
      return { data: rows[0] ?? null, error: null };
    }
    return { data: rows, error: null };
  }

  private rows(): Array<Record<string, unknown>> {
    if (this.table === 'restaurants') return this.state.restaurants;
    if (this.table === 'bookings') return this.state.bookings;
    if (this.table === 'restaurant_memberships') return this.state.memberships;
    return [];
  }
}

function makeBooking(overrides: Partial<BookingFixture> = {}): BookingFixture {
  return {
    id: overrides.id ?? 'booking-1',
    restaurant_id: overrides.restaurant_id ?? RESTAURANT_ID,
    status: overrides.status ?? 'confirmed',
    start_at: overrides.start_at ?? '2026-05-09T18:00:00.000Z',
    end_at: overrides.end_at ?? '2026-05-09T19:15:00.000Z',
    booking_date: overrides.booking_date ?? '2026-05-09',
    start_time: overrides.start_time ?? '19:00:00',
    end_time: overrides.end_time ?? '20:15:00',
    checked_in_at: overrides.checked_in_at ?? null,
    checked_out_at: overrides.checked_out_at ?? null,
    customer_email: overrides.customer_email ?? 'guest@example.com',
  };
}

function installSupabase(bookings: BookingFixture[]) {
  const state = {
    restaurants: [
      {
        id: RESTAURANT_ID,
        name: 'The Old School House',
        timezone: 'Europe/London',
        reservation_lifecycle_grace_minutes: 15,
      },
    ],
    bookings,
    memberships: [
      {
        restaurant_id: RESTAURANT_ID,
        user_id: ACTOR_ID,
        created_at: '2026-01-01T00:00:00.000Z',
      },
    ],
  };
  const rpc = vi.fn(async (_name: string, params: Record<string, string | null>) => {
    const booking = state.bookings.find((row) => row.id === params.p_booking_id);
    if (!booking) return { data: [], error: null };
    booking.status = params.p_status as BookingFixture['status'];
    booking.checked_in_at = params.p_checked_in_at;
    booking.checked_out_at = params.p_checked_out_at;
    return {
      data: [
        {
          status: booking.status,
          checked_in_at: booking.checked_in_at,
          checked_out_at: booking.checked_out_at,
          updated_at: params.p_updated_at,
        },
      ],
      error: null,
    };
  });
  const supabase = {
    from: vi.fn((table: string) => new QueryBuilder(table, state)),
    rpc,
    auth: {
      admin: {
        getUserById: vi.fn(async (id: string) => ({ data: { user: { id } }, error: null })),
      },
    },
  };
  getServiceSupabaseClientMock.mockReturnValue(supabase);
  return { state, supabase };
}

describe('autoCompletePastBookings', () => {
  beforeEach(() => {
    clearBookingTableAssignmentsMock.mockReset();
    enqueueCheckOutSideEffectsMock.mockReset();
    getServiceSupabaseClientMock.mockReset();
    resolveBookingEndAtUtcMock.mockClear();
    clearBookingTableAssignmentsMock.mockResolvedValue(1);
    enqueueCheckOutSideEffectsMock.mockResolvedValue(undefined);
  });

  it('completes a missed previous-day confirmed booking after the original close window', async () => {
    const booking = makeBooking({
      id: 'previous-day',
      booking_date: '2026-05-09',
      start_at: '2026-05-09T18:00:00.000Z',
      end_at: '2026-05-09T19:15:00.000Z',
    });
    const { supabase } = installSupabase([booking]);

    const summary = await autoCompletePastBookings({ now: NOW });

    expect(summary.candidates).toBe(1);
    expect(summary.completed).toBe(1);
    expect(booking.status).toBe('completed');
    expect(booking.checked_in_at).toBe('2026-05-09T18:00:00.000Z');
    expect(booking.checked_out_at).toBe('2026-05-09T19:15:00.000Z');
    expect(supabase.rpc).toHaveBeenCalledTimes(2);
    expect(clearBookingTableAssignmentsMock).toHaveBeenCalledWith(supabase, 'previous-day');
  });

  it('ignores future confirmed bookings', async () => {
    const booking = makeBooking({
      id: 'future',
      start_at: '2026-05-10T18:00:00.000Z',
      end_at: '2026-05-10T19:00:00.000Z',
      booking_date: '2026-05-10',
    });
    installSupabase([booking]);

    const summary = await autoCompletePastBookings({ now: NOW });

    expect(summary.candidates).toBe(0);
    expect(summary.completed).toBe(0);
    expect(booking.status).toBe('confirmed');
  });

  it('completes due bookings when end_at is derived from local date and time', async () => {
    const booking = makeBooking({
      id: 'derived-end',
      end_at: null,
      booking_date: '2026-05-09',
      end_time: '19:15:00',
    });
    resolveBookingEndAtUtcMock.mockReturnValueOnce('2026-05-09T18:15:00.000Z');
    installSupabase([booking]);

    const summary = await autoCompletePastBookings({ now: NOW });

    expect(summary.candidates).toBe(1);
    expect(summary.completed).toBe(1);
    expect(booking.status).toBe('completed');
    expect(booking.checked_out_at).toBe('2026-05-09T18:15:00.000Z');
  });

  it('ignores due bookings outside the bounded lookback', async () => {
    const booking = makeBooking({
      id: 'too-old',
      start_at: '2026-03-01T18:00:00.000Z',
      end_at: '2026-03-01T19:00:00.000Z',
      booking_date: '2026-03-01',
    });
    installSupabase([booking]);

    const summary = await autoCompletePastBookings({ now: NOW });

    expect(summary.candidates).toBe(0);
    expect(booking.status).toBe('confirmed');
  });

  it('checks out a late checked-in booking at the check-in time instead of before it', async () => {
    const booking = makeBooking({
      id: 'late-check-in',
      status: 'checked_in',
      start_at: '2026-05-06T17:30:00.000Z',
      end_at: '2026-05-06T18:45:00.000Z',
      booking_date: '2026-05-06',
      checked_in_at: '2026-05-06T19:26:08.086Z',
    });
    const { supabase } = installSupabase([booking]);

    const summary = await autoCompletePastBookings({ now: NOW });

    expect(summary.candidates).toBe(1);
    expect(summary.completed).toBe(1);
    expect(summary.errors).toBe(0);
    expect(booking.status).toBe('completed');
    expect(booking.checked_out_at).toBe('2026-05-06T19:26:08.086Z');
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
    expect(supabase.rpc).toHaveBeenCalledWith(
      'apply_booking_state_transition',
      expect.objectContaining({
        p_booking_id: 'late-check-in',
        p_checked_out_at: '2026-05-06T19:26:08.086Z',
      }),
    );
  });

  it('does not count auto-complete as successful when assignment cleanup fails', async () => {
    const booking = makeBooking({
      id: 'cleanup-fails',
      booking_date: '2026-05-09',
      start_at: '2026-05-09T18:00:00.000Z',
      end_at: '2026-05-09T19:15:00.000Z',
    });
    installSupabase([booking]);
    clearBookingTableAssignmentsMock.mockRejectedValueOnce(new Error('cleanup failed'));

    const summary = await autoCompletePastBookings({ now: NOW });

    expect(summary.candidates).toBe(1);
    expect(summary.completed).toBe(0);
    expect(summary.errors).toBe(1);
    expect(clearBookingTableAssignmentsMock).toHaveBeenCalledWith(
      expect.anything(),
      'cleanup-fails',
    );
  });
});
