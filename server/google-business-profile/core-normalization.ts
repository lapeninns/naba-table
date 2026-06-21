import { canonicalizeFromDb } from '@/server/restaurants/timeNormalization';

import {
  buildBookingHoursNormalization,
  buildServicePeriodsNormalization,
  isKitchenHoursLabel,
  resolveOverallStatus,
  type GoogleBusinessProfileBookingHoursNormalization,
  type GoogleBusinessProfileCoreMatchStatus,
  type GoogleBusinessProfileServicePeriodsNormalization,
} from './core-normalization-service-periods';

import type { Database } from '@/types/supabase';

type RestaurantHourRow = Database['public']['Tables']['restaurant_hours']['Row'];
type RestaurantOperatingHoursRow =
  Database['public']['Tables']['restaurant_operating_hours']['Row'];
type RestaurantServicePeriodRow = Database['public']['Tables']['restaurant_service_periods']['Row'];

export type {
  GoogleBusinessProfileBookingHoursNormalization,
  GoogleBusinessProfileCoreMatchStatus,
  GoogleBusinessProfileNormalizedServicePeriod,
  GoogleBusinessProfileServicePeriodsNormalization,
} from './core-normalization-service-periods';

export type GoogleBusinessProfileNormalizedOperatingHoursRow = {
  dayOfWeek: number;
  opensAt: string | null;
  closesAt: string | null;
  isClosed: boolean;
  matchesCore: boolean | null;
};

export type GoogleBusinessProfileNormalizedOverrideRow = {
  effectiveDate: string;
  opensAt: string | null;
  closesAt: string | null;
  isClosed: boolean;
  matchesCore: boolean | null;
};

export type GoogleBusinessProfileOperatingHoursNormalization = {
  source: 'kitchen' | 'public' | 'unavailable';
  matchStatus: GoogleBusinessProfileCoreMatchStatus;
  summary: string;
  warnings: string[];
  weekly: GoogleBusinessProfileNormalizedOperatingHoursRow[];
  overrides: GoogleBusinessProfileNormalizedOverrideRow[];
};

export type GoogleBusinessProfileCoreNormalization = {
  operatingHours: GoogleBusinessProfileOperatingHoursNormalization;
  servicePeriods: GoogleBusinessProfileServicePeriodsNormalization;
  bookingHours: GoogleBusinessProfileBookingHoursNormalization;
};

type ComparableOperatingHoursRow = {
  opensAt: string | null;
  closesAt: string | null;
  isClosed: boolean;
};

const DAYS_IN_WEEK = 7;

