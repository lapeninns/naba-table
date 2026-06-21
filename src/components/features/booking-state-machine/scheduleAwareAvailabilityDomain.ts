import { DateTime } from 'luxon';

import {
  calendarMaskQueryKey,
  fetchCalendarMask,
  fetchReservationSchedule,
  scheduleQueryKey,
  type CalendarMask,
} from '@reserve/features/reservations/wizard/services/schedule';
import {
  toTimeSlotDescriptor,
  type RawScheduleSlot,
  type ReservationSchedule,
} from '@reserve/features/reservations/wizard/services/timeSlots';
import { formatDateForInput } from '@reserve/shared/formatting/booking';
import {
  getLatestStartMinutes,
  hasCapacity,
  type UnavailabilityReason,
} from '@reserve/shared/schedule/availability';
import { normalizeTime, toMinutes } from '@reserve/shared/time';

import { toStartOfDay } from './scheduleAwareDateTimeDomain';
import { DEFAULT_MINUTES_STEP } from './scheduleAwareTimestampPickerConstants';

export { calendarMaskQueryKey, fetchCalendarMask, fetchReservationSchedule, scheduleQueryKey };

export type { CalendarMask, ReservationSchedule, UnavailabilityReason };

export type ScheduleRecord = {
  status: 'idle' | 'loading' | 'success' | 'error';
  schedule: ReservationSchedule | null;
  error?: string | null;
};

/**
 * Build a full interval grid from opening -> latest configured slot,
 * filling in missing slots so edit flows don't lose times when booking_slots is sparse.
 */
export const mergeWithSyntheticSlots = (
  schedule: ReservationSchedule | null,
): ReservationSchedule | null => {
  if (!schedule || schedule.isClosed) {
    return schedule;
  }

  const interval =
    Number.isFinite(schedule.intervalMinutes) && schedule.intervalMinutes > 0
      ? schedule.intervalMinutes
      : DEFAULT_MINUTES_STEP;

  const opensAt = normalizeTime(schedule.window?.opensAt ?? null);
  const latestStartMinutes = getLatestStartMinutes(schedule);
  if (!opensAt || typeof latestStartMinutes !== 'number') {
    return schedule;
  }

  const openingMinutes = toMinutes(opensAt);
  if (openingMinutes >= latestStartMinutes) {
    return schedule;
  }

  const existingByValue = new Map(schedule.slots.map((slot) => [slot.value, slot]));
  const defaultBookingOption =
    schedule.availableBookingOptions[0] ?? schedule.slots[0]?.bookingOption ?? 'lunch';

  const synthetic: RawScheduleSlot[] = [];
  for (let m = openingMinutes; m <= latestStartMinutes; m += interval) {
    const hours = Math.floor(m / 60);
    const minutes = m % 60;
    const value = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    if (existingByValue.has(value)) {
      continue;
    }
    synthetic.push({
      value,
      display: value,
      periodId: null,
      periodName: null,
      bookingOption: defaultBookingOption,
      defaultBookingOption,
      availability: {
        services: {},
        labels: {
          kitchenClosed: false,
          lunchWindow: false,
          dinnerWindow: false,
        },
      },
      disabled: true,
    });
  }

  if (synthetic.length === 0) {
    return schedule;
  }

  const mergedSlots = [...schedule.slots, ...synthetic].sort((a, b) =>
    a.value.localeCompare(b.value),
  );
  return { ...schedule, slots: mergedSlots };
};

export const MONTH_KEY_FORMATTER = (value: Date) =>
  `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}`;

export const buildMonthDateKeys = (monthStart: Date, minDate: Date): string[] => {
  const start = new Date(monthStart.getFullYear(), monthStart.getMonth(), 1);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
  const keys: string[] = [];
  const normalizedMin = toStartOfDay(minDate).getTime();

  for (let cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    if (cursor.getTime() < normalizedMin) {
      continue;
    }
    keys.push(formatDateForInput(new Date(cursor)));
  }

  return keys;
};

export const toMonthStart = (value: Date) => new Date(value.getFullYear(), value.getMonth(), 1);

export const buildMonthPrefetchTargets = (
  monthStart: Date,
  normalizedMinTimestamp: number,
): Date[] => {
  const targets: Date[] = [];
  const base = toMonthStart(monthStart);
  targets.push(base);

  const previous = new Date(base.getFullYear(), base.getMonth() - 1, 1);
  if (previous.getTime() >= normalizedMinTimestamp) {
    targets.push(previous);
  }

  const next = new Date(base.getFullYear(), base.getMonth() + 1, 1);
  targets.push(next);

  return targets;
};

export const deriveMaskAvailability = (
  mask: CalendarMask,
  normalizedMinTimestamp: number,
): Map<string, UnavailabilityReason | null> => {
  const results = new Map<string, UnavailabilityReason | null>();
  const zone = mask.timezone?.trim() || 'UTC';
  const start = DateTime.fromISO(mask.from, { zone }).startOf('day');
  const end = DateTime.fromISO(mask.to, { zone }).startOf('day');
  if (!start.isValid || !end.isValid) {
    return results;
  }

  const closedDateSet = new Set(mask.closedDates ?? []);
  const closedDaySet = new Set((mask.closedDaysOfWeek ?? []).map((value) => ((value % 7) + 7) % 7));

  for (let cursor = start; cursor <= end; cursor = cursor.plus({ days: 1 })) {
    const isoKey = cursor.toISODate();
    if (!isoKey) {
      continue;
    }
    const timestamp = new Date(cursor.year, cursor.month - 1, cursor.day).getTime();
    if (timestamp < normalizedMinTimestamp) {
      continue;
    }

    const weekday = cursor.weekday % 7;
    if (closedDateSet.has(isoKey) || closedDaySet.has(weekday)) {
      results.set(isoKey, 'closed');
    } else {
      results.set(isoKey, null);
    }
  }

  return results;
};

export const deriveScheduleUnavailability = (
  schedule: ReservationSchedule | null,
): UnavailabilityReason | null => {
  if (!schedule) {
    return 'unknown';
  }
  if (schedule.isClosed) {
    return 'closed';
  }
  const hasEnabledSlot = schedule.slots.some((slot) => hasCapacity(toTimeSlotDescriptor(slot)));
  return hasEnabledSlot ? null : 'no-slots';
};
