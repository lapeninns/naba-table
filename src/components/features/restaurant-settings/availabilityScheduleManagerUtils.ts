'use client';

import {
  RESERVATION_INTERVAL_MAX,
  RESERVATION_INTERVAL_MIN,
} from '@/lib/restaurants/reservation-interval';
import { normalizeTime } from '@reserve/shared/time';

import { type DayServiceConfig, type WeeklyHoursEntry } from './servicePeriodsMapper';
import { DAYS_OF_WEEK, type OverrideErrors, type OverrideRow, type WeeklyErrors, type WeeklyRow } from './types';

import type { OperatingHoursSnapshot } from '@/services/ops/restaurants';

export type MealKey = 'lunch' | 'dinner';

export type MealError = {
  start?: string;
  end?: string;
};

export type DayErrors = Record<number, Partial<Record<MealKey, MealError>>>;

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

export const defaultOverrideRow = (): OverrideRow => ({
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

export function canonicalizeRequiredTime(value: string): string {
  const normalized = normalizeTime(value);
  if (normalized) {
    return normalized;
  }
  const trimmed = value.trim();
  return trimmed.length >= 5 ? trimmed.slice(0, 5) : trimmed;
}

export function toInputTime(value: string | null | undefined): string {
  if (value === null || value === undefined) {
    return '';
  }
  return canonicalizeRequiredTime(value);
}

export function toComparableTime(value: string | null | undefined): string | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const normalized = normalizeTime(value);
  if (normalized) {
    return normalized;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.length >= 5 ? trimmed.slice(0, 5) : trimmed;
}

export function parseIntervalInput(value: string): { value: number | null; error?: string } {
  const trimmed = value.trim();
  if (!trimmed) {
    return { value: null };
  }
  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed)) {
    return { value: null, error: 'Must be a whole number' };
  }
  if (parsed < RESERVATION_INTERVAL_MIN || parsed > RESERVATION_INTERVAL_MAX) {
    return {
      value: null,
      error: `Must be between ${RESERVATION_INTERVAL_MIN}-${RESERVATION_INTERVAL_MAX}`,
    };
  }
  return { value: parsed };
}

export function parseSlotTimesInput(value: string): { value: string[] | null; error?: string } {
  const trimmed = value.trim();
  if (!trimmed) {
    return { value: null };
  }
  const parts = trimmed
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) {
    return { value: null };
  }
  const normalized: string[] = [];
  const seen = new Set<string>();
  for (const part of parts) {
    const time = normalizeTime(part);
    if (!time) {
      return { value: null, error: 'Use HH:MM format (e.g. 16:00)' };
    }
    if (!seen.has(time)) {
      seen.add(time);
      normalized.push(time);
    }
  }
  return { value: normalized };
}

export const buildWeeklyHoursMap = (
  weeklyRows: WeeklyRow[],
): Record<number, WeeklyHoursEntry> =>
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

