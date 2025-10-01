import { isReservationTime, normalizeTime as normalizeReservationTime } from '@reserve/shared/time';
import { runtime } from '@shared/config/runtime';

import type { ReservationTime } from '@reserve/shared/time';

export type ReservationConfig = {
  timezone: string;
  opening: {
    open: ReservationTime;
    close: ReservationTime;
    intervalMinutes: number;
  };
  windows: {
    weekdayLunchEnd: ReservationTime;
    weekendLunchEnd: ReservationTime;
    dinnerStart: ReservationTime;
    happyHour?: {
      start: ReservationTime;
      end: ReservationTime;
    };
  };
  defaultDurationMinutes: number;
  copy: {
    unavailableTooltip: string;
  };
};

export type ReservationConfigIssue = {
  key: string;
  value: string;
  reason: string;
};

type MutableReservationConfig = {
  config: ReservationConfig;
  issues: ReservationConfigIssue[];
};

const DEFAULT_RESERVATION_CONFIG: ReservationConfig = {
  timezone: 'Europe/London',
  opening: {
    open: '12:00' as ReservationTime,
    close: '23:00' as ReservationTime,
    intervalMinutes: 30,
  },
  windows: {
    weekdayLunchEnd: '15:00' as ReservationTime,
    weekendLunchEnd: '17:00' as ReservationTime,
    dinnerStart: '17:00' as ReservationTime,
    happyHour: {
      start: '15:00' as ReservationTime,
      end: '17:00' as ReservationTime,
    },
  },
  defaultDurationMinutes: 90,
  copy: {
    unavailableTooltip: 'Not available for the selected time.',
  },
};

const timeOverrideKeys = {
  open: 'RESERVE_RESERVATION_OPEN',
  close: 'RESERVE_RESERVATION_CLOSE',
  interval: 'RESERVE_RESERVATION_INTERVAL_MINUTES',
  weekdayLunchEnd: 'RESERVE_RESERVATION_WEEKDAY_LUNCH_END',
  weekendLunchEnd: 'RESERVE_RESERVATION_WEEKEND_LUNCH_END',
  dinnerStart: 'RESERVE_RESERVATION_DINNER_START',
  happyHourStart: 'RESERVE_RESERVATION_HAPPY_HOUR_START',
  happyHourEnd: 'RESERVE_RESERVATION_HAPPY_HOUR_END',
  duration: 'RESERVE_RESERVATION_DEFAULT_DURATION_MINUTES',
  timezone: 'RESERVE_RESERVATION_TIMEZONE',
  tooltip: 'RESERVE_RESERVATION_UNAVAILABLE_TOOLTIP',
} as const;

const normalizeTimeOverride = (
  key: string,
  fallback: ReservationTime,
  issues: ReservationConfigIssue[],
): ReservationTime => {
  const raw = runtime.readString(key);
  if (!raw) return fallback;
  const candidate = normalizeReservationTime(raw);
  if (!candidate || !isReservationTime(candidate)) {
    issues.push({
      key,
      value: raw,
      reason: 'Expected HH:MM 24-hour format',
    });
    return fallback;
  }
  return candidate;
};

const readIntervalOverride = (
  key: string,
  fallback: number,
  issues: ReservationConfigIssue[],
): number => {
  const raw = runtime.readNumber(key);
  if (raw === undefined) return fallback;
  if (!Number.isFinite(raw) || raw <= 0 || raw > 180) {
    issues.push({
      key,
      value: String(raw),
      reason: 'Interval must be between 1 and 180 minutes',
    });
    return fallback;
  }
  return raw;
};

const readDurationOverride = (
  key: string,
  fallback: number,
  issues: ReservationConfigIssue[],
): number => {
  const raw = runtime.readNumber(key);
  if (raw === undefined) return fallback;
  if (!Number.isFinite(raw) || raw < 15 || raw > 300) {
    issues.push({
      key,
      value: String(raw),
      reason: 'Duration must be between 15 and 300 minutes',
    });
    return fallback;
  }
  return raw;
};

const applyOverrides = (): MutableReservationConfig => {
  const issues: ReservationConfigIssue[] = [];
  const base = structuredClone(DEFAULT_RESERVATION_CONFIG);

  base.opening.open = normalizeTimeOverride(timeOverrideKeys.open, base.opening.open, issues);
  base.opening.close = normalizeTimeOverride(timeOverrideKeys.close, base.opening.close, issues);
  base.opening.intervalMinutes = readIntervalOverride(
    timeOverrideKeys.interval,
    base.opening.intervalMinutes,
    issues,
  );

  base.windows.weekdayLunchEnd = normalizeTimeOverride(
    timeOverrideKeys.weekdayLunchEnd,
    base.windows.weekdayLunchEnd,
    issues,
  );
  base.windows.weekendLunchEnd = normalizeTimeOverride(
    timeOverrideKeys.weekendLunchEnd,
    base.windows.weekendLunchEnd,
    issues,
  );
  base.windows.dinnerStart = normalizeTimeOverride(
    timeOverrideKeys.dinnerStart,
    base.windows.dinnerStart,
    issues,
  );

  const happyHourStart = normalizeTimeOverride(
    timeOverrideKeys.happyHourStart,
    base.windows.happyHour?.start ?? base.windows.dinnerStart,
    issues,
  );
  const happyHourEnd = normalizeTimeOverride(
    timeOverrideKeys.happyHourEnd,
    base.windows.happyHour?.end ?? base.windows.dinnerStart,
    issues,
  );

  if (base.windows.happyHour) {
    base.windows.happyHour = { start: happyHourStart, end: happyHourEnd };
  }

  const duration = readDurationOverride(
    timeOverrideKeys.duration,
    base.defaultDurationMinutes,
    issues,
  );
  base.defaultDurationMinutes = duration;

  const timezoneOverride = runtime.readString(timeOverrideKeys.timezone);
  if (timezoneOverride) {
    base.timezone = timezoneOverride.trim();
  }

  const tooltipOverride = runtime.readString(timeOverrideKeys.tooltip);
  if (tooltipOverride) {
    base.copy.unavailableTooltip = tooltipOverride.trim();
  }

  const openMinutes =
    parseInt(base.opening.open.slice(0, 2), 10) * 60 + parseInt(base.opening.open.slice(3), 10);
  const closeMinutes =
    parseInt(base.opening.close.slice(0, 2), 10) * 60 + parseInt(base.opening.close.slice(3), 10);

  if (closeMinutes <= openMinutes) {
    issues.push({
      key: `${timeOverrideKeys.open}/${timeOverrideKeys.close}`,
      value: `${base.opening.open}-${base.opening.close}`,
      reason: 'Close time must be after open time',
    });
  }

  return { config: base, issues };
};

export type ReservationConfigResult = MutableReservationConfig;

export const reservationConfigResult: ReservationConfigResult = applyOverrides();

if (reservationConfigResult.issues.length > 0 && runtime.isDev) {
  console.warn(
    '[reserve config] Using default reservation config due to issues:',
    reservationConfigResult.issues,
  );
}

export const defaultReservationConfig = reservationConfigResult.config;
