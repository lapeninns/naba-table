import { describe, expect, it } from 'vitest';

import {
  buildServicePeriodPayload,
  buildServicePeriodState,
  type DayServiceConfig,
} from '@/components/features/restaurant-settings/servicePeriodsMapper';

import type { ServicePeriodRow } from '@/components/features/restaurant-settings/types';

const dayLabels = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const weeklyHours = {
  0: { opensAt: '12:00', closesAt: '22:00', isClosed: false },
  1: { opensAt: '12:00', closesAt: '23:00', isClosed: false },
  2: { opensAt: null, closesAt: null, isClosed: true },
  3: { opensAt: '11:00', closesAt: '21:00', isClosed: false },
  4: { opensAt: '11:30', closesAt: '22:30', isClosed: false },
  5: { opensAt: '11:30', closesAt: '23:30', isClosed: false },
  6: { opensAt: '12:00', closesAt: '22:00', isClosed: false },
};

const basePeriods: ServicePeriodRow[] = [
  {
    id: 'lunch-mon',
    name: 'Lunch Window',
    dayOfWeek: 1,
    startTime: '12:00',
    endTime: '15:00',
    bookingOption: 'lunch',
  },
  {
    id: 'dinner-mon',
    name: 'Dinner Window',
    dayOfWeek: 1,
    startTime: '17:00',
    endTime: '22:30',
    bookingOption: 'dinner',
  },
  {
    id: 'drinks-mon',
    name: 'Bar All Day',
    dayOfWeek: 1,
    startTime: '12:00',
    endTime: '23:00',
    bookingOption: 'drinks',
  },
  {
    id: 'chef-special',
    name: 'Chef Special',
    dayOfWeek: null,
    startTime: '14:00',
    endTime: '16:00',
    bookingOption: 'chef_special',
  },
];

describe('servicePeriodsMapper', () => {
  it('builds day configs using weekly hours with preserved IDs', () => {
    const { days, custom } = buildServicePeriodState({
      periods: basePeriods,
      weeklyHours,
      dayLabels,
    });

    expect(days).toHaveLength(7);

    const monday = days.find((day) => day.dayOfWeek === 1)!;
    expect(monday.isClosed).toBe(false);
    expect(monday.drinks?.startTime).toBe('12:00');
    expect(monday.drinks?.endTime).toBe('23:00'); // from operating hours
    expect(monday.lunch.enabled).toBe(true);
    expect(monday.lunch.id).toBe('lunch-mon');
    expect(monday.dinner.enabled).toBe(true);
    expect(monday.dinner.startTime).toBe('17:00');

    const tuesday = days.find((day) => day.dayOfWeek === 2)!;
    expect(tuesday.isClosed).toBe(true);
    expect(tuesday.drinks).toBeNull();
    expect(tuesday.lunch.enabled).toBe(false);

    expect(custom).toHaveLength(1);
    expect(custom[0].name).toBe('Chef Special');
  });

  it('builds payload from configs merging custom rows', () => {
    const { days, custom } = buildServicePeriodState({
      periods: basePeriods,
      weeklyHours,
      dayLabels,
    });

    const payload = buildServicePeriodPayload(days, {
      customRows: custom,
      canonicalizeTime: (value) => value,
      occasionKeys: {
        lunch: 'lunch',
        dinner: 'dinner',
        drinks: 'drinks',
      },
    });

    const mondayRows = payload.filter((row) => row.dayOfWeek === 1);
    expect(mondayRows).toHaveLength(3);
    expect(payload.find((row) => row.id === 'chef-special')).toBeTruthy();
  });

  it('omits drinks when the day is closed', () => {
    const closedConfig: DayServiceConfig = {
      dayOfWeek: 0,
      label: 'Sunday',
      opensAt: null,
      closesAt: null,
      isClosed: true,
      drinks: null,
      lunch: { id: undefined, name: 'Lunch', startTime: '', endTime: '', enabled: false },
      dinner: { id: undefined, name: 'Dinner', startTime: '', endTime: '', enabled: false },
    };

    const payload = buildServicePeriodPayload([closedConfig], {
      customRows: [],
      canonicalizeTime: (value) => value,
      occasionKeys: { lunch: 'lunch', dinner: 'dinner', drinks: 'drinks' },
    });

    expect(payload).toHaveLength(0);
  });
});
