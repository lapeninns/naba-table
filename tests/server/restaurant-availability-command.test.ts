import { beforeEach, describe, expect, it, vi } from 'vitest';

const getOperatingHoursMock = vi.hoisted(() => vi.fn());
const getServicePeriodsMock = vi.hoisted(() => vi.fn());
const getRestaurantTurnBandsMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/supabase', () => ({
  getServiceSupabaseClient: () => {
    throw new Error('tests pass an explicit client');
  },
}));

vi.mock('@/server/restaurants/operatingHours', async (importOriginal) => ({
  ...(await importOriginal<typeof OperatingHoursModule>()),
  getOperatingHours: getOperatingHoursMock,
}));

vi.mock('@/server/restaurants/servicePeriods', async (importOriginal) => ({
  ...(await importOriginal<typeof ServicePeriodsModule>()),
  getServicePeriods: getServicePeriodsMock,
}));

vi.mock('@/server/restaurants/turnBands', async (importOriginal) => ({
  ...(await importOriginal<typeof TurnBandsModule>()),
  getRestaurantTurnBands: getRestaurantTurnBandsMock,
}));

vi.mock('@/server/occasions/catalog', () => ({
  getOccasionCatalog: vi.fn(),
}));

import { DEFAULT_RESERVATION_LIFECYCLE_GRACE_MINUTES } from '@/lib/restaurants/defaults';
import {
  AvailabilityCommandError,
  saveRestaurantAvailability,
} from '@/server/restaurants/availabilityCommand';

import type * as OperatingHoursModule from '@/server/restaurants/operatingHours';
import type * as ServicePeriodsModule from '@/server/restaurants/servicePeriods';
import type * as TurnBandsModule from '@/server/restaurants/turnBands';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

const RESTAURANT_ID = '11111111-1111-4111-8111-111111111111';
const NEW_REVISION = 'fedcba9876543210fedcba9876543210';

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
    if (table === 'restaurants') {
      const chain = {
        select: vi.fn(() => chain),
        eq: vi.fn(() => chain),
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            reservation_interval_minutes: 30,
            reservation_default_duration_minutes: 105,
            reservation_last_seating_buffer_minutes: 60,
            reservation_lifecycle_grace_minutes: null,
            booking_policy: null,
            updated_at: '2026-09-27T10:00:00.000Z',
          },
          error: null,
        }),
      };
      return chain;
    }
    throw new Error(`unexpected table ${table}`);
  });
  const client = { rpc, from } as unknown as SupabaseClient<Database>;
  return { client, rpc, tablesRead };
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
    getOperatingHoursMock.mockResolvedValue({
      restaurantId: RESTAURANT_ID,
      timezone: 'Europe/London',
      updatedAt: null,
      weekly: [],
      overrides: [],
    });
    getServicePeriodsMock.mockResolvedValue([
      {
        id: 'p1',
        name: 'Lunch',
        dayOfWeek: 1,
        startTime: '12:00',
        endTime: '15:00',
        bookingOption: 'lunch',
        updatedAt: null,
      },
    ]);
    getRestaurantTurnBandsMock.mockResolvedValue({
      lunch: [{ maxPartySize: 4, durationMinutes: 75 }],
    });
  });

  it('sends every part to one RPC call and returns the canonical snapshot', async () => {
    const { client, rpc } = fakeClient({ data: { revision: NEW_REVISION }, error: null });

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

    expect(snapshot.revision).toBe(NEW_REVISION);
    expect(snapshot.turnBands.bands).toEqual({ lunch: [{ maxPartySize: 4, durationMinutes: 75 }] });
    expect(snapshot.turnBands.defaults).toHaveProperty('dinner');
    expect(snapshot.rules).toMatchObject({
      reservationIntervalMinutes: 30,
      reservationDefaultDurationMinutes: 105,
      reservationLifecycleGraceMinutes: DEFAULT_RESERVATION_LIFECYCLE_GRACE_MINUTES,
    });
  });

  it('sends only the parts present; a rules-only save reads no booking types', async () => {
    const { client, rpc, tablesRead } = fakeClient({
      data: { revision: NEW_REVISION },
      error: null,
    });

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
    });
    expect(tablesRead).not.toContain('booking_occasions');
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
