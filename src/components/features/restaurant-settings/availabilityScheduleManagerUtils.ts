import {
  canonicalizeRequiredTime,
  parseIntervalInput,
  parseSlotTimesInput,
  toComparableTime,
  toInputTime,
} from './availabilityScheduleTime';
import { DAYS_OF_WEEK, type OverrideRow, type WeeklyRow } from './types';

import type { WeeklyHoursEntry } from './servicePeriodsMapper';
import type { OperatingHoursSnapshot } from '@/services/ops/restaurants';

export type MealKey = 'lunch' | 'dinner';

export const MEAL_LABELS: Record<MealKey, string> = {
  lunch: 'Lunch',
  dinner: 'Dinner',
};

export const MEAL_TOOLTIPS: Record<MealKey, string> = {
  lunch: 'Defines when lunch reservations can be booked within the kitchen operating window.',
  dinner:
    'Defines when dinner reservations can be booked. Keep times inside the kitchen open/close window.',
};

export type RequiredOccasionSpec = {
  key: MealKey;
  label: string;
  shortLabel: string;
  description: string;
  defaultDurationMinutes: number;
  displayOrder: number;
};

export const REQUIRED_SERVICE_OCCASIONS: readonly RequiredOccasionSpec[] = [
  {
    key: 'lunch',
    label: 'Lunch',
    shortLabel: 'Lunch',
    description: 'Lunch reservation occasion.',
    defaultDurationMinutes: 90,
    displayOrder: 10,
  },
  {
    key: 'dinner',
    label: 'Dinner',
    shortLabel: 'Dinner',
    description: 'Dinner reservation occasion.',
    defaultDurationMinutes: 120,
    displayOrder: 20,
  },
];

export const defaultWeeklyRows = (): WeeklyRow[] =>
  DAYS_OF_WEEK.map((_, index) => ({
    dayOfWeek: index,
    opensAt: '',
    closesAt: '',
    isClosed: true,
    notes: '',
    reservationIntervalMinutes: '',
    reservationSlotTimes: '',
  }));

function makeOverrideId(): string {
  const native = globalThis.crypto?.randomUUID?.();
  if (native) {
    return native;
  }

  const bytes = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(
    16,
    20,
  )}-${hex.slice(20)}`;
}

export const defaultOverrideRow = (): OverrideRow => ({
  id: makeOverrideId(),
  effectiveDate: new Date().toISOString().slice(0, 10),
  opensAt: '',
  closesAt: '',
  isClosed: true,
  notes: '',
  reservationIntervalMinutes: '',
  reservationSlotTimes: '',
});

export function mapWeeklyFromResponse(snapshot: OperatingHoursSnapshot['weekly']): WeeklyRow[] {
  return DAYS_OF_WEEK.map((_, index) => {
    const found = snapshot.find((row) => row.dayOfWeek === index);
    return {
      dayOfWeek: index,
      opensAt: toInputTime(found?.opensAt ?? null),
      closesAt: toInputTime(found?.closesAt ?? null),
      isClosed: found?.isClosed ?? true,
      notes: found?.notes ?? '',
      reservationIntervalMinutes:
        found?.reservationIntervalMinutes !== undefined &&
        found?.reservationIntervalMinutes !== null
          ? String(found.reservationIntervalMinutes)
          : '',
      reservationSlotTimes: Array.isArray(found?.reservationSlotTimes)
        ? found.reservationSlotTimes.join(', ')
        : '',
    };
  });
}

export function mapOverridesFromResponse(
  overrides: OperatingHoursSnapshot['overrides'],
): OverrideRow[] {
  return overrides.map((row) => ({
    id: row.id,
    effectiveDate: row.effectiveDate,
    opensAt: toInputTime(row.opensAt ?? null),
    closesAt: toInputTime(row.closesAt ?? null),
    isClosed: row.isClosed,
    notes: row.notes ?? '',
    reservationIntervalMinutes:
      row.reservationIntervalMinutes !== undefined && row.reservationIntervalMinutes !== null
        ? String(row.reservationIntervalMinutes)
        : '',
    reservationSlotTimes: Array.isArray(row.reservationSlotTimes)
      ? row.reservationSlotTimes.join(', ')
      : '',
  }));
}

export const buildWeeklyHoursMap = (weeklyRows: WeeklyRow[]): Record<number, WeeklyHoursEntry> =>
  weeklyRows.reduce<Record<number, WeeklyHoursEntry>>((acc, row) => {
    acc[row.dayOfWeek] = {
      opensAt: row.isClosed ? null : toComparableTime(row.opensAt),
      closesAt: row.isClosed ? null : toComparableTime(row.closesAt),
      isClosed: row.isClosed,
    };
    return acc;
  }, {});

export const extractRequiredOccasionKeys = (options: Array<{ key: string }>) => {
  const map: { lunch?: string; dinner?: string } = {};
  options.forEach((definition) => {
    const lower = definition.key.toLowerCase();
    if (lower === 'lunch' || lower === 'dinner') {
      map[lower] = definition.key;
    }
  });
  return map;
};

export function buildMissingRequiredOccasions(keys: { lunch?: string; dinner?: string }) {
  return REQUIRED_SERVICE_OCCASIONS.filter((occasion) => !keys[occasion.key]);
}

export function buildOperatingHoursPayload(
  weeklyRows: WeeklyRow[],
  overrideRows: OverrideRow[],
): OperatingHoursSnapshot {
  return {
    weekly: weeklyRows.map((row) => ({
      dayOfWeek: row.dayOfWeek,
      opensAt: row.isClosed ? null : row.opensAt ? canonicalizeRequiredTime(row.opensAt) : null,
      closesAt: row.isClosed ? null : row.closesAt ? canonicalizeRequiredTime(row.closesAt) : null,
      isClosed: row.isClosed,
      notes: row.notes || null,
      reservationIntervalMinutes: row.isClosed
        ? null
        : parseIntervalInput(row.reservationIntervalMinutes).value,
      reservationSlotTimes: row.isClosed
        ? null
        : parseSlotTimesInput(row.reservationSlotTimes).value,
    })),
    overrides: overrideRows.map((row) => ({
      id: row.id,
      effectiveDate: row.effectiveDate,
      opensAt: row.isClosed ? null : row.opensAt ? canonicalizeRequiredTime(row.opensAt) : null,
      closesAt: row.isClosed ? null : row.closesAt ? canonicalizeRequiredTime(row.closesAt) : null,
      isClosed: row.isClosed,
      notes: row.notes || null,
      reservationIntervalMinutes: row.isClosed
        ? null
        : parseIntervalInput(row.reservationIntervalMinutes).value,
      reservationSlotTimes: row.isClosed
        ? null
        : parseSlotTimesInput(row.reservationSlotTimes).value,
    })),
  };
}

export {
  canonicalizeRequiredTime,
  formatKitchenRange,
  parseIntervalInput,
  parseSlotTimesInput,
  toComparableTime,
  toInputTime,
} from './availabilityScheduleTime';
export {
  validateHours,
  validateServices,
  type DayErrors,
  type MealError,
} from './availabilityScheduleValidation';
