import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { mapBookingApiError } from '@/server/bookings/api-error';
import { getVenuePolicy, ServiceNotFoundError } from '@/server/capacity/policy';
import { getRestaurantServiceWindows } from '@/server/capacity/service-windows';
import {
  computeBookingWindowWithFallback,
  resetBookingWindowFallbackWarningsForTests,
} from '@/server/capacity/table-assignment/booking-window';

import type { ServiceWindowsByService } from '@/server/capacity/policy';

/**
 * Regression coverage for the July 2026 production fallback clusters:
 * - 2026-07-16 dinner slots at 22:00 / 22:15 / 22:30 / 22:45 BST (93 warnings)
 * - 2026-07-18 lunch slot at 15:00 BST (18 warnings)
 * Those slots are valid per the restaurants' configured service periods but
 * fall outside the hardcoded default policy windows (lunch 12:00–15:00,
 * dinner 16:00–22:00, exclusive end).
 */

const JULY_16_DINNER_SLOTS = [
  '2026-07-16T22:00:00.000+01:00',
  '2026-07-16T22:15:00.000+01:00',
  '2026-07-16T22:30:00.000+01:00',
  '2026-07-16T22:45:00.000+01:00',
];
const JULY_18_LUNCH_SLOT = '2026-07-18T15:00:00.000+01:00';

// Windows as a restaurant would configure them in restaurant_service_periods.
const derivedServiceWindows: ServiceWindowsByService = {
  lunch: { start: { hour: 12, minute: 0 }, end: { hour: 15, minute: 30 } },
  dinner: { start: { hour: 16, minute: 0 }, end: { hour: 23, minute: 0 } },
};

