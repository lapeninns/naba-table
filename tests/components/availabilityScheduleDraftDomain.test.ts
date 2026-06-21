import { describe, expect, it } from 'vitest';

import {
  clearServiceMealError,
  clearServiceMealTimeError,
  clearTurnBandErrors,
  clearWeeklyError,
  removeOverrideAtIndex,
  updateDayConfigsForWeeklyPatch,
  updateMealEnabled,
  updateMealTime,
  updateOverrideRows,
  updateTurnBandsDraft,
  updateWeeklyRows,
} from '@/components/features/restaurant-settings/availabilityScheduleDraftDomain';

import type { DayServiceConfig } from '@/components/features/restaurant-settings/servicePeriodsMapper';
import type { OverrideRow, WeeklyRow } from '@/components/features/restaurant-settings/types';

function weeklyRow(dayOfWeek: number): WeeklyRow {
  return {
    dayOfWeek,
    opensAt: '12:00',
    closesAt: '22:00',
    isClosed: false,
    notes: '',
    reservationIntervalMinutes: '15',
    reservationSlotTimes: '',
  };
}

function dayConfig(dayOfWeek: number): DayServiceConfig {
  return {
    dayOfWeek,
    label: dayOfWeek === 0 ? 'Sunday' : 'Monday',
    opensAt: '12:00',
    closesAt: '22:00',
    isClosed: false,
    lunch: {
      enabled: true,
      endTime: '15:00',
      name: 'Lunch',
      startTime: '12:00',
    },
    dinner: {
      enabled: true,
      endTime: '22:00',
      name: 'Dinner',
      startTime: '17:00',
    },
  };
}

function overrideRow(date: string): OverrideRow {
  return {
    id: date,
    date,
    isClosed: false,
    notes: '',
    opensAt: '12:00',
    closesAt: '22:00',
    reservationIntervalMinutes: '15',
    reservationSlotTimes: '',
  };
}

describe('availabilityScheduleDraftDomain', () => {
  it('updates weekly rows and mirrors closed days into service configs', () => {
    const weeklyRows = [weeklyRow(0), weeklyRow(1)];
    const dayConfigs = [dayConfig(0), dayConfig(1)];

    expect(updateWeeklyRows(weeklyRows, 1, { isClosed: true })[1]?.isClosed).toBe(true);

    const nextDayConfigs = updateDayConfigsForWeeklyPatch(dayConfigs, 1, {
      closesAt: '21:00',
      isClosed: true,
    });

    expect(nextDayConfigs[0]).toBe(dayConfigs[0]);
    expect(nextDayConfigs[1]).toMatchObject({
      closesAt: '21:00',
      isClosed: true,
      lunch: { enabled: false },
      dinner: { enabled: false },
    });
  });

  it('clears weekly and service validation errors for targeted rows', () => {
    expect(clearWeeklyError({ 1: { opensAt: 'Required' } }, 1)).toEqual({});
    expect(
      clearServiceMealError(
        {
          1: {
            lunch: { start: 'Too early' },
            dinner: { end: 'Too late' },
          },
        },
        1,
        'lunch',
      ),
    ).toEqual({ 1: { dinner: { end: 'Too late' } } });
    expect(
      clearServiceMealTimeError(
        {
          1: {
            lunch: { start: 'Too early', end: 'Too late' },
          },
        },
        1,
        'lunch',
        'startTime',
      ),
    ).toEqual({ 1: { lunch: { end: 'Too late' } } });
  });

  it('updates override rows and removes paired override state by index', () => {
    const rows = [overrideRow('2026-05-20'), overrideRow('2026-05-21')];

    expect(updateOverrideRows(rows, 1, { isClosed: true })[1]?.isClosed).toBe(true);
    expect(removeOverrideAtIndex(rows, 0)).toEqual([rows[1]]);
  });

  it('updates service meal toggles and meal times without mutating sibling days', () => {
    const dayConfigs = [dayConfig(0), dayConfig(1)];

    expect(updateMealEnabled(dayConfigs, 1, 'dinner', false)[1]?.dinner.enabled).toBe(false);
    expect(updateMealTime(dayConfigs, 1, 'lunch', 'startTime', '12:30')[1]?.lunch.startTime).toBe(
      '12:30',
    );
    expect(updateMealTime(dayConfigs, 1, 'lunch', 'startTime', '12:30')[0]).toBe(dayConfigs[0]);
  });

  it('removes empty turn band drafts and clears stale row errors', () => {
    expect(
      updateTurnBandsDraft(
        {
          lunch: [{ maxPartySize: 4, durationMinutes: 90 }],
        },
        'lunch',
        [],
      ),
    ).toEqual({});
    expect(updateTurnBandsDraft({}, 'dinner', [{ maxPartySize: 6, durationMinutes: 120 }])).toEqual(
      {
        dinner: [{ maxPartySize: 6, durationMinutes: 120 }],
      },
    );
    expect(clearTurnBandErrors({ lunch: [{ durationMinutes: 'Required' }] }, 'lunch')).toEqual({});
  });
});
