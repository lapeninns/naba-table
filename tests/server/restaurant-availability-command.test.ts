import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/server/supabase', () => ({
  getServiceSupabaseClient: () => {
    throw new Error('tests pass an explicit client');
  },
}));

vi.mock('@/server/occasions/catalog', () => ({
  getOccasionCatalog: vi.fn(),
}));

import { DEFAULT_RESERVATION_LIFECYCLE_GRACE_MINUTES } from '@/lib/restaurants/defaults';
import {
  AvailabilityCommandError,
  getAvailabilitySnapshot,
  saveRestaurantAvailability,
} from '@/server/restaurants/availabilityCommand';

import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

const RESTAURANT_ID = '11111111-1111-4111-8111-111111111111';
const NEW_REVISION = 'fedcba9876543210fedcba9876543210';
const SECTION_REVISIONS = {
  hours: '1'.repeat(32),
  servicePeriods: '2'.repeat(32),
  turnBands: '3'.repeat(32),
  rules: '4'.repeat(32),
};

type RpcResult = { data: unknown; error: { code?: string; message?: string } | null };

function fakeClient(rpcResult: RpcResult) {
  const rpc = vi.fn().mockResolvedValue(rpcResult);
  const tablesRead: string[] = [];
  const from = vi.fn((table: string) => {
    tablesRead.push(table);
    if (table === 'booking_occasions') {
      return {
        select: vi.fn().mockResolvedValue({
          data: [
            { key: 'lunch', deleted_at: null },
            { key: 'dinner', deleted_at: null },
            { key: 'gone', deleted_at: '2026-01-01T00:00:00Z' },
          ],
          error: null,
        }),
      };
    }
    throw new Error(`unexpected table ${table}`);
  });
  const client = { rpc, from } as unknown as SupabaseClient<Database>;
  return { client, rpc, tablesRead };
}

/** What the RPCs return: the stored rows and their revision, read in one statement. */
function dbSnapshot(revision = NEW_REVISION) {
  return {
    revision,
    revisions: SECTION_REVISIONS,
    restaurant: {
      timezone: 'Europe/London',
      reservation_interval_minutes: 30,
      reservation_default_duration_minutes: 105,
      reservation_last_seating_buffer_minutes: 60,
      reservation_lifecycle_grace_minutes: null,
      booking_policy: 'Be on time',
      updated_at: '2026-09-27T10:00:00.000+00:00',
    },
    operating_hours: [
      {
        id: 'h1',
        day_of_week: 1,
        effective_date: null,
        opens_at: '12:00:00',
        closes_at: '22:00:00',
        is_closed: false,
        notes: null,
        reservation_interval_minutes: null,
        reservation_slot_times: null,
        updated_at: '2026-09-27T10:00:00.000+00:00',
      },
      {
        id: 'o1',
        day_of_week: null,
        effective_date: '2026-12-25',
        opens_at: null,
        closes_at: null,
        is_closed: true,
        notes: 'Christmas',
        reservation_interval_minutes: null,
        reservation_slot_times: null,
        updated_at: '2026-09-27T10:00:00.000+00:00',
      },
    ],
    service_periods: [
      {
        id: 'p1',
        name: 'Lunch',
        day_of_week: 1,
        start_time: '12:00:00',
        end_time: '15:00:00',
        booking_option: 'lunch',
        updated_at: null,
      },
    ],
    turn_bands: [{ booking_option: 'lunch', max_party_size: 4, duration_minutes: 75 }],
  };
}

const weekly = Array.from({ length: 7 }, (_, dayOfWeek) => ({
  dayOfWeek,
  opensAt: dayOfWeek === 1 ? '12:00' : null,
  closesAt: dayOfWeek === 1 ? '22:00' : null,
  isClosed: dayOfWeek !== 1,
}));

