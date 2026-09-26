/**
 * Client-safe guest slot computation shared by `server/restaurants/schedule.ts` (the live
 * guest schedule) and the Availability settings booking preview. Pure: no database, no env.
 * Any change here changes which times guests can book.
 */
import { formatReservationTime } from '@reserve/shared/formatting/booking';
import {
  isOccasionAvailable,
  type OccasionCatalog,
  type OccasionKey,
} from '@reserve/shared/occasions';
import { MINUTES_PER_DAY, fromMinutes, normalizeTime, toMinutes } from '@reserve/shared/time';

import type { ReservationTime } from '@reserve/shared/time';

type ServiceState = 'enabled' | 'disabled';
type CoverageRange = { start: number; end: number };
type OptionCoverage = Map<OccasionKey, CoverageRange[]>;

export type ServiceAvailability = {
  services: Record<OccasionKey, ServiceState>;
  labels: {
    kitchenClosed: boolean;
    lunchWindow: boolean;
    dinnerWindow: boolean;
  };
};

export type RestaurantScheduleSlot = {
  value: ReservationTime;
  display: string;
  periodId: string | null;
  periodName: string | null;
  bookingOption: OccasionKey;
  defaultBookingOption: OccasionKey;
  availability: ServiceAvailability;
  disabled: boolean;
};

/** One `restaurant_operating_hours` row (weekly or date override). */
export type ScheduleHoursRow = {
  opensAt: string | null;
  closesAt: string | null;
  isClosed: boolean | null;
  notes: string | null;
  reservationIntervalMinutes: number | null;
  reservationSlotTimes: string[] | null;
};

/** One `restaurant_service_periods` row (a meal window). */
export type ScheduleServicePeriod = {
  id: string;
  name: string;
  dayOfWeek: number | null;
  startTime: string;
  endTime: string;
  bookingOption: string;
};

export type EffectiveScheduleHours = {
  opensAt: ReservationTime | null;
  closesAt: ReservationTime | null;
  isClosed: boolean;
  intervalMinutes: number;
  /** Fixed start times in force, or null for regular spacing. */
  fixedSlotTimes: ReservationTime[] | null;
  notes: string | null;
};

const WEEKDAY_MAP: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

export const GUEST_SCHEDULE_BOOKING_OPTIONS: readonly OccasionKey[] = ['lunch', 'dinner'];
const ALLOWED_BOOKING_OPTIONS = new Set<OccasionKey>(GUEST_SCHEDULE_BOOKING_OPTIONS);
const DEFAULT_BOOKING_OPTION: OccasionKey = 'lunch';

export function resolveScheduleDayOfWeek(date: string, timezone: string): number {
  try {
    const base = new Date(`${date}T12:00:00Z`);
    const formatter = new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      timeZone: timezone,
    });
    const weekday = formatter.format(base).toLowerCase();
    if (weekday in WEEKDAY_MAP) {
      return WEEKDAY_MAP[weekday];
    }
  } catch (error) {
    console.warn('[schedule] failed to resolve weekday', { date, timezone, error });
  }
  const fallback = new Date(`${date}T00:00:00`);
  return Number.isNaN(fallback.getDay()) ? 0 : fallback.getDay();
}

export function resolveScheduleMonth(date: string, timezone: string): number {
  try {
    const base = new Date(`${date}T12:00:00Z`);
    const formatter = new Intl.DateTimeFormat('en-US', {
      month: 'numeric',
      timeZone: timezone,
    });
    const month = Number.parseInt(formatter.format(base), 10);
    if (Number.isFinite(month)) {
      return month;
    }
  } catch (error) {
    console.warn('[schedule] failed to resolve month', { date, timezone, error });
  }
  const fallback = new Date(`${date}T00:00:00`);
  return fallback.getMonth() + 1;
}

function normalizeMaybeTime(value: string | null | undefined): ReservationTime | null {
  return normalizeTime(value ?? null);
}

function normalizeSlotTimes(value: string[] | null | undefined): ReservationTime[] {
  if (!value || value.length === 0) {
    return [];
  }
  const seen = new Set<number>();
  const slots: Array<{ minutes: number; value: ReservationTime }> = [];
  value.forEach((entry) => {
    const normalized = normalizeTime(entry);
    if (!normalized) {
      return;
    }
    const minutes = toMinutes(normalized);
    if (seen.has(minutes)) {
      return;
    }
    seen.add(minutes);
    slots.push({ minutes, value: normalized });
  });
  slots.sort((a, b) => a.minutes - b.minutes);
  return slots.map((slot) => slot.value);
}