export function validateHours(
  weeklyRows: WeeklyRow[],
  overrideRows: OverrideRow[],
): {
  isValid: boolean;
  weeklyErrors: WeeklyErrors;
  overrideErrors: OverrideErrors;
} {
  let isValid = true;
  const weeklyErrors: WeeklyErrors = {};

  weeklyRows.forEach((row) => {
    if (row.isClosed) {
      return;
    }
    const errors: WeeklyErrors[number] = {};
    const openComparable = toComparableTime(row.opensAt);
    const closeComparable = toComparableTime(row.closesAt);
    const intervalResult = parseIntervalInput(row.reservationIntervalMinutes);
    const slotResult = parseSlotTimesInput(row.reservationSlotTimes);

    if (!row.opensAt) {
      errors.opensAt = 'Required';
    } else if (!openComparable) {
      errors.opensAt = 'Invalid time';
    }

    if (!row.closesAt) {
      errors.closesAt = 'Required';
    } else if (!closeComparable) {
      errors.closesAt = 'Invalid time';
    }

    if (
      !errors.opensAt &&
      !errors.closesAt &&
      openComparable &&
      closeComparable &&
      openComparable >= closeComparable
    ) {
      errors.closesAt = 'Must be after open';
    }

    if (intervalResult.error) {
      errors.reservationIntervalMinutes = intervalResult.error;
    }
    if (slotResult.error) {
      errors.reservationSlotTimes = slotResult.error;
    }

    if (Object.keys(errors).length > 0) {
      weeklyErrors[row.dayOfWeek] = errors;
      isValid = false;
    }
  });

  const overrideErrors: OverrideErrors = overrideRows.map(() => ({}));
  const seenDates = new Map<string, number>();

  overrideRows.forEach((row, index) => {
    const errors: OverrideErrors[number] = {};
    const intervalResult = parseIntervalInput(row.reservationIntervalMinutes);
    const slotResult = parseSlotTimesInput(row.reservationSlotTimes);

    if (!row.effectiveDate) {
      errors.effectiveDate = 'Required';
    } else if (seenDates.has(row.effectiveDate)) {
      errors.effectiveDate = 'Duplicate date';
      const dupIdx = seenDates.get(row.effectiveDate)!;
      overrideErrors[dupIdx].effectiveDate = 'Duplicate date';
    } else {
      seenDates.set(row.effectiveDate, index);
    }

    if (!row.isClosed) {
      const openComparable = toComparableTime(row.opensAt);
      const closeComparable = toComparableTime(row.closesAt);

      if (!row.opensAt) {
        errors.opensAt = 'Required';
      } else if (!openComparable) {
        errors.opensAt = 'Invalid time';
      }

      if (!row.closesAt) {
        errors.closesAt = 'Required';
      } else if (!closeComparable) {
        errors.closesAt = 'Invalid time';
      }

      if (
        !errors.opensAt &&
        !errors.closesAt &&
        openComparable &&
        closeComparable &&
        openComparable >= closeComparable
      ) {
        errors.closesAt = 'Must be after open';
      }
    }

    if (intervalResult.error) {
      errors.reservationIntervalMinutes = intervalResult.error;
    }
    if (slotResult.error) {
      errors.reservationSlotTimes = slotResult.error;
    }

    if (Object.keys(errors).length > 0) {
      overrideErrors[index] = errors;
      isValid = false;
    }
  });

  return { isValid, weeklyErrors, overrideErrors };
}

export function validateServices(dayConfigs: DayServiceConfig[]): {
  isValid: boolean;
  serviceErrors: DayErrors;
} {
  let isValid = true;
  const serviceErrors: DayErrors = {};

  dayConfigs.forEach((day) => {
    if (day.isClosed) {
      return;
    }

    (['lunch', 'dinner'] as MealKey[]).forEach((mealKey) => {
      const meal = day[mealKey];
      if (!meal.enabled) {
        return;
      }
      const mealErrors: MealError = {};
      const startComparable = toComparableTime(meal.startTime);
      const endComparable = toComparableTime(meal.endTime);
      const openComparable = toComparableTime(day.opensAt);
      const closeComparable = toComparableTime(day.closesAt);

      if (!meal.startTime) {
        mealErrors.start = 'Required';
      } else if (!openComparable || !startComparable || startComparable < openComparable) {
        mealErrors.start = 'Before opening time';
      }

      if (!meal.endTime) {
        mealErrors.end = 'Required';
      } else if (!closeComparable || !endComparable || endComparable > closeComparable) {
        mealErrors.end = 'After closing time';
      }

      if (
        !mealErrors.start &&
        !mealErrors.end &&
        startComparable &&
        endComparable &&
        startComparable >= endComparable
      ) {
        mealErrors.end = 'Must be after start';
      }

      if (Object.keys(mealErrors).length > 0) {
        serviceErrors[day.dayOfWeek] = {
          ...(serviceErrors[day.dayOfWeek] ?? {}),
          [mealKey]: mealErrors,
        };
        isValid = false;
      }
    });
  });

  return { isValid, serviceErrors };
}

export function buildOperatingHoursPayload(
  weeklyRows: WeeklyRow[],
  overrideRows: OverrideRow[],
): OperatingHoursSnapshot {
  return {
    weekly: weeklyRows.map((row) => ({
      dayOfWeek: row.dayOfWeek,
      opensAt: row.isClosed ? null : row.opensAt ? canonicalizeRequiredTime(row.opensAt) : null,
      closesAt: row.isClosed
        ? null
        : row.closesAt
          ? canonicalizeRequiredTime(row.closesAt)
          : null,
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
      closesAt: row.isClosed
        ? null
        : row.closesAt
          ? canonicalizeRequiredTime(row.closesAt)
          : null,
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