function normalizeText(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toComparableOperatingHoursRow(
  row: Pick<RestaurantOperatingHoursRow, 'opens_at' | 'closes_at' | 'is_closed'>,
): ComparableOperatingHoursRow {
  return {
    opensAt: canonicalizeFromDb(row.opens_at),
    closesAt: canonicalizeFromDb(row.closes_at),
    isClosed: row.is_closed ?? false,
  };
}

function comparableRowsMatch(
  left: ComparableOperatingHoursRow | null | undefined,
  right: ComparableOperatingHoursRow | null | undefined,
): boolean {
  return (
    (left?.opensAt ?? null) === (right?.opensAt ?? null) &&
    (left?.closesAt ?? null) === (right?.closesAt ?? null) &&
    (left?.isClosed ?? true) === (right?.isClosed ?? true)
  );
}

function buildOperatingHoursSummary(
  source: GoogleBusinessProfileOperatingHoursNormalization['source'],
  status: GoogleBusinessProfileCoreMatchStatus,
): string {
  const sourceLabel =
    source === 'kitchen'
      ? 'GBP kitchen more hours'
      : source === 'public'
        ? 'GBP regular public hours'
        : 'GBP hours';

  switch (status) {
    case 'matched':
      return `${sourceLabel} match Nabatable operating hours.`;
    case 'drifted':
      return `${sourceLabel} differ from Nabatable operating hours.`;
    case 'partial':
      return `${sourceLabel} can be normalized into operating hours, but some GBP periods do not map cleanly into Nabatable's single-window structure.`;
    case 'unavailable':
    default:
      return 'No GBP hour set can be normalized confidently into Nabatable operating hours yet.';
  }
}

function normalizeWeeklyOperatingProjection(
  sourceRows: RestaurantHourRow[],
  coreWeeklyRows: RestaurantOperatingHoursRow[],
  warnings: string[],
): GoogleBusinessProfileNormalizedOperatingHoursRow[] {
  const grouped = new Map<number, RestaurantHourRow[]>();

  for (const row of sourceRows) {
    if (row.start_date || row.end_date) {
      warnings.push(
        'GBP weekly hours included dated rows and were skipped from weekly normalization.',
      );
      continue;
    }
    if (row.open_day === null || row.close_day === null) {
      warnings.push('Some GBP weekly hours were missing day values and could not be normalized.');
      continue;
    }
    if (row.open_day !== row.close_day) {
      warnings.push(
        'Overnight GBP weekly hours cannot be represented directly in Nabatable operating hours.',
      );
      continue;
    }

    const list = grouped.get(row.open_day) ?? [];
    list.push(row);
    grouped.set(row.open_day, list);
  }

  const coreWeeklyByDay = new Map<number, ComparableOperatingHoursRow>();
  for (const row of coreWeeklyRows) {
    if (row.day_of_week === null) {
      continue;
    }
    coreWeeklyByDay.set(row.day_of_week, toComparableOperatingHoursRow(row));
  }

  const projection: GoogleBusinessProfileNormalizedOperatingHoursRow[] = [];

  for (let day = 0; day < DAYS_IN_WEEK; day += 1) {
    const rows = grouped.get(day) ?? [];
    const openRows = rows.filter((row) => !row.is_closed);

    let normalized: ComparableOperatingHoursRow;
    if (rows.length === 0) {
      normalized = {
        opensAt: null,
        closesAt: null,
        isClosed: true,
      };
    } else if (openRows.length === 0) {
      normalized = {
        opensAt: null,
        closesAt: null,
        isClosed: true,
      };
    } else {
      const openTimes = openRows
        .map((row) => canonicalizeFromDb(row.open_time))
        .filter((value): value is string => Boolean(value));
      const closeTimes = openRows
        .map((row) => canonicalizeFromDb(row.close_time))
        .filter((value): value is string => Boolean(value));

      if (openRows.length > 1) {
        warnings.push(
          `GBP has multiple weekly windows for day ${day}; Nabatable will compare using the earliest open and latest close.`,
        );
      }

      normalized = {
        opensAt: openTimes.length > 0 ? openTimes.sort()[0]! : null,
        closesAt: closeTimes.length > 0 ? closeTimes.sort().at(-1)! : null,
        isClosed: false,
      };
    }

    projection.push({
      dayOfWeek: day,
      opensAt: normalized.opensAt,
      closesAt: normalized.closesAt,
      isClosed: normalized.isClosed,
      matchesCore: comparableRowsMatch(normalized, coreWeeklyByDay.get(day)),
    });
  }

  return projection;
}

function normalizeOverrideProjection(
  specialRows: RestaurantHourRow[],
  coreOverrideRows: RestaurantOperatingHoursRow[],
  warnings: string[],
): GoogleBusinessProfileNormalizedOverrideRow[] {
  const grouped = new Map<string, RestaurantHourRow[]>();

  for (const row of specialRows) {
    const startDate = normalizeText(row.start_date);
    const endDate = normalizeText(row.end_date) ?? startDate;

    if (!startDate) {
      warnings.push('A GBP special-hours row was missing its date and could not be normalized.');
      continue;
    }

    if (endDate !== startDate) {
      warnings.push(
        `GBP special hours spanning ${startDate}${endDate ? ` to ${endDate}` : ''} cannot be represented directly as a single Nabatable override.`,
      );
      continue;
    }

    const list = grouped.get(startDate) ?? [];
    list.push(row);
    grouped.set(startDate, list);
  }

  const coreOverridesByDate = new Map<string, ComparableOperatingHoursRow>();
  for (const row of coreOverrideRows) {
    if (!row.effective_date) {
      continue;
    }
    coreOverridesByDate.set(row.effective_date, toComparableOperatingHoursRow(row));
  }

  return Array.from(grouped.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([effectiveDate, rows]) => {
      const openRows = rows.filter((row) => !row.is_closed);
      let normalized: ComparableOperatingHoursRow;

      if (openRows.length === 0) {
        normalized = {
          opensAt: null,
          closesAt: null,
          isClosed: true,
        };
      } else {
        const openTimes = openRows
          .map((row) => canonicalizeFromDb(row.open_time))
          .filter((value): value is string => Boolean(value));
        const closeTimes = openRows
          .map((row) => canonicalizeFromDb(row.close_time))
          .filter((value): value is string => Boolean(value));

        if (openRows.length > 1) {
          warnings.push(
            `GBP special hours include multiple windows on ${effectiveDate}; Nabatable will compare using the earliest open and latest close.`,
          );
        }

        normalized = {
          opensAt: openTimes.length > 0 ? openTimes.sort()[0]! : null,
          closesAt: closeTimes.length > 0 ? closeTimes.sort().at(-1)! : null,
          isClosed: false,
        };
      }

      return {
        effectiveDate,
        opensAt: normalized.opensAt,
        closesAt: normalized.closesAt,
        isClosed: normalized.isClosed,
        matchesCore: comparableRowsMatch(normalized, coreOverridesByDate.get(effectiveDate)),
      };
    });
}

function buildOperatingHoursNormalization(params: {
  gbpHoursRows: RestaurantHourRow[];
  coreOperatingHoursRows: RestaurantOperatingHoursRow[];
}): GoogleBusinessProfileOperatingHoursNormalization {
  const warnings: string[] = [];
  const serviceRows = params.gbpHoursRows.filter((row) => row.hours_type === 'service');
  const publicRows = params.gbpHoursRows.filter((row) => row.hours_type === 'public');
  const specialRows = params.gbpHoursRows.filter((row) => row.hours_type === 'special');
  const kitchenRows = serviceRows.filter((row) => isKitchenHoursLabel(row.period_label));
  const weeklySourceRows = publicRows.length > 0 ? publicRows : kitchenRows;
  const source: GoogleBusinessProfileOperatingHoursNormalization['source'] =
    publicRows.length > 0 ? 'public' : kitchenRows.length > 0 ? 'kitchen' : 'unavailable';

  const coreWeeklyRows = params.coreOperatingHoursRows.filter((row) => row.effective_date === null);
  const coreOverrideRows = params.coreOperatingHoursRows.filter(
    (row) => row.effective_date !== null,
  );
  const weekly = normalizeWeeklyOperatingProjection(weeklySourceRows, coreWeeklyRows, warnings);
  const overrides = normalizeOverrideProjection(specialRows, coreOverrideRows, warnings);
  const hasProjection = source !== 'unavailable';
  const hasDrift = [...weekly, ...overrides].some((row) => row.matchesCore === false);
  const matchStatus = resolveOverallStatus({ hasProjection, hasDrift, warnings });

  return {
    source,
    matchStatus,
    summary: buildOperatingHoursSummary(source, matchStatus),
    warnings,
    weekly,
    overrides,
  };
}

export function buildGoogleBusinessProfileCoreNormalization(params: {
  gbpHoursRows: RestaurantHourRow[];
  coreOperatingHoursRows: RestaurantOperatingHoursRow[];
  coreServicePeriodRows: RestaurantServicePeriodRow[];
}): GoogleBusinessProfileCoreNormalization {
  const operatingHours = buildOperatingHoursNormalization({
    gbpHoursRows: params.gbpHoursRows,
    coreOperatingHoursRows: params.coreOperatingHoursRows,
  });
  const servicePeriods = buildServicePeriodsNormalization({
    gbpHoursRows: params.gbpHoursRows,
    coreServicePeriodRows: params.coreServicePeriodRows,
  });
  const bookingHours = buildBookingHoursNormalization({
    operatingHours,
    servicePeriods,
  });

  return {
    operatingHours,
    servicePeriods,
    bookingHours,
  };
}
