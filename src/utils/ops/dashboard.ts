import { DateTime } from 'luxon';

import type { OpsTodayBookingsSummary } from '@/types/ops';

export function sanitizeDateParam(value: string | undefined | null): string | null {
  if (!value) {
    return null;
  }
  return /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value) ? value : null;
}

type DashboardSummaryIdentity = Pick<OpsTodayBookingsSummary, 'restaurantId' | 'date'>;

export type DashboardDateState = {
  explicitDate: string | null;
  activeDate: string | null;
  isSummaryMismatch: boolean;
};

export function resolveDashboardDateState(params: {
  summary?: DashboardSummaryIdentity | null;
  restaurantId?: string | null;
  explicitDate?: string | null;
}): DashboardDateState {
  const { summary, restaurantId = null, explicitDate = null } = params;
  const isSummaryMismatch = isDashboardSummaryMismatch({
    summary,
    restaurantId,
    selectedDate: explicitDate,
  });

  return {
    explicitDate,
    activeDate: getRequestedDashboardDate({
      selectedDate: explicitDate,
      summaryDate: summary?.date ?? null,
      isSummaryMismatch,
    }),
    isSummaryMismatch,
  };
}

export function getRequestedDashboardDate(
  params: {
    selectedDate: string | null;
    summaryDate: string | null;
    isSummaryMismatch?: boolean;
  },
): string | null {
  const { selectedDate, summaryDate, isSummaryMismatch = false } = params;
  if (selectedDate) {
    return selectedDate;
  }
  if (isSummaryMismatch) {
    return null;
  }
  return selectedDate ?? summaryDate ?? null;
}

export function isDashboardSummaryMismatch(params: {
  summary?: DashboardSummaryIdentity | null;
  restaurantId?: string | null;
  selectedDate?: string | null;
}): boolean {
  const { summary, restaurantId = null, selectedDate = null } = params;
  if (!summary) {
    return false;
  }
  if (restaurantId && summary.restaurantId !== restaurantId) {
    return true;
  }
  if (selectedDate && summary.date !== selectedDate) {
    return true;
  }
  return false;
}

export function computeCalendarRange(date: string): { start: string; end: string } {
  const base = DateTime.fromISO(date, { zone: 'UTC' });
  if (!base.isValid) {
    return { start: date, end: date };
  }
  const start = base.startOf('month').minus({ days: base.startOf('month').weekday % 7 });
  const end = start.plus({ days: 41 });

  return {
    start: start.toISODate() ?? date,
    end: end.toISODate() ?? date,
  };
}

export function getDashboardDayBoundsUtc(
  date: string,
  timezone: string,
): { startUtcIso: string; endUtcIso: string } {
  const zone = timezone.trim().length > 0 ? timezone : 'UTC';
  const resolvedStart = DateTime.fromISO(date, { zone }).startOf('day');
  const start = resolvedStart.isValid
    ? resolvedStart
    : DateTime.fromISO(date, { zone: 'UTC' }).startOf('day');
  const end = start.plus({ days: 1 });

  return {
    startUtcIso: start.toUTC().toISO() ?? `${date}T00:00:00.000Z`,
    endUtcIso:
      end.toUTC().toISO() ??
      start.plus({ days: 1 }).toUTC().toISO() ??
      `${date}T23:59:59.999Z`,
  };
}
