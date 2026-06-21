import { DAYS_OF_WEEK, type WeeklyRow } from '../types';

import type { MealKey } from '../availabilityScheduleManagerUtils';
import type { DayErrors } from '../availabilityScheduleValidation';
import type { DayServiceConfig, MealConfig } from '../servicePeriodsMapper';

export type ScheduleDayCardViewModel = {
  dayLabel: string;
  isClosed: boolean;
};

export type ScheduleDayMealEditorState = {
  disabled: boolean;
  errors: DayErrors[number][MealKey] | undefined;
  meal: MealConfig;
};

const FALLBACK_MEALS: Record<MealKey, MealConfig> = {
  lunch: { enabled: false, endTime: '', name: 'Lunch', startTime: '' },
  dinner: { enabled: false, endTime: '', name: 'Dinner', startTime: '' },
};

export function buildScheduleDayCardViewModel({
  day,
  row,
}: {
  day: DayServiceConfig | undefined;
  row: WeeklyRow;
}): ScheduleDayCardViewModel {
  return {
    dayLabel: day?.label ?? DAYS_OF_WEEK[row.dayOfWeek] ?? 'Day',
    isClosed: row.isClosed,
  };
}

export function buildScheduleDayOpenPatch(row: WeeklyRow, checked: boolean): Partial<WeeklyRow> {
  return {
    isClosed: !checked,
    opensAt: checked ? row.opensAt : '',
    closesAt: checked ? row.closesAt : '',
  };
}

export function buildScheduleDayMealEditorState({
  day,
  dayError,
  hasRequiredOccasions,
  mealKey,
}: {
  day: DayServiceConfig | undefined;
  dayError: DayErrors[number] | undefined;
  hasRequiredOccasions: boolean;
  mealKey: MealKey;
}): ScheduleDayMealEditorState {
  const meal = day?.[mealKey] ?? FALLBACK_MEALS[mealKey];

  return {
    disabled: !day || day.isClosed || !hasRequiredOccasions,
    errors: dayError?.[mealKey],
    meal,
  };
}
