import {
  buildWeeklyHoursMap,
  mapWeeklyFromResponse,
  type MealKey,
} from '../availabilityScheduleManagerUtils';
import { canonicalizeRequiredTime } from '../availabilityScheduleTime';
import { findServicePeriodDriftField } from '../gbpDriftDomain';
import {
  buildServicePeriodPayload,
  buildServicePeriodState,
  type DayServiceConfig,
} from '../servicePeriodsMapper';
import { DAYS_OF_WEEK } from '../types';

import type { DayErrors } from '../availabilityScheduleValidation';
import type { DualSyncFieldSummary } from '@/services/ops/dual-sync';
import type { OperatingHoursSnapshot, ServicePeriodRow } from '@/services/ops/restaurants';

export type ServiceWindowOccasionKeys = {
  lunch?: string | null;
  dinner?: string | null;
};

type RequiredServiceWindowOccasionKeys = {
  lunch: string;
  dinner: string;
};

export type ServiceWindowInitialState = {
  days: DayServiceConfig[];
  customRows: ServicePeriodRow[];
};

export type ServiceWindowDraftOverride = readonly [fieldKey: string, value: unknown];

export function buildServiceWindowInitialState({
  operatingHours,
  servicePeriods,
}: {
  operatingHours: OperatingHoursSnapshot;
  servicePeriods: ServicePeriodRow[];
}): ServiceWindowInitialState {
  const weeklyRows = mapWeeklyFromResponse(operatingHours.weekly);
  const { custom, days } = buildServicePeriodState({
    periods: servicePeriods,
    weeklyHours: buildWeeklyHoursMap(weeklyRows),
    dayLabels: weeklyRows.map((row) => DAYS_OF_WEEK[row.dayOfWeek]),
  });
  return { customRows: custom, days };
}

export function updateServiceWindowMealToggle({
  current,
  dayIndex,
  mealKey,
  value,
}: {
  current: DayServiceConfig[];
  dayIndex: number;
  mealKey: MealKey;
  value: boolean;
}): DayServiceConfig[] {
  return current.map((day, index) =>
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

export function updateServiceWindowMealTime({
  current,
  dayIndex,
  field,
  mealKey,
  value,
}: {
  current: DayServiceConfig[];
  dayIndex: number;
  mealKey: MealKey;
  field: 'startTime' | 'endTime';
  value: string;
}): DayServiceConfig[] {
  return current.map((day, index) =>
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

export function clearServiceWindowMealError({
  dayIndex,
  errors,
  field,
  mealKey,
}: {
  errors: DayErrors;
  dayIndex: number;
  mealKey: MealKey;
  field?: 'startTime' | 'endTime';
}): DayErrors {
  const next = { ...errors };
  const dayError = { ...(next[dayIndex] ?? {}) };

  if (field) {
    const mealError = dayError[mealKey];
    if (mealError) {
      const nextMealError = { ...mealError };
      delete nextMealError[field === 'startTime' ? 'start' : 'end'];
      if (Object.keys(nextMealError).length === 0) {
        delete dayError[mealKey];
      } else {
        dayError[mealKey] = nextMealError;
      }
    }
  } else {
    delete dayError[mealKey];
  }

  if (Object.keys(dayError).length === 0) {
    delete next[dayIndex];
  } else {
    next[dayIndex] = dayError;
  }

  return next;
}

export function buildServiceWindowDraftOverrides({
  dayConfigs,
  occasionKeys,
  servicePeriodDriftFields,
}: {
  dayConfigs: DayServiceConfig[];
  occasionKeys: ServiceWindowOccasionKeys;
  servicePeriodDriftFields: ReadonlyArray<DualSyncFieldSummary>;
}): ServiceWindowDraftOverride[] {
  const entries: ServiceWindowDraftOverride[] = [];
  for (const day of dayConfigs) {
    const serviceFields = buildServiceWindowDriftFieldsForDay({
      day,
      occasionKeys,
      servicePeriodDriftFields,
    });

    if (occasionKeys.lunch && day.lunch.enabled && serviceFields[0]) {
      entries.push([
        serviceFields[0].fieldKey,
        {
          bookingOption: occasionKeys.lunch,
          dayOfWeek: day.dayOfWeek,
          endTime: day.lunch.endTime,
          name: day.lunch.name,
          startTime: day.lunch.startTime,
        },
      ]);
    }

    const dinnerFieldIndex = occasionKeys.lunch && day.lunch.enabled ? 1 : 0;
    if (occasionKeys.dinner && day.dinner.enabled && serviceFields[dinnerFieldIndex]) {
      entries.push([
        serviceFields[dinnerFieldIndex].fieldKey,
        {
          bookingOption: occasionKeys.dinner,
          dayOfWeek: day.dayOfWeek,
          endTime: day.dinner.endTime,
          name: day.dinner.name,
          startTime: day.dinner.startTime,
        },
      ]);
    }
  }
  return entries;
}

export function buildServiceWindowDriftFieldsForDay({
  day,
  occasionKeys,
  servicePeriodDriftFields,
}: {
  day: DayServiceConfig;
  occasionKeys: ServiceWindowOccasionKeys;
  servicePeriodDriftFields: ReadonlyArray<DualSyncFieldSummary>;
}): DualSyncFieldSummary[] {
  const serviceFields: DualSyncFieldSummary[] = [];
  if (occasionKeys.lunch && day.lunch.enabled) {
    const field = findServicePeriodDriftField(servicePeriodDriftFields, {
      bookingOption: occasionKeys.lunch,
      dayOfWeek: day.dayOfWeek,
      endTime: day.lunch.endTime,
      name: day.lunch.name,
      startTime: day.lunch.startTime,
    });
    if (field) serviceFields.push(field);
  }
  if (occasionKeys.dinner && day.dinner.enabled) {
    const field = findServicePeriodDriftField(servicePeriodDriftFields, {
      bookingOption: occasionKeys.dinner,
      dayOfWeek: day.dayOfWeek,
      endTime: day.dinner.endTime,
      name: day.dinner.name,
      startTime: day.dinner.startTime,
    });
    if (field) serviceFields.push(field);
  }
  return serviceFields;
}

export function buildServiceWindowSavePayload({
  customRows,
  dayConfigs,
  occasionKeys,
}: {
  dayConfigs: DayServiceConfig[];
  customRows: ServicePeriodRow[];
  occasionKeys: RequiredServiceWindowOccasionKeys;
}): ServicePeriodRow[] {
  return buildServicePeriodPayload(
    dayConfigs.map((day) =>
      day.isClosed
        ? {
            ...day,
            dinner: { ...day.dinner, enabled: false },
            lunch: { ...day.lunch, enabled: false },
          }
        : day,
    ),
    {
      canonicalizeTime: canonicalizeRequiredTime,
      customRows,
      occasionKeys,
    },
  );
}
