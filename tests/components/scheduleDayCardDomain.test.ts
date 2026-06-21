import { describe, expect, it } from 'vitest';

import {
  buildScheduleDayCardViewModel,
  buildScheduleDayMealEditorState,
  buildScheduleDayOpenPatch,
} from '@/components/features/restaurant-settings/availability/scheduleDayCardDomain';

import type { DayErrors } from '@/components/features/restaurant-settings/availabilityScheduleValidation';
import type { DayServiceConfig } from '@/components/features/restaurant-settings/servicePeriodsMapper';
import type { WeeklyRow } from '@/components/features/restaurant-settings/types';

function makeWeeklyRow(overrides: Partial<WeeklyRow> = {}): WeeklyRow {
  return {
    dayOfWeek: 1,
    opensAt: '09:00',
    closesAt: '22:00',
    isClosed: false,
    notes: '',
    reservationIntervalMinutes: '30',
    reservationSlotTimes: '',
    ...overrides,
  };
}

function makeDayConfig(overrides: Partial<DayServiceConfig> = {}): DayServiceConfig {
  return {
    dayOfWeek: 1,
    label: 'Monday',
    opensAt: '09:00',
    closesAt: '22:00',
    isClosed: false,
    lunch: {
      enabled: true,
      endTime: '14:00',
      name: 'Lunch',
      startTime: '12:00',
    },
    dinner: {
      enabled: true,
      endTime: '21:00',
      name: 'Dinner',
      startTime: '18:00',
    },
    ...overrides,
  };
}

describe('scheduleDayCardDomain', () => {
  it('builds the card label and closed state from the service day or weekly row fallback', () => {
    expect(
      buildScheduleDayCardViewModel({
        day: makeDayConfig({ label: 'Bank Holiday Monday' }),
        row: makeWeeklyRow({ dayOfWeek: 1, isClosed: false }),
      }),
    ).toEqual({
      dayLabel: 'Bank Holiday Monday',
      isClosed: false,
    });

    expect(
      buildScheduleDayCardViewModel({
        day: undefined,
        row: makeWeeklyRow({ dayOfWeek: 6, isClosed: true }),
      }),
    ).toEqual({
      dayLabel: 'Saturday',
      isClosed: true,
    });
  });

  it('builds the open-day toggle patch without leaking stale closed hours', () => {
    const row = makeWeeklyRow({ closesAt: '23:00', opensAt: '10:00' });

    expect(buildScheduleDayOpenPatch(row, true)).toEqual({
      isClosed: false,
      opensAt: '10:00',
      closesAt: '23:00',
    });

    expect(buildScheduleDayOpenPatch(row, false)).toEqual({
      isClosed: true,
      opensAt: '',
      closesAt: '',
    });
  });

  it('builds enabled meal editor state with meal-specific errors', () => {
    const dayError: DayErrors[number] = {
      lunch: { start: 'Lunch start required' },
    };

    expect(
      buildScheduleDayMealEditorState({
        day: makeDayConfig(),
        dayError,
        hasRequiredOccasions: true,
        mealKey: 'lunch',
      }),
    ).toMatchObject({
      disabled: false,
      errors: { start: 'Lunch start required' },
      meal: {
        enabled: true,
        name: 'Lunch',
        startTime: '12:00',
      },
    });
  });

  it('falls back and disables meal editors when service day data or occasions are missing', () => {
    expect(
      buildScheduleDayMealEditorState({
        day: undefined,
        dayError: undefined,
        hasRequiredOccasions: true,
        mealKey: 'dinner',
      }),
    ).toEqual({
      disabled: true,
      errors: undefined,
      meal: {
        enabled: false,
        endTime: '',
        name: 'Dinner',
        startTime: '',
      },
    });

    expect(
      buildScheduleDayMealEditorState({
        day: makeDayConfig({ isClosed: true }),
        dayError: undefined,
        hasRequiredOccasions: true,
        mealKey: 'lunch',
      }).disabled,
    ).toBe(true);

    expect(
      buildScheduleDayMealEditorState({
        day: makeDayConfig(),
        dayError: undefined,
        hasRequiredOccasions: false,
        mealKey: 'lunch',
      }).disabled,
    ).toBe(true);
  });
});
