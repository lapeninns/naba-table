import {
  reservationConfigResult,
  type ReservationConfig,
} from '@reserve/shared/config/reservations';
import { normalizeTime, slotsForRange, toMinutes } from '@reserve/shared/time';

import type { BookingOption } from '@reserve/shared/booking';
import type { ReservationTime } from '@reserve/shared/time';

export type ServiceWindow = {
  start: ReservationTime;
  end: ReservationTime;
};

export type ServiceWindows = {
  lunch: ServiceWindow;
  dinner: ServiceWindow;
  drinks: ServiceWindow;
  happyHour: ServiceWindow | null;
};

function resolveConfig(config?: ReservationConfig): ReservationConfig {
  return config ?? reservationConfigResult.config;
}

function resolveBaseDate(dateInput: string | null | undefined): Date {
  if (dateInput) {
    const input = new Date(`${dateInput}T00:00:00`);
    if (!Number.isNaN(input.getTime())) {
      return input;
    }
  }
  const fallback = new Date();
  fallback.setHours(0, 0, 0, 0);
  return fallback;
}

export function getServiceWindows(
  date: string | null | undefined,
  config?: ReservationConfig,
): ServiceWindows {
  const resolvedConfig = resolveConfig(config);
  const baseDate = resolveBaseDate(date);
  const day = baseDate.getDay();
  const isWeekend = day === 0 || day === 6;
  const lunchEnd = isWeekend
    ? resolvedConfig.windows.weekendLunchEnd
    : resolvedConfig.windows.weekdayLunchEnd;
  const happyHour = !isWeekend ? (resolvedConfig.windows.happyHour ?? null) : null;

  return {
    lunch: { start: resolvedConfig.opening.open, end: lunchEnd },
    dinner: { start: resolvedConfig.windows.dinnerStart, end: resolvedConfig.opening.close },
    drinks: { start: resolvedConfig.opening.open, end: resolvedConfig.opening.close },
    happyHour,
  } satisfies ServiceWindows;
}

function minutesBetween(window: ServiceWindow): { start: number; end: number } {
  return {
    start: toMinutes(window.start),
    end: toMinutes(window.end),
  };
}

function isWithin(minutes: number, window: ServiceWindow | null | undefined): boolean {
  if (!window) return false;
  const range = minutesBetween(window);
  return minutes >= range.start && minutes < range.end;
}

export function getSlotsByService(
  date: string | null | undefined,
  config?: ReservationConfig,
): Record<BookingOption, ReservationTime[]> {
  const windows = getServiceWindows(date, config);
  const resolvedConfig = resolveConfig(config);
  return {
    lunch: slotsForRange(
      windows.lunch.start,
      windows.lunch.end,
      resolvedConfig.opening.intervalMinutes,
    ),
    dinner: slotsForRange(
      windows.dinner.start,
      windows.dinner.end,
      resolvedConfig.opening.intervalMinutes,
    ),
    drinks: slotsForRange(
      windows.drinks.start,
      windows.drinks.end,
      resolvedConfig.opening.intervalMinutes,
    ),
  } satisfies Record<BookingOption, ReservationTime[]>;
}

function toMinuteValue(value: string | ReservationTime | null | undefined): number {
  const normalized = normalizeTime(value);
  if (!normalized) return 0;
  return toMinutes(normalized);
}

export function inferBookingOption(
  time: string | ReservationTime | null | undefined,
  date: string | null | undefined,
  config?: ReservationConfig,
): BookingOption {
  const resolvedConfig = resolveConfig(config);
  const windows = getServiceWindows(date, resolvedConfig);
  const minutes = toMinuteValue(time);

  if (windows.happyHour && isWithin(minutes, windows.happyHour)) {
    return 'drinks';
  }
  if (isWithin(minutes, windows.lunch)) {
    return 'lunch';
  }
  if (isWithin(minutes, windows.dinner)) {
    return 'dinner';
  }

  const dinnerStartMinutes = toMinutes(resolvedConfig.windows.dinnerStart);
  return minutes >= dinnerStartMinutes ? 'dinner' : 'lunch';
}
