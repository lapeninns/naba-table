import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import {
  buildBookingHoursNormalization,
  buildServicePeriodsNormalization,
} from '@/server/google-business-profile/core-normalization-service-periods';

import type { Database } from '@/types/supabase';

type RestaurantHourRow = Database['public']['Tables']['restaurant_hours']['Row'];
type RestaurantServicePeriodRow = Database['public']['Tables']['restaurant_service_periods']['Row'];

function buildHourRow(overrides: Partial<RestaurantHourRow>): RestaurantHourRow {
  return {
    id: overrides.id ?? randomUUID(),
    restaurant_id: overrides.restaurant_id ?? 'rest-1',
    hours_type: overrides.hours_type ?? 'service',
    period_label: overrides.period_label ?? null,
    open_day: overrides.open_day ?? null,
    close_day: overrides.close_day ?? overrides.open_day ?? null,
    start_date: overrides.start_date ?? null,
    end_date: overrides.end_date ?? null,
    open_time: overrides.open_time ?? null,
    close_time: overrides.close_time ?? null,
    is_closed: overrides.is_closed ?? false,
    display_order: overrides.display_order ?? 0,
    source: overrides.source ?? 'gbp',
    source_record_id: overrides.source_record_id ?? 'locations/123',
    managed_by: overrides.managed_by ?? 'gbp',
    last_synced_at: overrides.last_synced_at ?? '2026-04-18T12:00:00.000Z',
    created_at: overrides.created_at ?? '2026-04-18T12:00:00.000Z',
    updated_at: overrides.updated_at ?? '2026-04-18T12:00:00.000Z',
  };
}

function buildServicePeriodRow(
  overrides: Partial<RestaurantServicePeriodRow>,
): RestaurantServicePeriodRow {
  return {
    id: overrides.id ?? randomUUID(),
    restaurant_id: overrides.restaurant_id ?? 'rest-1',
    name: overrides.name ?? 'Lunch',
    day_of_week: overrides.day_of_week ?? 1,
    start_time: overrides.start_time ?? '12:00:00',
    end_time: overrides.end_time ?? '15:00:00',
    booking_option: overrides.booking_option ?? 'lunch',
    created_at: overrides.created_at ?? '2026-04-18T12:00:00.000Z',
    updated_at: overrides.updated_at ?? '2026-04-18T12:00:00.000Z',
  };
}

