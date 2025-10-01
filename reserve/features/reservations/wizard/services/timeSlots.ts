import {
  defaultReservationConfig,
  reservationConfigResult,
} from '@reserve/shared/config/reservations';
import {
  createDateFromParts,
  isReservationDate,
  normalizeTime,
  slotsForRange,
  toMinutes,
} from '@reserve/shared/time';

import type { BookingOption } from '@reserve/shared/booking';
import type { ReservationConfig } from '@reserve/shared/config/reservations';
import type { ReservationDate, ReservationTime } from '@reserve/shared/time';

export type { BookingOption };

export type ServiceState = 'enabled' | 'disabled';

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

export type ServiceAvailability = {
  services: Record<BookingOption, ServiceState>;
  labels: {
    happyHour: boolean;
    drinksOnly: boolean;
    kitchenClosed: boolean;
    lunchWindow: boolean;
    dinnerWindow: boolean;
  };
};

export type TimeSlotLabel = 'Lunch' | 'Dinner' | 'Happy Hour' | 'Drinks only';

export type TimeSlotDescriptor = {
  value: ReservationTime;
  display: string;
  label: TimeSlotLabel;
  availability: ServiceAvailability;
  defaultBookingOption: BookingOption;
  disabled: boolean;
};

const EMPTY_AVAILABILITY: ServiceAvailability = {
  services: {
    lunch: 'disabled',
    dinner: 'disabled',
    drinks: 'disabled',
  },
  labels: {
    happyHour: false,
    drinksOnly: false,
    kitchenClosed: false,
    lunchWindow: false,
    dinnerWindow: false,
  },
};

const formatters = new Map<string, Intl.DateTimeFormat>();

const getFormatter = (timezone: string) => {
  const key = timezone || 'Europe/London';
  if (!formatters.has(key)) {
    formatters.set(
      key,
      new Intl.DateTimeFormat('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: key,
      }),
    );
  }
  return formatters.get(key)!;
};

const toMinutesFromTime = (time: ReservationTime): number => toMinutes(time);

const safeReservationDate = (value: string | null | undefined): ReservationDate | null => {
  if (!value) return null;
  return isReservationDate(value) ? (value as ReservationDate) : null;
};

const within = (minutes: number, window: ServiceWindow | null | undefined): boolean => {
  if (!window) return false;
  const start = toMinutesFromTime(window.start);
  const end = toMinutesFromTime(window.end);
  return minutes >= start && minutes < end;
};

const windowsForDate = (config: ReservationConfig, date: ReservationDate): ServiceWindows => {
  const baseDate = new Date(`${date}T00:00:00`);
  const day = baseDate.getDay();
  const isWeekend = day === 0 || day === 6;

  const lunchEnd = isWeekend ? config.windows.weekendLunchEnd : config.windows.weekdayLunchEnd;
  const happyHourWindow = !isWeekend ? (config.windows.happyHour ?? null) : null;

  return {
    lunch: { start: config.opening.open, end: lunchEnd },
    dinner: { start: config.windows.dinnerStart, end: config.opening.close },
    drinks: { start: config.opening.open, end: config.opening.close },
    happyHour: happyHourWindow ?? null,
  } satisfies ServiceWindows;
};

const computeServiceAvailability = (
  date: ReservationDate,
  time: ReservationTime,
  config: ReservationConfig,
): ServiceAvailability => {
  const slotDate = createDateFromParts(date, time);
  const minutes = slotDate.getHours() * 60 + slotDate.getMinutes();
  const windows = windowsForDate(config, date);

  const openMinutes = toMinutesFromTime(config.opening.open);
  const closeMinutes = toMinutesFromTime(config.opening.close);
  const isOpen = minutes >= openMinutes && minutes < closeMinutes;

  const baseLunch = isOpen && within(minutes, windows.lunch);
  const baseDinner = isOpen && within(minutes, windows.dinner);
  const inHappyHourWindow = isOpen && within(minutes, windows.happyHour);

  const services: Record<BookingOption, ServiceState> = {
    lunch: baseLunch && !inHappyHourWindow ? 'enabled' : 'disabled',
    dinner: baseDinner && !inHappyHourWindow ? 'enabled' : 'disabled',
    drinks: isOpen ? 'enabled' : 'disabled',
  };

  const drinksOnly =
    services.drinks === 'enabled' &&
    services.lunch === 'disabled' &&
    services.dinner === 'disabled';

  return {
    services,
    labels: {
      happyHour: inHappyHourWindow,
      drinksOnly,
      kitchenClosed: inHappyHourWindow,
      lunchWindow: services.lunch === 'enabled',
      dinnerWindow: services.dinner === 'enabled',
    },
  };
};

