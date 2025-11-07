import { normalizeTime } from '@reserve/shared/time';

import type { ServicePeriodRow } from './types';

export type WeeklyHoursEntry = {
  opensAt: string | null;
  closesAt: string | null;
  isClosed: boolean;
};

export type MealConfig = {
  id?: string;
  name: string;
  startTime: string;
  endTime: string;
  enabled: boolean;
};

export type DrinksConfig = {
  id?: string;
  name: string;
  startTime: string;
  endTime: string;
};

export type DayServiceConfig = {
  dayOfWeek: number;
  label: string;
  opensAt: string | null;
  closesAt: string | null;
  isClosed: boolean;
  drinks: DrinksConfig | null;
  lunch: MealConfig;
  dinner: MealConfig;
};

export type BuildStateParams = {
  periods: ServicePeriodRow[];
  weeklyHours: Record<number, WeeklyHoursEntry>;
  dayLabels: string[];
};

export type BuildPayloadOptions = {
  customRows: ServicePeriodRow[];
  canonicalizeTime: (value: string) => string;
  occasionKeys: {
    lunch: string;
    dinner: string;
    drinks: string;
  };
};

const DEFAULT_LUNCH_NAME = 'Lunch';
const DEFAULT_DINNER_NAME = 'Dinner';
const DEFAULT_DRINKS_NAME = 'Drinks';

const ensureTimeInput = (value: string | null | undefined): string => {
  if (!value) {
    return '';
  }
  const normalized = normalizeTime(value);
  return normalized ?? value;
};

const getWeeklyEntry = (
  weeklyHours: Record<number, WeeklyHoursEntry>,
  dayOfWeek: number,
): WeeklyHoursEntry => {
  return (
    weeklyHours[dayOfWeek] ?? {
      opensAt: null,
      closesAt: null,
      isClosed: true,
    }
  );
};

const partitionServicePeriods = (periods: ServicePeriodRow[]) => {
  const byDay = new Map<
    number,
    {
      drinks?: ServicePeriodRow;
      lunch?: ServicePeriodRow;
      dinner?: ServicePeriodRow;
      extras: ServicePeriodRow[];
    }
  >();
  const uncategorized: ServicePeriodRow[] = [];

  periods.forEach((period) => {
    const bookingKey = period.bookingOption?.toLowerCase() ?? '';
    if (period.dayOfWeek === null || period.dayOfWeek === undefined) {
      uncategorized.push(period);
      return;
    }
    const bucket = byDay.get(period.dayOfWeek) ?? { extras: [] };
    switch (bookingKey) {
      case 'drinks':
        bucket.drinks = period;
        break;
      case 'lunch':
        bucket.lunch = period;
        break;
      case 'dinner':
        bucket.dinner = period;
        break;
      default:
        bucket.extras.push(period);
        break;
    }
    byDay.set(period.dayOfWeek, bucket);
  });

  return { byDay, uncategorized };
};

export function buildServicePeriodState(params: BuildStateParams): {
  days: DayServiceConfig[];
  custom: ServicePeriodRow[];
} {
  const { periods, weeklyHours, dayLabels } = params;
  const { byDay, uncategorized } = partitionServicePeriods(periods);
  const customRows: ServicePeriodRow[] = [...uncategorized];

  const days: DayServiceConfig[] = [];
  for (let day = 0; day < dayLabels.length; day += 1) {
    const hours = getWeeklyEntry(weeklyHours, day);
    const bucket = byDay.get(day) ?? { extras: [] };
    customRows.push(...bucket.extras);

    const lunchPeriod = bucket.lunch;
    const dinnerPeriod = bucket.dinner;
    const drinksPeriod = bucket.drinks;

    const lunch: MealConfig = {
      id: lunchPeriod?.id,
      name: lunchPeriod?.name ?? DEFAULT_LUNCH_NAME,
      startTime: ensureTimeInput(lunchPeriod?.startTime ?? hours.opensAt ?? ''),
      endTime: ensureTimeInput(lunchPeriod?.endTime ?? hours.opensAt ?? ''),
      enabled: Boolean(lunchPeriod),
    };

    const dinner: MealConfig = {
      id: dinnerPeriod?.id,
      name: dinnerPeriod?.name ?? DEFAULT_DINNER_NAME,
      startTime: ensureTimeInput(dinnerPeriod?.startTime ?? hours.opensAt ?? ''),
      endTime: ensureTimeInput(dinnerPeriod?.endTime ?? hours.closesAt ?? ''),
      enabled: Boolean(dinnerPeriod),
    };

    const drinks: DrinksConfig | null =
      hours.isClosed || !hours.opensAt || !hours.closesAt
        ? null
        : {
            id: drinksPeriod?.id,
            name: drinksPeriod?.name ?? DEFAULT_DRINKS_NAME,
            startTime: ensureTimeInput(hours.opensAt),
            endTime: ensureTimeInput(hours.closesAt),
          };

    days.push({
      dayOfWeek: day,
      label: dayLabels[day] ?? `Day ${day}`,
      opensAt: ensureTimeInput(hours.opensAt),
      closesAt: ensureTimeInput(hours.closesAt),
      isClosed: hours.isClosed || !hours.opensAt || !hours.closesAt,
      drinks,
      lunch,
      dinner,
    });
  }

  return { days, custom: customRows };
}

export function buildServicePeriodPayload(
  dayConfigs: DayServiceConfig[],
  options: BuildPayloadOptions,
): ServicePeriodRow[] {
  const payload: ServicePeriodRow[] = [...options.customRows];
  dayConfigs.forEach((day) => {
    if (!day.isClosed && day.drinks && day.opensAt && day.closesAt) {
      payload.push({
        id: day.drinks.id,
        name: day.drinks.name || DEFAULT_DRINKS_NAME,
        dayOfWeek: day.dayOfWeek,
        startTime: options.canonicalizeTime(day.opensAt),
        endTime: options.canonicalizeTime(day.closesAt),
        bookingOption: options.occasionKeys.drinks,
      });
    }

    if (day.lunch.enabled) {
      payload.push({
        id: day.lunch.id,
        name: day.lunch.name || DEFAULT_LUNCH_NAME,
        dayOfWeek: day.dayOfWeek,
        startTime: options.canonicalizeTime(day.lunch.startTime),
        endTime: options.canonicalizeTime(day.lunch.endTime),
        bookingOption: options.occasionKeys.lunch,
      });
    }

    if (day.dinner.enabled) {
      payload.push({
        id: day.dinner.id,
        name: day.dinner.name || DEFAULT_DINNER_NAME,
        dayOfWeek: day.dayOfWeek,
        startTime: options.canonicalizeTime(day.dinner.startTime),
        endTime: options.canonicalizeTime(day.dinner.endTime),
        bookingOption: options.occasionKeys.dinner,
      });
    }
  });

  return payload;
}
