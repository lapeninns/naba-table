import { canonicalizeFromDb } from '@/server/restaurants/timeNormalization';

import type { Database } from '@/types/supabase';

type RestaurantHourRow = Database['public']['Tables']['restaurant_hours']['Row'];
type RestaurantServicePeriodRow = Database['public']['Tables']['restaurant_service_periods']['Row'];

export type GoogleBusinessProfileCoreMatchStatus =
  | 'matched'
  | 'drifted'
  | 'partial'
  | 'unavailable';

export type GoogleBusinessProfileNormalizedServicePeriod = {
  bookingOption: 'lunch' | 'dinner';
  name: string;
  dayOfWeek: number | null;
  startTime: string;
  endTime: string;
  matchesCore: boolean | null;
};

export type GoogleBusinessProfileServicePeriodsNormalization = {
  source: 'more_hours' | 'unavailable';
  matchStatus: GoogleBusinessProfileCoreMatchStatus;
  summary: string;
  warnings: string[];
  periods: GoogleBusinessProfileNormalizedServicePeriod[];
};

export type GoogleBusinessProfileBookingHoursNormalization = {
  matchStatus: 'partial' | 'unavailable';
  summary: string;
  warnings: string[];
  missingInputs: string[];
};

type ComparableServicePeriod = {
  bookingOption: 'lunch' | 'dinner';
  dayOfWeek: number | null;
  startTime: string;
  endTime: string;
};

const BOOKING_HOUR_MISSING_INPUTS = [
  'reservation interval minutes',
  'reservation slot times',
  'default reservation duration',
  'last seating buffer',
  'lifecycle grace rules',
] as const;