/** Closing minutes past opening (a close before open counts as the next day); null when equal. */
export function resolveRangeEndMinutes(startMinutes: number, endMinutes: number): number | null {
  if (endMinutes === startMinutes) {
    return null;
  }
  return endMinutes < startMinutes ? endMinutes + MINUTES_PER_DAY : endMinutes;
}

function resolveSlotMinutesForRange(
  slot: ReservationTime,
  startMinutes: number,
  endMinutes: number,
): number {
  const minutes = toMinutes(slot);
  return endMinutes > MINUTES_PER_DAY && minutes < startMinutes
    ? minutes + MINUTES_PER_DAY
    : minutes;
}

function slotsForOperatingRange(
  opensAt: ReservationTime,
  closesAt: ReservationTime,
  intervalMinutes: number,
): ReservationTime[] {
  if (intervalMinutes <= 0) {
    return [];
  }
  const startMinutes = toMinutes(opensAt);
  const rawEndMinutes = toMinutes(closesAt);
  const endMinutes = resolveRangeEndMinutes(startMinutes, rawEndMinutes);
  if (endMinutes === null) {
    return [];
  }
  const slots: ReservationTime[] = [];
  for (let minutes = startMinutes; minutes < endMinutes; minutes += intervalMinutes) {
    slots.push(fromMinutes(minutes));
  }
  return slots;
}

function resolveIntervalMinutes(
  overrideInterval: number | null | undefined,
  weeklyInterval: number | null | undefined,
  fallback: number,
): number {
  if (typeof overrideInterval === 'number' && overrideInterval > 0) {
    return overrideInterval;
  }
  if (typeof weeklyInterval === 'number' && weeklyInterval > 0) {
    return weeklyInterval;
  }
  return fallback > 0 ? fallback : 15;
}

/**
 * Hours in force on a date: a date override replaces the weekly row entirely, except that the
 * interval and fixed start times fall back to the weekly row when the override leaves them empty.
 */
export function resolveEffectiveScheduleHours(input: {
  overrideRow: ScheduleHoursRow | null;
  weeklyRow: ScheduleHoursRow | null;
  restaurantIntervalMinutes: number;
}): EffectiveScheduleHours {
  const { overrideRow, weeklyRow } = input;
  const effectiveHours = overrideRow ?? weeklyRow ?? null;
  const opensAt = normalizeMaybeTime(effectiveHours?.opensAt);
  const closesAt = normalizeMaybeTime(effectiveHours?.closesAt);
  const closedFlag = Boolean(effectiveHours?.isClosed);
  const isClosed =
    closedFlag ||
    !opensAt ||
    !closesAt ||
    resolveRangeEndMinutes(toMinutes(opensAt), toMinutes(closesAt)) === null;
  const intervalMinutes = resolveIntervalMinutes(
    overrideRow?.reservationIntervalMinutes,
    weeklyRow?.reservationIntervalMinutes,
    input.restaurantIntervalMinutes,
  );
  const overrideSlotTimes = normalizeSlotTimes(overrideRow?.reservationSlotTimes);
  const weeklySlotTimes = normalizeSlotTimes(weeklyRow?.reservationSlotTimes);
  const effectiveSlotTimes = overrideSlotTimes.length > 0 ? overrideSlotTimes : weeklySlotTimes;

  return {
    opensAt,
    closesAt,
    isClosed,
    intervalMinutes,
    fixedSlotTimes: effectiveSlotTimes.length > 0 ? effectiveSlotTimes : null,
    notes: effectiveHours?.notes?.trim() || null,
  };
}

/** Meal windows that apply on a weekday: that weekday's rows plus rows for every day. */
export function filterServicePeriodsForDay(
  periods: readonly ScheduleServicePeriod[],
  dayOfWeek: number,
): ScheduleServicePeriod[] {
  return periods.filter(
    (period) =>
      Boolean(period) &&
      Boolean(period.startTime) &&
      Boolean(period.endTime) &&
      (period.dayOfWeek === null || period.dayOfWeek === dayOfWeek),
  );
}

function pickBookingOption(period?: ScheduleServicePeriod | null): OccasionKey {
  const raw = period?.bookingOption;
  if (!raw) {
    return DEFAULT_BOOKING_OPTION;
  }
  const trimmed = raw.toString().trim().toLowerCase();
  return (trimmed.length > 0 ? trimmed : DEFAULT_BOOKING_OPTION) as OccasionKey;
}

