import { describe, expect, it } from 'vitest';

import {
  buildServiceWindowDraftOverrides,
  buildServiceWindowDriftFieldsForDay,
  buildServiceWindowInitialState,
  buildServiceWindowSavePayload,
  clearServiceWindowMealError,
  updateServiceWindowMealTime,
  updateServiceWindowMealToggle,
} from '@/components/features/restaurant-settings/availability/serviceWindowsCardDomain';

import type { DayServiceConfig } from '@/components/features/restaurant-settings/servicePeriodsMapper';
import type { DualSyncFieldSummary } from '@/services/ops/dual-sync';
import type { OperatingHoursSnapshot, ServicePeriodRow } from '@/services/ops/restaurants';

describe('serviceWindowsCardDomain', () => {
  it('builds service-window initial state from operating hours and service periods', () => {
    const initial = buildServiceWindowInitialState({
      operatingHours: operatingHours(),
      servicePeriods: [
        {
          bookingOption: 'lunch',
          dayOfWeek: 1,
          endTime: '14:30:00',
          id: 'lunch-1',
          name: 'Lunch',
          startTime: '12:00:00',
        },
      ],
    });

    expect(initial.days[1]).toMatchObject({
      closesAt: '22:00',
      isClosed: false,
      lunch: {
        enabled: true,
        endTime: '14:30',
        id: 'lunch-1',
        startTime: '12:00',
      },
      opensAt: '10:00',
    });
    expect(initial.customRows).toEqual([]);
  });

  it('updates meal toggles, meal times, and clears scoped validation errors', () => {
    const days = [dayConfig({ dayOfWeek: 0 })];

    expect(
      updateServiceWindowMealToggle({
        current: days,
        dayIndex: 0,
        mealKey: 'lunch',
        value: false,
      })[0].lunch.enabled,
    ).toBe(false);

    expect(
      updateServiceWindowMealTime({
        current: days,
        dayIndex: 0,
        field: 'startTime',
        mealKey: 'dinner',
        value: '18:30',
      })[0].dinner.startTime,
    ).toBe('18:30');

    expect(
      clearServiceWindowMealError({
        dayIndex: 0,
        errors: {
          0: {
            dinner: { end: 'After kitchen closes', start: 'Before kitchen opens' },
          },
        },
        field: 'startTime',
        mealKey: 'dinner',
      }),
    ).toEqual({
      0: {
        dinner: { end: 'After kitchen closes' },
      },
    });
  });

  it('matches GBP drift fields for enabled service windows and builds draft overrides', () => {
    const day = dayConfig({ dayOfWeek: 1 });
    const fields: DualSyncFieldSummary[] = [
      driftField('servicePeriods.1|12:00|14:00|lunch|lunch'),
      driftField('servicePeriods.1|17:00|21:00|dinner|dinner'),
    ];

    expect(
      buildServiceWindowDriftFieldsForDay({
        day,
        occasionKeys: { dinner: 'dinner', lunch: 'lunch' },
        servicePeriodDriftFields: fields,
      }).map((field) => field.fieldKey),
    ).toEqual(fields.map((field) => field.fieldKey));

    expect(
      buildServiceWindowDraftOverrides({
        dayConfigs: [day],
        occasionKeys: { dinner: 'dinner', lunch: 'lunch' },
        servicePeriodDriftFields: fields,
      }),
    ).toEqual([
      [
        'servicePeriods.1|12:00|14:00|lunch|lunch',
        {
          bookingOption: 'lunch',
          dayOfWeek: 1,
          endTime: '14:00',
          name: 'Lunch',
          startTime: '12:00',
        },
      ],
      [
        'servicePeriods.1|17:00|21:00|dinner|dinner',
        {
          bookingOption: 'dinner',
          dayOfWeek: 1,
          endTime: '21:00',
          name: 'Dinner',
          startTime: '17:00',
        },
      ],
    ]);

    expect(
      buildServiceWindowDriftFieldsForDay({
        day,
        occasionKeys: { dinner: null, lunch: null },
        servicePeriodDriftFields: fields,
      }),
    ).toEqual([]);
  });

  it('builds save payload and disables meal windows on closed days', () => {
    const customRows: ServicePeriodRow[] = [
      {
        bookingOption: 'brunch',
        dayOfWeek: null,
        endTime: '12:00',
        name: 'Brunch',
        startTime: '10:00',
      },
    ];

    const payload = buildServiceWindowSavePayload({
      customRows,
      dayConfigs: [dayConfig({ dayOfWeek: 1 }), dayConfig({ dayOfWeek: 2, isClosed: true })],
      occasionKeys: { dinner: 'dinner', lunch: 'lunch' },
    });

    expect(payload).toEqual([
      customRows[0],
      {
        bookingOption: 'lunch',
        dayOfWeek: 1,
        endTime: '14:00',
        id: undefined,
        name: 'Lunch',
        startTime: '12:00',
      },
      {
        bookingOption: 'dinner',
        dayOfWeek: 1,
        endTime: '21:00',
        id: undefined,
        name: 'Dinner',
        startTime: '17:00',
      },
    ]);
  });
});

function operatingHours(): OperatingHoursSnapshot {
  return {
    overrides: [],
    weekly: Array.from({ length: 7 }, (_, dayOfWeek) => ({
      closesAt: dayOfWeek === 1 ? '22:00:00' : null,
      dayOfWeek,
      isClosed: dayOfWeek !== 1,
      notes: null,
      opensAt: dayOfWeek === 1 ? '10:00:00' : null,
      reservationIntervalMinutes: null,
      reservationSlotTimes: null,
    })),
  };
}

function dayConfig(overrides: Partial<DayServiceConfig>): DayServiceConfig {
  return {
    closesAt: '22:00',
    dayOfWeek: overrides.dayOfWeek ?? 1,
    dinner: {
      enabled: true,
      endTime: '21:00',
      name: 'Dinner',
      startTime: '17:00',
    },
    isClosed: overrides.isClosed ?? false,
    label: 'Monday',
    lunch: {
      enabled: true,
      endTime: '14:00',
      name: 'Lunch',
      startTime: '12:00',
    },
    opensAt: '10:00',
    ...overrides,
  };
}

function driftField(fieldKey: string): DualSyncFieldSummary {
  return {
    coreStatus: 'present',
    coreValue: null,
    fieldKey,
    gbpStatus: 'present',
    gbpValue: null,
    label: fieldKey,
    liveStatus: 'drifted',
    savedNeedsReview: true,
    sectionKey: 'servicePeriods',
  } as DualSyncFieldSummary;
}