function normalizeText(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeToken(value: string | null | undefined): string | null {
  const normalized = normalizeText(value);
  if (!normalized) {
    return null;
  }

  return normalized
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function humanizeBookingOption(option: 'lunch' | 'dinner'): string {
  return option.charAt(0).toUpperCase() + option.slice(1);
}

export function isKitchenHoursLabel(label: string | null | undefined): boolean {
  const normalized = normalizeToken(label);
  if (!normalized) {
    return false;
  }

  return normalized.includes('kitchen');
}

function detectMealBookingOption(label: string | null | undefined): 'lunch' | 'dinner' | null {
  const normalized = normalizeToken(label);
  if (!normalized) {
    return null;
  }

  if (normalized.includes('lunch')) {
    return 'lunch';
  }

  if (normalized.includes('dinner')) {
    return 'dinner';
  }

  return null;
}

export function resolveOverallStatus(params: {
  hasProjection: boolean;
  hasDrift: boolean;
  warnings: string[];
}): GoogleBusinessProfileCoreMatchStatus {
  if (!params.hasProjection) {
    return 'unavailable';
  }

  if (params.hasDrift) {
    return 'drifted';
  }

  if (params.warnings.length > 0) {
    return 'partial';
  }

  return 'matched';
}

function buildServicePeriodsSummary(
  status: GoogleBusinessProfileCoreMatchStatus,
  projectedCount: number,
): string {
  switch (status) {
    case 'matched':
      return `GBP more hours match Nabatable lunch/dinner service periods across ${projectedCount} normalized window${projectedCount === 1 ? '' : 's'}.`;
    case 'drifted':
      return 'GBP meal-like more hours differ from Nabatable lunch/dinner service periods.';
    case 'partial':
      return 'Some GBP more hours can be normalized into lunch/dinner service periods, but not all patterns map cleanly.';
    case 'unavailable':
    default:
      return 'GBP does not natively guarantee lunch/dinner service-period data, so service periods are only normalizable when more-hours labels explicitly encode meal windows.';
  }
}

function buildBookingHoursSummary(
  operatingStatus: GoogleBusinessProfileCoreMatchStatus,
  serviceStatus: GoogleBusinessProfileCoreMatchStatus,
): string {
  if (operatingStatus === 'unavailable' && serviceStatus === 'unavailable') {
    return 'GBP does not currently provide enough structured data to verify Nabatable booking hours.';
  }

  return 'GBP can inform the outer booking envelope, but full booking hours still depend on Nabatable-only slot, interval, and duration settings.';
}

function buildComparableServicePeriod(
  row: Pick<
    RestaurantServicePeriodRow,
    'booking_option' | 'day_of_week' | 'start_time' | 'end_time'
  >,
): ComparableServicePeriod | null {
  const normalizedOption = normalizeToken(row.booking_option);
  const bookingOption =
    normalizedOption === 'lunch' || normalizedOption === 'dinner' ? normalizedOption : null;

  const startTime = canonicalizeFromDb(row.start_time);
  const endTime = canonicalizeFromDb(row.end_time);
  if (!bookingOption || !startTime || !endTime) {
    return null;
  }

  return {
    bookingOption,
    dayOfWeek: row.day_of_week,
    startTime,
    endTime,
  };
}

function sortRowsByTime(rows: RestaurantHourRow[]): RestaurantHourRow[] {
  return [...rows].sort((left, right) => {
    const leftOpen = canonicalizeFromDb(left.open_time) ?? '99:99';
    const rightOpen = canonicalizeFromDb(right.open_time) ?? '99:99';
    if (leftOpen !== rightOpen) {
      return leftOpen.localeCompare(rightOpen);
    }

    const leftClose = canonicalizeFromDb(left.close_time) ?? '99:99';
    const rightClose = canonicalizeFromDb(right.close_time) ?? '99:99';
    return leftClose.localeCompare(rightClose);
  });
}

function inferKitchenSplitWindow(row: RestaurantHourRow): {
  lunch: ComparableServicePeriod;
  dinner: ComparableServicePeriod;
} | null {
  if (row.open_day === null) {
    return null;
  }

  const startTime = canonicalizeFromDb(row.open_time);
  const endTime = canonicalizeFromDb(row.close_time);
  if (!startTime || !endTime) {
    return null;
  }

  if (startTime >= '17:00' || endTime <= '17:00') {
    return null;
  }

  return {
    lunch: {
      bookingOption: 'lunch',
      dayOfWeek: row.open_day,
      startTime,
      endTime: '17:00',
    },
    dinner: {
      bookingOption: 'dinner',
      dayOfWeek: row.open_day,
      startTime: '17:00',
      endTime,
    },
  };
}

export function buildServicePeriodsNormalization(params: {
  gbpHoursRows: RestaurantHourRow[];
  coreServicePeriodRows: RestaurantServicePeriodRow[];
}): GoogleBusinessProfileServicePeriodsNormalization {
  const warnings: string[] = [];
  const grouped = new Map<string, RestaurantHourRow[]>();
  const serviceRows = params.gbpHoursRows.filter((row) => row.hours_type === 'service');
  const unlabeledKitchenByDay = new Map<number, RestaurantHourRow[]>();
  let ignoredServiceRows = 0;

  for (const row of serviceRows) {
    const bookingOption = detectMealBookingOption(row.period_label);
    if (row.open_day === null || row.close_day === null) {
      warnings.push(
        'Some GBP more-hours rows were missing day values and could not be normalized.',
      );
      continue;
    }
    if (row.open_day !== row.close_day) {
      warnings.push(
        'Overnight GBP more-hours windows cannot be represented directly in Nabatable service periods.',
      );
      continue;
    }
    if (row.start_date || row.end_date) {
      warnings.push(
        'Dated GBP more-hours windows cannot be normalized into recurring service periods.',
      );
      continue;
    }

    if (bookingOption) {
      const key = `${bookingOption}:${row.open_day}`;
      const list = grouped.get(key) ?? [];
      list.push(row);
      grouped.set(key, list);
      continue;
    }

    if (isKitchenHoursLabel(row.period_label)) {
      const list = unlabeledKitchenByDay.get(row.open_day) ?? [];
      list.push(row);
      unlabeledKitchenByDay.set(row.open_day, list);
      continue;
    }

    ignoredServiceRows += 1;
  }

  for (const [dayOfWeek, rows] of unlabeledKitchenByDay.entries()) {
    const sorted = sortRowsByTime(rows);

    if (sorted.length === 2) {
      grouped.set(`lunch:${dayOfWeek}`, [sorted[0]!]);
      grouped.set(`dinner:${dayOfWeek}`, [sorted[1]!]);
      continue;
    }

    if (sorted.length === 1) {
      const inferred = inferKitchenSplitWindow(sorted[0]!);
      if (inferred) {
        grouped.set(`lunch:${dayOfWeek}`, [
          {
            ...sorted[0]!,
            open_time: inferred.lunch.startTime,
            close_time: inferred.lunch.endTime,
          },
        ]);
        grouped.set(`dinner:${dayOfWeek}`, [
          {
            ...sorted[0]!,
            open_time: inferred.dinner.startTime,
            close_time: inferred.dinner.endTime,
          },
        ]);
        continue;
      }

      warnings.push(
        `GBP kitchen hours for day ${dayOfWeek} contain a single window, so lunch and dinner cannot be inferred safely.`,
      );
      continue;
    }

    warnings.push(
      `GBP kitchen hours for day ${dayOfWeek} contain ${sorted.length} windows, so lunch and dinner cannot be inferred safely.`,
    );
  }

  if (ignoredServiceRows > 0) {
    warnings.push(
      'GBP more-hours rows without kitchen or explicit lunch/dinner labels were excluded from service-period normalization.',
    );
  }

  const coreLookup = new Set(
    params.coreServicePeriodRows
      .map((row) => buildComparableServicePeriod(row))
      .filter((row): row is ComparableServicePeriod => Boolean(row))
      .map(
        (row) =>
          `${row.bookingOption}:${row.dayOfWeek === null ? 'all' : row.dayOfWeek}:${row.startTime}:${row.endTime}`,
      ),
  );

  const periods = Array.from(grouped.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, rows]) => {
      const [bookingOption, dayToken] = key.split(':');
      const startTimes = rows
        .map((row) => canonicalizeFromDb(row.open_time))
        .filter((value): value is string => Boolean(value));
      const endTimes = rows
        .map((row) => canonicalizeFromDb(row.close_time))
        .filter((value): value is string => Boolean(value));

      if (rows.length > 1) {
        warnings.push(
          `GBP has multiple ${humanizeBookingOption(bookingOption as 'lunch' | 'dinner')} windows for day ${dayToken}; Nabatable will compare using the earliest start and latest end.`,
        );
      }

      const period: ComparableServicePeriod = {
        bookingOption: bookingOption as 'lunch' | 'dinner',
        dayOfWeek: Number.parseInt(dayToken ?? '', 10),
        startTime: startTimes.sort()[0] ?? '00:00',
        endTime: endTimes.sort().at(-1) ?? '00:00',
      };

      const matchesCore = coreLookup.has(
        `${period.bookingOption}:${period.dayOfWeek === null ? 'all' : period.dayOfWeek}:${period.startTime}:${period.endTime}`,
      );

      return {
        bookingOption: period.bookingOption,
        name: humanizeBookingOption(period.bookingOption),
        dayOfWeek: period.dayOfWeek,
        startTime: period.startTime,
        endTime: period.endTime,
        matchesCore,
      } satisfies GoogleBusinessProfileNormalizedServicePeriod;
    });

  const hasProjection = periods.length > 0;
  const hasDrift = periods.some((period) => period.matchesCore === false);
  const matchStatus = resolveOverallStatus({ hasProjection, hasDrift, warnings });

  return {
    source: hasProjection ? 'more_hours' : 'unavailable',
    matchStatus,
    summary: buildServicePeriodsSummary(matchStatus, periods.length),
    warnings,
    periods,
  };
}

export function buildBookingHoursNormalization(params: {
  operatingHours: { matchStatus: GoogleBusinessProfileCoreMatchStatus };
  servicePeriods: GoogleBusinessProfileServicePeriodsNormalization;
}): GoogleBusinessProfileBookingHoursNormalization {
  const warnings =
    params.servicePeriods.matchStatus === 'unavailable'
      ? [
          'GBP does not provide reservation slot intervals or durations, and meal windows are only available when more-hours labels explicitly encode them.',
        ]
      : ['GBP still cannot verify slot generation, interval, and duration rules on its own.'];

  const matchStatus =
    params.operatingHours.matchStatus === 'unavailable' &&
    params.servicePeriods.matchStatus === 'unavailable'
      ? 'unavailable'
      : 'partial';

  return {
    matchStatus,
    summary: buildBookingHoursSummary(
      params.operatingHours.matchStatus,
      params.servicePeriods.matchStatus,
    ),
    warnings,
    missingInputs: [...BOOKING_HOUR_MISSING_INPUTS],
  };
}