function buildCoverage(periods: ScheduleServicePeriod[]): OptionCoverage {
  const coverage: OptionCoverage = new Map();
  periods.forEach((period) => {
    const start = normalizeMaybeTime(period.startTime);
    const end = normalizeMaybeTime(period.endTime);
    if (!start || !end) {
      return;
    }
    const startMinutes = toMinutes(start);
    const endMinutes = resolveRangeEndMinutes(startMinutes, toMinutes(end));
    if (endMinutes === null) {
      return;
    }
    const option = pickBookingOption(period);
    if (!ALLOWED_BOOKING_OPTIONS.has(option)) {
      return;
    }
    const ranges = coverage.get(option) ?? [];
    ranges.push({ start: startMinutes, end: endMinutes });
    coverage.set(option, ranges);
  });
  return coverage;
}

function hasCoverage(
  coverage: OptionCoverage,
  option: OccasionKey,
  slot: ReservationTime,
): boolean {
  const ranges = coverage.get(option);
  if (!ranges || ranges.length === 0) {
    return false;
  }
  const minutes = toMinutes(slot);
  return ranges.some(({ start, end }) => {
    const adjustedMinutes =
      end > MINUTES_PER_DAY && minutes < start ? minutes + MINUTES_PER_DAY : minutes;
    return adjustedMinutes >= start && adjustedMinutes < end;
  });
}

type AvailabilityParams = {
  primaryOption: OccasionKey;
  coverage: OptionCoverage;
  slot: ReservationTime;
  orderedKeys: readonly OccasionKey[];
  catalog: OccasionCatalog;
  date: string;
  timezone: string;
  month: number;
};

function buildAvailability({
  primaryOption,
  coverage,
  slot,
  orderedKeys,
  catalog,
  date,
  timezone,
  month,
}: AvailabilityParams): ServiceAvailability {
  const keys = Array.from(
    new Set<OccasionKey>([...orderedKeys, ...coverage.keys(), primaryOption]),
  ).filter((key) => ALLOWED_BOOKING_OPTIONS.has(key));
  const services: Record<OccasionKey, ServiceState> = {};

  keys.forEach((key) => {
    let enabled = hasCoverage(coverage, key, slot);
    if (enabled) {
      const definition = catalog.byKey.get(key);
      if (definition) {
        enabled = isOccasionAvailable(definition, { date, time: slot, timezone, month });
      }
    }
    services[key] = enabled ? 'enabled' : 'disabled';
  });

  const lunchState = services['lunch'] ?? 'disabled';
  const dinnerState = services['dinner'] ?? 'disabled';
  const kitchenClosed = lunchState === 'disabled' && dinnerState === 'disabled';

  return {
    services,
    labels: {
      kitchenClosed,
      lunchWindow: lunchState === 'enabled',
      dinnerWindow: dinnerState === 'enabled',
    },
  };
}

export type ScheduleSlotsInput = {
  opensAt: ReservationTime | null;
  closesAt: ReservationTime | null;
  intervalMinutes: number;
  /** Meal windows already filtered to the day (`filterServicePeriodsForDay`). */
  periods: ScheduleServicePeriod[];
  dayOfWeek: number;
  /** Active booking types only, as the live catalogue holds them. */
  catalog: OccasionCatalog;
  date: string;
  timezone: string;
  month: number;
  fixedSlots: ReservationTime[] | null;
};

/** A candidate start time: its slot when a meal window covers it, otherwise null. */
export type ScheduleSlotCandidate = {
  value: ReservationTime;
  slot: RestaurantScheduleSlot | null;
};

/**
 * Every candidate start time for the day (fixed start times inside the hours, or regular spacing
 * from opening) and the meal window it falls in. When windows overlap, the weekday-specific one
 * wins, then the shortest, then lunch before dinner, then the earlier start, then the name.
 */
