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

const getLatestSlotMinutes = (schedule: ReservationSchedule | null | undefined): number | null => {
  if (!schedule || schedule.slots.length === 0) {
    return null;
  }

  return schedule.slots.reduce<number | null>((latest, slot) => {
    const normalized = normalizeTime(slot.value);
    if (!normalized) {
      return latest;
    }
    const candidate = toMinutes(normalized);
    return latest === null ? candidate : Math.max(latest, candidate);
  }, null);
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
 * Guard against past selections or times beyond the configured schedule slots.
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

  const latestSlotMinutes = getLatestSlotMinutes(schedule);
  if (latestSlotMinutes !== null) {
    const latestHours = Math.floor(latestSlotMinutes / 60);
    const latestMinutes = latestSlotMinutes % 60;
    const latestSlot = DateTime.fromISO(
      `${schedule.date}T${String(latestHours).padStart(2, '0')}:${String(latestMinutes).padStart(2, '0')}`,
      { zone },
    );
    if (latestSlot.isValid && start > latestSlot) {
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
 * Filter schedule slots to those the guest can still pick (not disabled, not in the past).
 */
export function filterSelectableTimeSlots(
  slots: TimeSlotDescriptor[],
  params: {
    date: string;
    schedule: ReservationSchedule | null | undefined;
    now?: Date;
  },
): TimeSlotDescriptor[] {
  return slots.filter((slot) => {
    if (slot.disabled) {
      return false;
    }
    return !isPastOrClosing({
      date: params.date,
      time: slot.value,
      schedule: params.schedule,
      now: params.now,
    });
  });
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
  return getLatestSlotMinutes(schedule);
}