describe('google business profile core normalization service periods', () => {
  it('normalizes explicit meal-labelled more-hours rows and detects drift', () => {
    const normalization = buildServicePeriodsNormalization({
      gbpHoursRows: [
        buildHourRow({
          period_label: 'Lunch',
          open_day: 1,
          close_day: 1,
          open_time: '12:00',
          close_time: '15:00',
        }),
        buildHourRow({
          period_label: 'Dinner',
          open_day: 1,
          close_day: 1,
          open_time: '17:00',
          close_time: '22:00',
          display_order: 1,
        }),
      ],
      coreServicePeriodRows: [
        buildServicePeriodRow({
          booking_option: 'lunch',
          day_of_week: 1,
          start_time: '12:00:00',
          end_time: '15:00:00',
        }),
        buildServicePeriodRow({
          name: 'Dinner',
          booking_option: 'dinner',
          day_of_week: 1,
          start_time: '17:00:00',
          end_time: '21:00:00',
        }),
      ],
    });

    expect(normalization.source).toBe('more_hours');
    expect(normalization.matchStatus).toBe('drifted');
    expect(normalization.warnings).toEqual([]);
    expect(normalization.periods).toEqual([
      expect.objectContaining({
        bookingOption: 'dinner',
        dayOfWeek: 1,
        startTime: '17:00',
        endTime: '22:00',
        matchesCore: false,
      }),
      expect.objectContaining({
        bookingOption: 'lunch',
        dayOfWeek: 1,
        startTime: '12:00',
        endTime: '15:00',
        matchesCore: true,
      }),
    ]);
  });

  it('infers lunch and dinner from two unlabeled kitchen windows', () => {
    const normalization = buildServicePeriodsNormalization({
      gbpHoursRows: [
        buildHourRow({
          period_label: 'Kitchen',
          open_day: 2,
          close_day: 2,
          open_time: '12:00',
          close_time: '15:00',
        }),
        buildHourRow({
          period_label: 'Kitchen',
          open_day: 2,
          close_day: 2,
          open_time: '17:00',
          close_time: '22:00',
          display_order: 1,
        }),
      ],
      coreServicePeriodRows: [
        buildServicePeriodRow({
          booking_option: 'lunch',
          day_of_week: 2,
          start_time: '12:00:00',
          end_time: '15:00:00',
        }),
        buildServicePeriodRow({
          name: 'Dinner',
          booking_option: 'dinner',
          day_of_week: 2,
          start_time: '17:00:00',
          end_time: '22:00:00',
        }),
      ],
    });

    expect(normalization.matchStatus).toBe('matched');
    expect(normalization.periods).toEqual([
      expect.objectContaining({
        bookingOption: 'dinner',
        dayOfWeek: 2,
        startTime: '17:00',
        endTime: '22:00',
        matchesCore: true,
      }),
      expect.objectContaining({
        bookingOption: 'lunch',
        dayOfWeek: 2,
        startTime: '12:00',
        endTime: '15:00',
        matchesCore: true,
      }),
    ]);
  });

  it('splits one kitchen window only when it spans the 17:00 meal boundary', () => {
    const normalization = buildServicePeriodsNormalization({
      gbpHoursRows: [
        buildHourRow({
          period_label: 'Kitchen',
          open_day: 0,
          close_day: 0,
          open_time: '12:00',
          close_time: '21:00',
        }),
        buildHourRow({
          period_label: 'Kitchen',
          open_day: 3,
          close_day: 3,
          open_time: '11:00',
          close_time: '16:00',
        }),
      ],
      coreServicePeriodRows: [
        buildServicePeriodRow({
          booking_option: 'lunch',
          day_of_week: 0,
          start_time: '12:00:00',
          end_time: '17:00:00',
        }),
        buildServicePeriodRow({
          name: 'Dinner',
          booking_option: 'dinner',
          day_of_week: 0,
          start_time: '17:00:00',
          end_time: '21:00:00',
        }),
      ],
    });

    expect(normalization.matchStatus).toBe('partial');
    expect(normalization.warnings).toEqual([
      'GBP kitchen hours for day 3 contain a single window, so lunch and dinner cannot be inferred safely.',
    ]);
    expect(normalization.periods).toEqual([
      expect.objectContaining({
        bookingOption: 'dinner',
        dayOfWeek: 0,
        startTime: '17:00',
        endTime: '21:00',
        matchesCore: true,
      }),
      expect.objectContaining({
        bookingOption: 'lunch',
        dayOfWeek: 0,
        startTime: '12:00',
        endTime: '17:00',
        matchesCore: true,
      }),
    ]);
  });

  it('keeps booking-hours verification partial when GBP has only envelope inputs', () => {
    const servicePeriods = buildServicePeriodsNormalization({
      gbpHoursRows: [
        buildHourRow({
          period_label: 'Lunch',
          open_day: 1,
          close_day: 1,
          open_time: '12:00',
          close_time: '15:00',
        }),
      ],
      coreServicePeriodRows: [
        buildServicePeriodRow({
          booking_option: 'lunch',
          day_of_week: 1,
          start_time: '12:00:00',
          end_time: '15:00:00',
        }),
      ],
    });

    const bookingHours = buildBookingHoursNormalization({
      operatingHours: { matchStatus: 'matched' },
      servicePeriods,
    });

    expect(bookingHours.matchStatus).toBe('partial');
    expect(bookingHours.missingInputs).toEqual([
      'reservation interval minutes',
      'reservation slot times',
      'default reservation duration',
      'last seating buffer',
      'lifecycle grace rules',
    ]);
    expect(bookingHours.warnings).toEqual([
      'GBP still cannot verify slot generation, interval, and duration rules on its own.',
    ]);
  });
});