describe('saveRestaurantAvailability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends every part to one RPC call and returns the snapshot it read in that transaction', async () => {
    const { client, rpc, tablesRead } = fakeClient({ data: dbSnapshot(), error: null });

    const snapshot = await saveRestaurantAvailability(
      RESTAURANT_ID,
      {
        hours: { weekly, overrides: [] },
        servicePeriods: [
          {
            name: 'Lunch',
            dayOfWeek: 1,
            startTime: '12:00',
            endTime: '15:00',
            bookingOption: ' Lunch ',
          },
        ],
        turnBands: { lunch: [{ maxPartySize: 4, durationMinutes: 75 }] },
        rules: { reservationIntervalMinutes: 30, bookingPolicy: '  Be on time  ' },
        expectedRevision: '0123456789abcdef0123456789abcdef',
      },
      client,
    );

    expect(rpc).toHaveBeenCalledTimes(1);
    const [fn, args] = rpc.mock.calls[0]!;
    expect(fn).toBe('save_restaurant_availability');
    expect(args.p_restaurant_id).toBe(RESTAURANT_ID);
    expect(args.p_expected_revision).toBe('0123456789abcdef0123456789abcdef');
    expect(args.p_operating_hours).toHaveLength(7);
    expect(args.p_service_periods).toEqual([
      expect.objectContaining({ restaurant_id: RESTAURANT_ID, booking_option: 'lunch' }),
    ]);
    expect(args.p_turn_bands).toEqual([
      {
        restaurant_id: RESTAURANT_ID,
        booking_option: 'lunch',
        max_party_size: 4,
        duration_minutes: 75,
      },
    ]);
    expect(args.p_rules).toEqual({
      reservation_interval_minutes: 30,
      booking_policy: 'Be on time',
    });

    // No follow-up reads: the response is the RPC's own snapshot (only the catalog was read).
    expect(tablesRead).toEqual(['booking_occasions']);
    expect(snapshot.revision).toBe(NEW_REVISION);
    expect(snapshot.hours.timezone).toBe('Europe/London');
    expect(snapshot.hours.weekly.find((day) => day.dayOfWeek === 1)).toMatchObject({
      opensAt: '12:00',
      closesAt: '22:00',
      isClosed: false,
    });
    expect(snapshot.hours.overrides).toEqual([
      expect.objectContaining({ id: 'o1', effectiveDate: '2026-12-25', isClosed: true }),
    ]);
    expect(snapshot.servicePeriods).toEqual([
      expect.objectContaining({ id: 'p1', startTime: '12:00', endTime: '15:00' }),
    ]);
    expect(snapshot.turnBands.bands).toEqual({ lunch: [{ maxPartySize: 4, durationMinutes: 75 }] });
    expect(snapshot.turnBands.defaults).toHaveProperty('dinner');
    expect(snapshot.rules).toMatchObject({
      reservationIntervalMinutes: 30,
      reservationDefaultDurationMinutes: 105,
      reservationLifecycleGraceMinutes: DEFAULT_RESERVATION_LIFECYCLE_GRACE_MINUTES,
      bookingPolicy: 'Be on time',
    });
  });

  it('treats a malformed RPC result as an unexpected failure, not a command error', async () => {
    const { client } = fakeClient({ data: { revision: NEW_REVISION }, error: null });

    const failure = saveRestaurantAvailability(
      RESTAURANT_ID,
      { rules: { reservationIntervalMinutes: 30 } },
      client,
    );

    await expect(failure).rejects.not.toBeInstanceOf(AvailabilityCommandError);
  });

  it('sends only the parts present; a rules-only save reads no booking types', async () => {
    const { client, rpc, tablesRead } = fakeClient({ data: dbSnapshot(), error: null });

    await saveRestaurantAvailability(
      RESTAURANT_ID,
      { rules: { reservationDefaultDurationMinutes: 120 } },
      client,
    );

    const [, args] = rpc.mock.calls[0]!;
    expect(args).toMatchObject({
      p_operating_hours: null,
      p_service_periods: null,
      p_turn_bands: null,
      p_rules: { reservation_default_duration_minutes: 120 },
      p_expected_revision: null,
      p_expected_revisions: null,
    });
    expect(tablesRead).not.toContain('booking_occasions');
  });

  it('sends the per-section expected revisions and returns the stored ones', async () => {
    const { client, rpc } = fakeClient({ data: dbSnapshot(), error: null });

    const snapshot = await saveRestaurantAvailability(
      RESTAURANT_ID,
      {
        rules: { reservationDefaultDurationMinutes: 120 },
        expectedRevisions: { rules: 'a'.repeat(32) },
      },
      client,
    );

    const [, args] = rpc.mock.calls[0]!;
    expect(args).toMatchObject({
      p_expected_revision: null,
      p_expected_revisions: { rules: 'a'.repeat(32) },
    });
    expect(snapshot.revisions).toEqual(SECTION_REVISIONS);
  });

  it('refuses invalid hours with fixed copy before calling the database', async () => {
    const { client, rpc } = fakeClient({ data: null, error: null });

    const failure = saveRestaurantAvailability(
      RESTAURANT_ID,
      {
        hours: {
          weekly: [{ dayOfWeek: 1, opensAt: '12:00', closesAt: '12:00', isClosed: false }],
          overrides: [],
        },
      },
      client,
    );

    await expect(failure).rejects.toMatchObject({
      code: 'INVALID_AVAILABILITY',
      status: 400,
      part: 'hours',
    });
    await expect(failure).rejects.not.toHaveProperty('message', expect.stringContaining('12:00'));
    expect(rpc).not.toHaveBeenCalled();
  });

  it('refuses a meal time on a deleted booking type before calling the database', async () => {
    const { client, rpc } = fakeClient({ data: null, error: null });

    await expect(
      saveRestaurantAvailability(
        RESTAURANT_ID,
        {
          servicePeriods: [
            {
              name: 'Old',
              dayOfWeek: 2,
              startTime: '12:00',
              endTime: '14:00',
              bookingOption: 'gone',
            },
          ],
        },
        client,
      ),
    ).rejects.toMatchObject({ code: 'INVALID_AVAILABILITY', part: 'servicePeriods' });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('refuses turn bands for an unknown booking type', async () => {
    const { client, rpc } = fakeClient({ data: null, error: null });

    await expect(
      saveRestaurantAvailability(
        RESTAURANT_ID,
        { turnBands: { brunch: [{ maxPartySize: 2, durationMinutes: 60 }] } },
        client,
      ),
    ).rejects.toMatchObject({ code: 'INVALID_AVAILABILITY', part: 'turnBands' });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('refuses a command with no parts', async () => {
    const { client, rpc } = fakeClient({ data: null, error: null });

    await expect(
      saveRestaurantAvailability(RESTAURANT_ID, { rules: {} }, client),
    ).rejects.toBeInstanceOf(AvailabilityCommandError);
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each([
    ['NT409', 'STALE_WRITE', 409],
    ['NT422', 'SERVICE_PERIOD_OUTSIDE_HOURS', 400],
    ['23503', 'UNKNOWN_BOOKING_TYPE', 400],
    ['P0002', 'RESTAURANT_NOT_FOUND', 404],
    ['P0001', 'INVALID_AVAILABILITY', 400],
  ])('maps SQLSTATE %s to %s', async (sqlstate, code, status) => {
    const { client } = fakeClient({
      data: null,
      error: { code: sqlstate, message: 'SECRET_DB_DETAIL' },
    });

    const failure = saveRestaurantAvailability(
      RESTAURANT_ID,
      { rules: { reservationIntervalMinutes: 30 } },
      client,
    );

    await expect(failure).rejects.toMatchObject({ code, status });
    await expect(failure).rejects.not.toHaveProperty(
      'message',
      expect.stringContaining('SECRET_DB_DETAIL'),
    );
  });

  it('surfaces an unknown database failure as a non-command error for the route to log', async () => {
    const { client } = fakeClient({ data: null, error: { code: '57014', message: 'SECRET' } });

    const failure = saveRestaurantAvailability(
      RESTAURANT_ID,
      { rules: { reservationIntervalMinutes: 30 } },
      client,
    );

    await expect(failure).rejects.not.toBeInstanceOf(AvailabilityCommandError);
    await expect(failure).rejects.toMatchObject({ code: '57014' });
  });
});

describe('getAvailabilitySnapshot', () => {
  it('reads rows and revision with one RPC call', async () => {
    const { client, rpc, tablesRead } = fakeClient({
      data: dbSnapshot('a'.repeat(32)),
      error: null,
    });

    const snapshot = await getAvailabilitySnapshot(RESTAURANT_ID, client);

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('restaurant_availability_snapshot', {
      p_restaurant_id: RESTAURANT_ID,
    });
    expect(tablesRead).toEqual([]);
    expect(snapshot.revision).toBe('a'.repeat(32));
    expect(snapshot.turnBands.bands).toEqual({ lunch: [{ maxPartySize: 4, durationMinutes: 75 }] });
  });

  it('maps a missing restaurant to RESTAURANT_NOT_FOUND', async () => {
    const { client } = fakeClient({ data: null, error: null });

    await expect(getAvailabilitySnapshot(RESTAURANT_ID, client)).rejects.toMatchObject({
      code: 'RESTAURANT_NOT_FOUND',
      status: 404,
    });
  });
});