describe('July 16/18 service-window regression', () => {
  beforeEach(() => {
    resetBookingWindowFallbackWarningsForTests();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('resolves all July 16 dinner slots without fallback when service windows come from the DB', () => {
    const policy = getVenuePolicy({ serviceWindows: derivedServiceWindows });

    for (const startISO of JULY_16_DINNER_SLOTS) {
      const result = computeBookingWindowWithFallback({
        startISO,
        partySize: 4,
        bookingOption: 'dinner',
        policy,
        restaurantId: 'a120da71-0000-4000-8000-000000000000',
      });
      expect(result.usedFallback).toBe(false);
      expect(result.window.service).toBe('dinner');
      // The dining window never exceeds the configured 23:00 service end.
      expect(result.window.dining.end.toFormat('HH:mm') <= '23:00').toBe(true);
    }
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('resolves the July 18 lunch slot without fallback when service windows come from the DB', () => {
    const policy = getVenuePolicy({ serviceWindows: derivedServiceWindows });

    const result = computeBookingWindowWithFallback({
      startISO: JULY_18_LUNCH_SLOT,
      partySize: 2,
      bookingOption: 'lunch',
      policy,
      restaurantId: 'a050d1ad-0000-4000-8000-000000000000',
    });
    expect(result.usedFallback).toBe(false);
    expect(result.window.service).toBe('lunch');
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('still allows a bounded, explicit fallback for the same slots under the default policy', () => {
    const policy = getVenuePolicy();

    for (const startISO of JULY_16_DINNER_SLOTS) {
      const result = computeBookingWindowWithFallback({
        startISO,
        partySize: 4,
        bookingOption: 'dinner',
        policy,
        restaurantId: 'a120da71-0000-4000-8000-000000000000',
      });
      expect(result.usedFallback).toBe(true);
      expect(result.fallbackService).toBe('dinner');
    }

    const lunch = computeBookingWindowWithFallback({
      startISO: JULY_18_LUNCH_SLOT,
      partySize: 2,
      bookingOption: 'lunch',
      policy,
      restaurantId: 'a050d1ad-0000-4000-8000-000000000000',
    });
    expect(lunch.usedFallback).toBe(true);
    expect(lunch.fallbackService).toBe('lunch');
  });

  it('deduplicates repeated fallback warnings for the same restaurant/service/slot', () => {
    const policy = getVenuePolicy();

    for (let repeat = 0; repeat < 42; repeat += 1) {
      computeBookingWindowWithFallback({
        startISO: '2026-07-16T22:15:00.000+01:00',
        partySize: 4,
        bookingOption: 'dinner',
        policy,
        restaurantId: 'a120da71-0000-4000-8000-000000000000',
      });
    }
    expect(console.warn).toHaveBeenCalledTimes(1);

    // A different slot logs its own warning once.
    computeBookingWindowWithFallback({
      startISO: '2026-07-16T22:30:00.000+01:00',
      partySize: 4,
      bookingOption: 'dinner',
      policy,
      restaurantId: 'a120da71-0000-4000-8000-000000000000',
    });
    expect(console.warn).toHaveBeenCalledTimes(2);
  });

  it('fails closed with a controlled error when fallback is disabled', () => {
    vi.stubEnv('CAPACITY_SERVICE_FALLBACK', 'off');
    const policy = getVenuePolicy();

    expect(() =>
      computeBookingWindowWithFallback({
        startISO: '2026-07-16T22:15:00.000+01:00',
        partySize: 4,
        bookingOption: 'dinner',
        policy,
      }),
    ).toThrow(ServiceNotFoundError);
  });

  it('maps ServiceNotFoundError to a customer-safe 422 availability response', () => {
    let thrown: unknown;
    try {
      computeBookingWindowWithFallback({
        startISO: '2026-07-16T23:59:00.000+01:00',
        partySize: 4,
        bookingOption: 'dinner',
        policy: getVenuePolicy(),
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(ServiceNotFoundError);
    const mapped = mapBookingApiError(thrown);
    expect(mapped.status).toBe(422);
    expect(mapped.body.code).toBe('OUTSIDE_SERVICE_HOURS');
    expect(mapped.body.error).not.toContain('ServiceNotFoundError');
  });
});

describe('getRestaurantServiceWindows', () => {
  type PeriodRow = { booking_option: string; start_time: string; end_time: string };

  const clientWithRows = (rows: PeriodRow[], error: unknown = null) =>
    ({
      from: () => ({
        select: () => ({
          eq: () => Promise.resolve({ data: rows, error }),
        }),
      }),
    }) as never;

  it('derives merged per-service windows from service periods', async () => {
    const windows = await getRestaurantServiceWindows(
      'r1',
      clientWithRows([
        { booking_option: 'lunch', start_time: '12:00:00', end_time: '15:30:00' },
        { booking_option: 'dinner', start_time: '16:00:00', end_time: '22:00:00' },
        { booking_option: 'dinner', start_time: '18:00:00', end_time: '23:00:00' },
        { booking_option: 'drinks', start_time: '10:00:00', end_time: '23:00:00' },
      ]),
    );

    expect(windows).toEqual({
      lunch: { start: { hour: 12, minute: 0 }, end: { hour: 15, minute: 30 } },
      dinner: { start: { hour: 16, minute: 0 }, end: { hour: 23, minute: 0 } },
    });
  });

  it('handles periods crossing midnight via next-day policy semantics', async () => {
    const windows = await getRestaurantServiceWindows(
      'r1',
      clientWithRows([{ booking_option: 'dinner', start_time: '18:00', end_time: '01:00' }]),
    );
    expect(windows.dinner).toEqual({
      start: { hour: 18, minute: 0 },
      end: { hour: 1, minute: 0 },
    });

    // The policy resolves the wrapped end onto the next day, so a 23:30 start
    // is inside dinner service.
    const policy = getVenuePolicy({ serviceWindows: windows });
    const result = computeBookingWindowWithFallback({
      startISO: '2026-07-16T23:30:00.000+01:00',
      partySize: 2,
      bookingOption: 'dinner',
      policy,
    });
    expect(result.usedFallback).toBe(false);
    expect(result.window.service).toBe('dinner');
  });

  it('returns an empty map when no relevant periods exist', async () => {
    await expect(getRestaurantServiceWindows('r1', clientWithRows([]))).resolves.toEqual({});
  });
});