export function computeScheduleSlotCandidates({
  opensAt,
  closesAt,
  intervalMinutes,
  periods,
  dayOfWeek,
  catalog,
  date,
  timezone,
  month,
  fixedSlots,
}: ScheduleSlotsInput): ScheduleSlotCandidate[] {
  if (!opensAt || !closesAt) {
    return [];
  }
  const openingMinutes = toMinutes(opensAt);
  const closingMinutes = resolveRangeEndMinutes(openingMinutes, toMinutes(closesAt));
  if (closingMinutes === null) {
    return [];
  }

  const coverage = buildCoverage(periods);
  const orderedKeys = GUEST_SCHEDULE_BOOKING_OPTIONS;
  const optionPriority = new Map<OccasionKey, number>();
  orderedKeys.forEach((key, index) => optionPriority.set(key, index));

  type PeriodDetail = {
    period: ScheduleServicePeriod;
    option: OccasionKey;
    isDaySpecific: boolean;
    startMinutes: number;
    endMinutes: number;
    durationMinutes: number;
    fallbackBias: number;
    optionOrder: number;
  };

  const periodDetails = periods.reduce<PeriodDetail[]>((acc, period) => {
    const start = normalizeMaybeTime(period.startTime);
    const end = normalizeMaybeTime(period.endTime);
    if (!start || !end) {
      return acc;
    }
    const startMinutes = toMinutes(start);
    const endMinutes = resolveRangeEndMinutes(startMinutes, toMinutes(end));
    if (endMinutes === null) {
      return acc;
    }
    const option = pickBookingOption(period);
    if (!ALLOWED_BOOKING_OPTIONS.has(option)) {
      return acc;
    }
    acc.push({
      period,
      option,
      isDaySpecific: period.dayOfWeek === dayOfWeek,
      startMinutes,
      endMinutes,
      durationMinutes: endMinutes - startMinutes,
      fallbackBias: 0,
      optionOrder: optionPriority.get(option) ?? optionPriority.size,
    });
    return acc;
  }, []);

  const findPeriodForTime = (value: ReservationTime) => {
    const slotMinutes = resolveSlotMinutesForRange(value, openingMinutes, closingMinutes);
    const matches = periodDetails.filter(
      (entry) => slotMinutes >= entry.startMinutes && slotMinutes < entry.endMinutes,
    );
    if (matches.length === 0) {
      return null;
    }

    matches.sort((a, b) => {
      if (a.isDaySpecific !== b.isDaySpecific) {
        return a.isDaySpecific ? -1 : 1;
      }
      if (a.durationMinutes !== b.durationMinutes) {
        return a.durationMinutes - b.durationMinutes;
      }
      if (a.fallbackBias !== b.fallbackBias) {
        return a.fallbackBias - b.fallbackBias;
      }
      if (a.optionOrder !== b.optionOrder) {
        return a.optionOrder - b.optionOrder;
      }
      if (a.startMinutes !== b.startMinutes) {
        return a.startMinutes - b.startMinutes;
      }
      return (a.period.name ?? '').localeCompare(b.period.name ?? '');
    });

    return matches[0]?.period ?? null;
  };

  const baseSlots =
    fixedSlots && fixedSlots.length > 0
      ? fixedSlots.filter((slot) => {
          const minutes = resolveSlotMinutesForRange(slot, openingMinutes, closingMinutes);
          if (minutes < openingMinutes) {
            return false;
          }
          if (minutes >= closingMinutes) {
            return false;
          }
          return true;
        })
      : slotsForOperatingRange(opensAt, closesAt, intervalMinutes);

  return baseSlots.map((slot) => {
    const period = periodDetails.length > 0 ? findPeriodForTime(slot) : null;
    if (!period) {
      return { value: slot, slot: null };
    }
    const resolvedOption = pickBookingOption(period);
    const bookingOption = ALLOWED_BOOKING_OPTIONS.has(resolvedOption)
      ? resolvedOption
      : DEFAULT_BOOKING_OPTION;
    const availability = buildAvailability({
      primaryOption: bookingOption,
      coverage,
      slot,
      orderedKeys,
      catalog,
      date,
      timezone,
      month,
    });
    const defaultBookingOption = bookingOption;
    const optionDefinition = catalog.byKey.get(bookingOption);
    const disabled = availability.services[defaultBookingOption] === 'disabled';
    const label =
      period?.name?.trim() ??
      optionDefinition?.label ??
      bookingOption.replace(/\b\w/g, (char) => char.toUpperCase());

    return {
      value: slot,
      slot: {
        value: slot,
        display: formatReservationTime(slot),
        periodId: period?.id ?? null,
        periodName: label,
        bookingOption,
        defaultBookingOption,
        availability,
        disabled,
      },
    };
  });
}

/** The day's schedule slots: candidate start times that fall inside a meal window. */
export function computeScheduleSlots(input: ScheduleSlotsInput): RestaurantScheduleSlot[] {
  return computeScheduleSlotCandidates(input).flatMap((candidate) =>
    candidate.slot ? [candidate.slot] : [],
  );
}
