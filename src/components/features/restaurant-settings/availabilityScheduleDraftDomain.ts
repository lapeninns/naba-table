import type { DayErrors } from './availabilityScheduleValidation';
import type { DayServiceConfig } from './servicePeriodsMapper';
import type { TurnBandRowError } from './turnBandsDomain';
import type { OverrideErrors, OverrideRow, WeeklyErrors, WeeklyRow } from './types';
import type { TurnBandInput, TurnBandsPayload } from '@/services/ops/restaurants';

export type MealKey = 'lunch' | 'dinner';
export type MealTimeField = 'startTime' | 'endTime';

export function updateWeeklyRows(
  rows: WeeklyRow[],
  dayIndex: number,
  patch: Partial<WeeklyRow>,
): WeeklyRow[] {
  return rows.map((row, index) => (index === dayIndex ? { ...row, ...patch } : row));
}

export function updateDayConfigsForWeeklyPatch(
  dayConfigs: DayServiceConfig[],
  dayIndex: number,
  patch: Partial<WeeklyRow>,
): DayServiceConfig[] {
  return dayConfigs.map((day, index) => {
    if (index !== dayIndex) {
      return day;
    }
    const nextClosed = patch.isClosed ?? day.isClosed;
    return {
      ...day,
      opensAt: patch.opensAt !== undefined ? patch.opensAt : day.opensAt,
      closesAt: patch.closesAt !== undefined ? patch.closesAt : day.closesAt,
      isClosed: nextClosed,
      lunch: nextClosed ? { ...day.lunch, enabled: false } : day.lunch,
      dinner: nextClosed ? { ...day.dinner, enabled: false } : day.dinner,
    };
  });
}

export function clearWeeklyError(errors: WeeklyErrors, dayIndex: number): WeeklyErrors {
  const next = { ...errors };
  delete next[dayIndex];
  return next;
}

export function clearServiceErrorsForDay(errors: DayErrors, dayIndex: number): DayErrors {
  const next = { ...errors };
  delete next[dayIndex];
  return next;
}

export function updateOverrideRows(
  rows: OverrideRow[],
  index: number,
  patch: Partial<OverrideRow>,
): OverrideRow[] {
  return rows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row));
}

export function clearOverrideErrorAtIndex(errors: OverrideErrors, index: number): OverrideErrors {
  const next = [...errors];
  next[index] = {};
  return next;
}

export function removeOverrideAtIndex<T>(rows: T[], index: number): T[] {
  return rows.filter((_, rowIndex) => rowIndex !== index);
}

export function updateMealEnabled(
  dayConfigs: DayServiceConfig[],
  dayIndex: number,
  mealKey: MealKey,
  value: boolean,
): DayServiceConfig[] {
  return dayConfigs.map((day, index) =>
    index === dayIndex
      ? {
          ...day,
          [mealKey]: {
            ...day[mealKey],
            enabled: value,
          },
        }
      : day,
  );
}

export function updateMealTime(
  dayConfigs: DayServiceConfig[],
  dayIndex: number,
  mealKey: MealKey,
  field: MealTimeField,
  value: string,
): DayServiceConfig[] {
  return dayConfigs.map((day, index) =>
    index === dayIndex
      ? {
          ...day,
          [mealKey]: {
            ...day[mealKey],
            [field]: value,
          },
        }
      : day,
  );
}

export function clearServiceMealError(
  errors: DayErrors,
  dayIndex: number,
  mealKey: MealKey,
): DayErrors {
  const next = { ...errors };
  const dayError = { ...(next[dayIndex] ?? {}) };
  delete dayError[mealKey];
  if (Object.keys(dayError).length === 0) {
    delete next[dayIndex];
  } else {
    next[dayIndex] = dayError;
  }
  return next;
}

export function clearServiceMealTimeError(
  errors: DayErrors,
  dayIndex: number,
  mealKey: MealKey,
  field: MealTimeField,
): DayErrors {
  const next = { ...errors };
  const dayError = { ...(next[dayIndex] ?? {}) };
  if (dayError[mealKey]) {
    const nextMealError = { ...dayError[mealKey] };
    delete nextMealError[field === 'startTime' ? 'start' : 'end'];
    if (Object.keys(nextMealError).length === 0) {
      delete dayError[mealKey];
    } else {
      dayError[mealKey] = nextMealError;
    }
  }
  if (Object.keys(dayError).length === 0) {
    delete next[dayIndex];
  } else {
    next[dayIndex] = dayError;
  }
  return next;
}

export function updateTurnBandsDraft(
  draft: TurnBandsPayload,
  optionKey: string,
  nextBands: TurnBandInput[],
): TurnBandsPayload {
  const next = { ...draft };
  if (!nextBands || nextBands.length === 0) {
    delete next[optionKey];
  } else {
    next[optionKey] = nextBands;
  }
  return next;
}

export function clearTurnBandErrors(
  errors: Record<string, TurnBandRowError[]>,
  optionKey: string,
): Record<string, TurnBandRowError[]> {
  const next = { ...errors };
  delete next[optionKey];
  return next;
}
