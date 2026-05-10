import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { buildGoogleBusinessProfileCoreNormalization } from '@/server/google-business-profile/core-normalization';

import type { Database } from '@/types/supabase';

type RestaurantHourRow = Database['public']['Tables']['restaurant_hours']['Row'];
type RestaurantOperatingHoursRow =
  Database['public']['Tables']['restaurant_operating_hours']['Row'];
type RestaurantServicePeriodRow = Database['public']['Tables']['restaurant_service_periods']['Row'];

function buildHourRow(overrides: Partial<RestaurantHourRow>): RestaurantHourRow {
  return {
    id: overrides.id ?? randomUUID(),
    restaurant_id: overrides.restaurant_id ?? 'rest-1',
    hours_type: overrides.hours_type ?? 'public',
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

function buildOperatingHoursRow(
  overrides: Partial<RestaurantOperatingHoursRow>,
): RestaurantOperatingHoursRow {
  return {
    id: overrides.id ?? randomUUID(),
    restaurant_id: overrides.restaurant_id ?? 'rest-1',
    day_of_week: overrides.day_of_week ?? null,
    effective_date: overrides.effective_date ?? null,
    opens_at: overrides.opens_at ?? null,
    closes_at: overrides.closes_at ?? null,
    is_closed: overrides.is_closed ?? false,
    notes: overrides.notes ?? null,
    reservation_interval_minutes: overrides.reservation_interval_minutes ?? null,
    reservation_slot_times: overrides.reservation_slot_times ?? null,
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

describe('google business profile core normalization', () => {
  it('uses public hours for the operating envelope and kitchen windows for service periods', () => {
    const normalization = buildGoogleBusinessProfileCoreNormalization({
      gbpHoursRows: [
        buildHourRow({
          hours_type: 'public',
          open_day: 1,
          close_day: 1,
          open_time: '12:00',
          close_time: '22:00',
        }),
        buildHourRow({
          hours_type: 'service',
          period_label: 'Kitchen',
          open_day: 1,
          close_day: 1,
          open_time: '12:00',
          close_time: '15:00',
        }),
        buildHourRow({
          hours_type: 'service',
          period_label: 'Kitchen',
          open_day: 1,
          close_day: 1,
          open_time: '17:00',
          close_time: '22:00',
          display_order: 1,
        }),
      ],
      coreOperatingHoursRows: [
        buildOperatingHoursRow({
          day_of_week: 1,
          opens_at: '12:00:00',
          closes_at: '22:00:00',
          is_closed: false,
        }),
      ],
      coreServicePeriodRows: [
        buildServicePeriodRow({
          name: 'Lunch',
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
          end_time: '22:00:00',
        }),
      ],
    });

    expect(normalization.operatingHours.source).toBe('public');
    expect(normalization.operatingHours.matchStatus).toBe('matched');
    expect(normalization.operatingHours.warnings).toEqual([]);
    expect(normalization.operatingHours.weekly.find((row) => row.dayOfWeek === 1)).toMatchObject({
      opensAt: '12:00',
      closesAt: '22:00',
      matchesCore: true,
    });
    expect(normalization.servicePeriods.matchStatus).toBe('matched');
    expect(normalization.servicePeriods.periods).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          bookingOption: 'lunch',
          dayOfWeek: 1,
          startTime: '12:00',
          endTime: '15:00',
          matchesCore: true,
        }),
        expect.objectContaining({
          bookingOption: 'dinner',
          dayOfWeek: 1,
          startTime: '17:00',
          endTime: '22:00',
          matchesCore: true,
        }),
      ]),
    );
    expect(normalization.bookingHours.matchStatus).toBe('partial');
  });

  it('normalizes special hours without treating kitchen more-hours as operating drift', () => {
    const normalization = buildGoogleBusinessProfileCoreNormalization({
      gbpHoursRows: [
        buildHourRow({
          hours_type: 'public',
          open_day: 0,
          close_day: 0,
          open_time: '12:00',
          close_time: '21:00',
        }),
        buildHourRow({
          hours_type: 'service',
          period_label: 'Kitchen',
          open_day: 0,
          close_day: 0,
          open_time: '12:00',
          close_time: '21:00',
        }),
        buildHourRow({
          hours_type: 'special',
          start_date: '2026-12-25',
          end_date: '2026-12-25',
          is_closed: true,
        }),
      ],
      coreOperatingHoursRows: [
        buildOperatingHoursRow({
          day_of_week: 0,
          opens_at: '12:00:00',
          closes_at: '21:00:00',
          is_closed: false,
        }),
        buildOperatingHoursRow({
          effective_date: '2026-12-25',
          opens_at: null,
          closes_at: null,
          is_closed: true,
        }),
      ],
      coreServicePeriodRows: [],
    });

    expect(normalization.operatingHours.source).toBe('public');
    expect(normalization.operatingHours.matchStatus).toBe('matched');
    expect(normalization.operatingHours.warnings).toEqual([]);
    expect(normalization.operatingHours.weekly.find((row) => row.dayOfWeek === 0)).toMatchObject({
      opensAt: '12:00',
      closesAt: '21:00',
      matchesCore: true,
    });
    expect(normalization.operatingHours.overrides[0]).toMatchObject({
      effectiveDate: '2026-12-25',
      isClosed: true,
      matchesCore: true,
    });
    expect(normalization.servicePeriods.matchStatus).toBe('drifted');
    expect(normalization.servicePeriods.periods).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          bookingOption: 'lunch',
          dayOfWeek: 0,
          startTime: '12:00',
          endTime: '17:00',
          matchesCore: false,
        }),
        expect.objectContaining({
          bookingOption: 'dinner',
          dayOfWeek: 0,
          startTime: '17:00',
          endTime: '21:00',
          matchesCore: false,
        }),
      ]),
    );
    expect(normalization.bookingHours.matchStatus).toBe('partial');
  });

  it('normalizes meal-labelled more hours into service periods and detects drift', () => {
    const normalization = buildGoogleBusinessProfileCoreNormalization({
      gbpHoursRows: [
        buildHourRow({
          hours_type: 'service',
          period_label: 'Lunch',
          open_day: 1,
          close_day: 1,
          open_time: '12:00',
          close_time: '15:00',
        }),
        buildHourRow({
          hours_type: 'service',
          period_label: 'Dinner',
          open_day: 1,
          close_day: 1,
          open_time: '17:00',
          close_time: '21:00',
          display_order: 1,
        }),
      ],
      coreOperatingHoursRows: [],
      coreServicePeriodRows: [
        buildServicePeriodRow({
          name: 'Lunch',
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
          end_time: '20:00:00',
        }),
      ],
    });

    expect(normalization.servicePeriods.source).toBe('more_hours');
    expect(normalization.servicePeriods.matchStatus).toBe('drifted');
    expect(normalization.servicePeriods.periods).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          bookingOption: 'lunch',
          startTime: '12:00',
          endTime: '15:00',
          matchesCore: true,
        }),
        expect.objectContaining({
          bookingOption: 'dinner',
          startTime: '17:00',
          endTime: '21:00',
          matchesCore: false,
        }),
      ]),
    );
  });

  it('infers lunch and dinner from split kitchen windows when labels are missing', () => {
    const normalization = buildGoogleBusinessProfileCoreNormalization({
      gbpHoursRows: [
        buildHourRow({
          hours_type: 'service',
          period_label: 'Kitchen',
          open_day: 2,
          close_day: 2,
          open_time: '12:00',
          close_time: '15:00',
        }),
        buildHourRow({
          hours_type: 'service',
          period_label: 'Kitchen',
          open_day: 2,
          close_day: 2,
          open_time: '17:00',
          close_time: '22:00',
          display_order: 1,
        }),
      ],
      coreOperatingHoursRows: [],
      coreServicePeriodRows: [
        buildServicePeriodRow({
          name: 'Lunch',
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

    expect(normalization.servicePeriods.matchStatus).toBe('matched');
    expect(normalization.servicePeriods.periods).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          bookingOption: 'lunch',
          dayOfWeek: 2,
          startTime: '12:00',
          endTime: '15:00',
          matchesCore: true,
        }),
        expect.objectContaining({
          bookingOption: 'dinner',
          dayOfWeek: 2,
          startTime: '17:00',
          endTime: '22:00',
          matchesCore: true,
        }),
      ]),
    );
  });

  it('infers lunch and dinner from a single kitchen window when it spans the 17:00 split', () => {
    const normalization = buildGoogleBusinessProfileCoreNormalization({
      gbpHoursRows: [
        buildHourRow({
          hours_type: 'service',
          period_label: 'Kitchen',
          open_day: 0,
          close_day: 0,
          open_time: '12:00',
          close_time: '21:00',
        }),
      ],
      coreOperatingHoursRows: [],
      coreServicePeriodRows: [
        buildServicePeriodRow({
          name: 'Lunch',
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

    expect(normalization.servicePeriods.matchStatus).toBe('matched');
    expect(normalization.servicePeriods.warnings).toEqual([]);
    expect(normalization.servicePeriods.periods).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          bookingOption: 'lunch',
          dayOfWeek: 0,
          startTime: '12:00',
          endTime: '17:00',
          matchesCore: true,
        }),
        expect.objectContaining({
          bookingOption: 'dinner',
          dayOfWeek: 0,
          startTime: '17:00',
          endTime: '21:00',
          matchesCore: true,
        }),
      ]),
    );
  });
});