const resolveDefaultBookingOptionWithConfig = (
  date: ReservationDate,
  time: ReservationTime,
  config: ReservationConfig,
): BookingOption => {
  const availability = computeServiceAvailability(date, time, config);
  if (availability.labels.happyHour) return 'drinks';
  if (availability.services.lunch === 'enabled') return 'lunch';
  if (availability.services.dinner === 'enabled') return 'dinner';
  return 'drinks';
};

const resolveSlotLabel = (minutes: number, windows: ServiceWindows): TimeSlotLabel => {
  if (within(minutes, windows.happyHour)) return 'Happy Hour';
  if (within(minutes, windows.lunch)) return 'Lunch';
  if (within(minutes, windows.dinner)) return 'Dinner';
  return 'Drinks only';
};

const resolveConfig = (config?: ReservationConfig): ReservationConfig =>
  config ?? defaultReservationConfig;

export type BuildTimeSlotsOptions = {
  date: string | null | undefined;
  config?: ReservationConfig;
};

export function buildTimeSlots({ date, config }: BuildTimeSlotsOptions): TimeSlotDescriptor[] {
  const resolvedConfig = resolveConfig(config);
  const formatter = getFormatter(resolvedConfig.timezone);
  const reservationDate = safeReservationDate(date);
  if (!reservationDate) return [];

  const slots = slotsForRange(
    resolvedConfig.opening.open,
    resolvedConfig.opening.close,
    resolvedConfig.opening.intervalMinutes,
  );

  const windows = windowsForDate(resolvedConfig, reservationDate);

  return slots.map((value) => {
    const slotDate = createDateFromParts(reservationDate, value);
    const minutes = slotDate.getHours() * 60 + slotDate.getMinutes();
    const availability = computeServiceAvailability(reservationDate, value, resolvedConfig);
    const defaultBookingOption = resolveDefaultBookingOptionWithConfig(
      reservationDate,
      value,
      resolvedConfig,
    );
    const disabled = availability.services[defaultBookingOption] === 'disabled';
    const display = formatter.format(
      new Date(Date.UTC(1970, 0, 1, Number(value.slice(0, 2)), Number(value.slice(3, 5)))),
    );

    return {
      value,
      display,
      label: resolveSlotLabel(minutes, windows),
      availability,
      defaultBookingOption,
      disabled,
    } satisfies TimeSlotDescriptor;
  });
}

export function getServiceAvailability(
  dateInput: string | null | undefined,
  timeInput: string | ReservationTime | null | undefined,
  config?: ReservationConfig,
): ServiceAvailability {
  const reservationDate = safeReservationDate(dateInput);
  const resolvedConfig = resolveConfig(config);
  const normalizedTime = typeof timeInput === 'string' ? normalizeTime(timeInput) : timeInput;

  if (!reservationDate || !normalizedTime) {
    return EMPTY_AVAILABILITY;
  }

  return computeServiceAvailability(reservationDate, normalizedTime, resolvedConfig);
}

export function resolveDefaultBookingOption(
  date: string | null | undefined,
  time: string | ReservationTime | null | undefined,
  config?: ReservationConfig,
): BookingOption {
  const reservationDate = safeReservationDate(date);
  const resolvedConfig = resolveConfig(config);
  const normalizedTime = typeof time === 'string' ? normalizeTime(time) : time;

  if (!reservationDate || !normalizedTime) {
    return 'drinks';
  }

  return resolveDefaultBookingOptionWithConfig(reservationDate, normalizedTime, resolvedConfig);
}

export const reservationConfigIssues = reservationConfigResult.issues;
export const defaultTimeSlotConfig = defaultReservationConfig;
