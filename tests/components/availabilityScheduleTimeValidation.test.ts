import { describe, expect, it } from 'vitest';

import {
  formatKitchenRange,
  parseIntervalInput,
  parseSlotTimesInput,
} from '@/components/features/restaurant-settings/availabilityScheduleTime';
import {
  validateHours,
  validateServices,
} from '@/components/features/restaurant-settings/availabilityScheduleValidation';

import type { DayServiceConfig } from '@/components/features/restaurant-settings/servicePeriodsMapper';
import type { OverrideRow, WeeklyRow } from '@/components/features/restaurant-settings/types';

const openWeeklyRow = (patch: Partial<WeeklyRow> = {}): WeeklyRow => ({
  dayOfWeek: 1,
  opensAt: '12:00',
  closesAt: '22:00',
  isClosed: false,
  notes: '',
  reservationIntervalMinutes: '',
  reservationSlotTimes: '',
  ...patch,
});

const openOverrideRow = (patch: Partial<OverrideRow> = {}): OverrideRow => ({
  id: 'override-1',
  effectiveDate: '2026-12-25',
  opensAt: '12:00',
  closesAt: '22:00',
  isClosed: false,
  notes: '',
  reservationIntervalMinutes: '',
  reservationSlotTimes: '',
  ...patch,
});

const openServiceDay = (patch: Partial<DayServiceConfig> = {}): DayServiceConfig => ({
  dayOfWeek: 1,
  label: 'Monday',
  opensAt: '12:00',
  closesAt: '22:00',
  isClosed: false,
  lunch: {
    name: 'Lunch',
    enabled: true,
    startTime: '12:00',
    endTime: '15:00',
  },
  dinner: {
    name: 'Dinner',
    enabled: true,
    startTime: '17:00',
    endTime: '22:00',
  },
  ...patch,
});

describe('availability schedule time helpers', () => {
  it('validates whole-number reservation intervals inside the supported range', () => {
    expect(parseIntervalInput('7.5')).toEqual({
      value: null,
      error: 'Must be a whole number',
    });
    expect(parseIntervalInput('181')).toEqual({
      value: null,
      error: 'Must be between 1-180',
    });
    expect(parseIntervalInput('15')).toEqual({ value: 15 });
  });

  it('normalizes comma-separated reservation slot times and rejects invalid values', () => {
    expect(parseSlotTimesInput('12:00, 12:30, 12:00')).toEqual({
      value: ['12:00', '12:30'],
    });
    expect(parseSlotTimesInput('12:00, not-time')).toEqual({
      value: null,
      error: 'Use HH:MM format (e.g. 16:00)',
    });
  });

  it('formats kitchen ranges only when both endpoints exist', () => {
    expect(formatKitchenRange('12:00', '22:00')).toBe('12:00 – 22:00');
    expect(formatKitchenRange(null, '22:00')).toBe('Not set');
  });
});

describe('availability schedule validation', () => {
  it('rejects weekly rows when close time is not after open time', () => {
    const validation = validateHours([openWeeklyRow({ closesAt: '11:59' })], []);

    expect(validation.isValid).toBe(false);
    expect(validation.weeklyErrors[1]).toMatchObject({
      closesAt: 'Must be after open',
    });
  });

  it('flags duplicate override dates on both rows', () => {
    const validation = validateHours(
      [],
      [openOverrideRow({ id: 'override-1' }), openOverrideRow({ id: 'override-2' })],
    );

    expect(validation.isValid).toBe(false);
    expect(validation.overrideErrors[0]).toMatchObject({
      effectiveDate: 'Duplicate date',
    });
    expect(validation.overrideErrors[1]).toMatchObject({
      effectiveDate: 'Duplicate date',
    });
  });

  it('keeps service windows inside the kitchen hours', () => {
    const validation = validateServices([
      openServiceDay({
        lunch: {
          name: 'Lunch',
          enabled: true,
          startTime: '11:30',
          endTime: '15:00',
        },
        dinner: {
          name: 'Dinner',
          enabled: true,
          startTime: '17:00',
          endTime: '22:30',
        },
      }),
    ]);

    expect(validation).toEqual({
      isValid: false,
      serviceErrors: {
        1: {
          lunch: { start: 'Before kitchen opens' },
          dinner: { end: 'After kitchen closes' },
        },
      },
    });
  });
});
