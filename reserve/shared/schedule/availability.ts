import { DateTime } from 'luxon';

import {
  toTimeSlotDescriptor,
  type ReservationSchedule,
  type TimeSlotDescriptor,
} from '@reserve/features/reservations/wizard/services/timeSlots';
import { formatDateForInput } from '@reserve/shared/formatting/booking';
import { normalizeTime, toMinutes } from '@reserve/shared/time';

export type UnavailabilityReason = 'closed' | 'no-slots' | 'unknown';

type ScheduleDictionary =
  | ReadonlyMap<string, ReservationSchedule | null | undefined>
  | Record<string, ReservationSchedule | null | undefined>;

const isScheduleMap = (
  value: ScheduleDictionary,
): value is ReadonlyMap<string, ReservationSchedule | null | undefined> => {
  return value instanceof Map;
};

const readSchedule = (
  collection: ScheduleDictionary,
  dateKey: string,
): ReservationSchedule | null | undefined => {
  if (isScheduleMap(collection)) {
    return collection.get(dateKey);
  }
  return (collection as Record<string, ReservationSchedule | null | undefined>)[dateKey];
};

const deriveUnavailability = (
  schedule: ReservationSchedule | null | undefined,
): UnavailabilityReason | null => {
  if (!schedule) {
    return 'unknown';
  }
  if (schedule.isClosed) {
    return 'closed';
  }
  const hasAvailableSlot = schedule.slots.some((slot) => !slot.disabled);
  return hasAvailableSlot ? null : 'no-slots';
};

const getScheduleTimezone = (schedule: ReservationSchedule | null | undefined): string => {
  const value = schedule?.timezone?.trim();
  return value && value.length > 0 ? value : 'UTC';
};

const resolveDateKey = (value: string | Date): string => {
  if (typeof value === 'string') {
    return value;
  }
  return formatDateForInput(value);
};

/**
 * Build a map of disabled days → reason using a collection of pre-fetched schedules.
 */
export function getDisabledDays(collection: ScheduleDictionary): Map<string, UnavailabilityReason> {
  const entries = isScheduleMap(collection)
    ? collection.entries()
    : Object.entries(collection as Record<string, ReservationSchedule | null | undefined>);

  const disabled = new Map<string, UnavailabilityReason>();
  for (const [dateKey, schedule] of entries) {
    const reason = deriveUnavailability(schedule);
    if (reason) {
      disabled.set(dateKey, reason);
    }
  }
  return disabled;
}

/**
 * Determine whether a date is unavailable and return the reason if so.
 */
export function isDateUnavailable(
  date: string | Date,
  collection: ScheduleDictionary,
): UnavailabilityReason | null {
  const key = resolveDateKey(date);
  const schedule = readSchedule(collection, key);
  return deriveUnavailability(schedule);
}

/**
 * Return time-slot descriptors for a given schedule date. Falls back to an empty array if data is missing.
 */
export function getTimeSlots(
  date: string | Date,
  collection: ScheduleDictionary,
): TimeSlotDescriptor[] {
  const key = resolveDateKey(date);
  const schedule = readSchedule(collection, key);
  if (!schedule) {
    return [];
  }
  return schedule.slots.map((slot) => toTimeSlotDescriptor(slot));
}

/**
 * Guard against past selections or slots that would exceed the closing window.
 */
export function isPastOrClosing(params: {
  date: string;
  time: string | null | undefined;
  schedule: ReservationSchedule | null | undefined;
  now?: Date;
}): boolean {
  const normalizedTime = normalizeTime(params.time);
  const schedule = params.schedule;
  if (!normalizedTime || !schedule) {
    return true;
  }

  const zone = getScheduleTimezone(schedule);
  const start = DateTime.fromISO(`${params.date}T${normalizedTime}`, { zone });
  if (!start.isValid) {
    return true;
  }

  const reference = params.now
    ? DateTime.fromJSDate(params.now, { zone })
    : DateTime.now().setZone(zone);
  if (start <= reference) {
    return true;
  }

  const closesAt = normalizeTime(schedule.window?.closesAt ?? null);
  const guardMinutes = Math.max(
    0,
    schedule.lastSeatingBufferMinutes ?? 0,
    schedule.defaultDurationMinutes ?? 0,
  );

  if (closesAt) {
    const closing = DateTime.fromISO(`${schedule.date}T${closesAt}`, { zone });
    if (!closing.isValid) {
      return false;
    }
    const latestStart = closing.minus({ minutes: guardMinutes });
    if (start > latestStart) {
      return true;
    }
  }

  const opensAt = normalizeTime(schedule.window?.opensAt ?? null);
  if (opensAt) {
    const opening = DateTime.fromISO(`${schedule.date}T${opensAt}`, { zone });
    if (opening.isValid && start < opening) {
      return true;
    }
  }

  return false;
}

/**
 * Determine whether a slot still has capacity. Slots marked as disabled are considered full.
 */
export function hasCapacity(slot: TimeSlotDescriptor | null | undefined): boolean {
  if (!slot) {
    return false;
  }
  if (slot.disabled) {
    return false;
  }
  const services = slot.availability?.services ?? {};
  const bookingOptionState = services?.[slot.bookingOption];
  return bookingOptionState !== 'disabled';
}

/**
 * Compute the latest start time allowed by a schedule, useful for validating manual timestamps.
 */
export function getLatestStartMinutes(
  schedule: ReservationSchedule | null | undefined,
): number | null {
  if (!schedule) {
    return null;
  }
  const closesAt = normalizeTime(schedule.window?.closesAt ?? null);
  if (!closesAt) {
    return null;
  }
  const closingMinutes = toMinutes(closesAt);
  const guardMinutes = Math.max(
    0,
    schedule.lastSeatingBufferMinutes ?? 0,
    schedule.defaultDurationMinutes ?? 0,
  );
  return Math.max(0, closingMinutes - guardMinutes);
}
