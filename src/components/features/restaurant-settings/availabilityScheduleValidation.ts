import {
  parseIntervalInput,
  parseSlotTimesInput,
  toComparableTime,
} from './availabilityScheduleTime';

import type { MealKey } from './availabilityScheduleManagerUtils';
import type { DayServiceConfig } from './servicePeriodsMapper';
import type { OverrideErrors, OverrideRow, WeeklyErrors, WeeklyRow } from './types';

export type MealError = {
  start?: string;
  end?: string;
};

export type DayErrors = Record<number, Partial<Record<MealKey, MealError>>>;

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
        mealErrors.start = 'Before kitchen opens';
      }

      if (!meal.endTime) {
        mealErrors.end = 'Required';
      } else if (!closeComparable || !endComparable || endComparable > closeComparable) {
        mealErrors.end = 'After kitchen closes';
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
