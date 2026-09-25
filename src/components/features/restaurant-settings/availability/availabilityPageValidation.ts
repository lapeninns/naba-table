/**
 * Validation for the Availability page draft. It runs the existing validators (the same rules
 * the save has always enforced) and restates their messages in plain wording, keyed by the id
 * of the field they belong to.
 */
import {
  RESERVATION_INTERVAL_MAX,
  RESERVATION_INTERVAL_MIN,
} from '@/lib/restaurants/reservation-interval';

import { validateHours, validateServices } from '../availabilityScheduleValidation';
import { validateTurnBandRows } from '../turnBandsDomain';
import {
  MEAL_KEYS,
  MEAL_LABEL,
  WEEK_ORDER,
  hasRequiredBookingTypes,
  type AvailabilityPageDraft,
  type AvailabilitySaveGroup,
  type BookingRulesDraft,
} from './availabilityPageDraft';

/** Error message by field id. Ids double as DOM ids, prefixed with `availability-`. */
export type AvailabilityErrors = Record<string, string>;

export const availabilityFieldId = (key: string) => `availability-${key}`;

export const weekdayFieldKey = (dayOfWeek: number, field: string) => `w${dayOfWeek}-${field}`;
export const overrideFieldKey = (id: string, field: string) => `o-${id}-${field}`;
export const bookingTypeFieldKey = (key: string) => `t-${key}-bands`;
export const TYPES_REQUIRED_KEY = 'types-required';

const INTERVAL_MESSAGE = `Enter a whole number from ${RESERVATION_INTERVAL_MIN} to ${RESERVATION_INTERVAL_MAX}, or leave blank`;
const SLOT_TIMES_MESSAGE = 'Use 24-hour times separated by commas, e.g. 12:00, 12:30';
const CLOSING_MESSAGE =
  'Closing must be after opening. Online booking doesn’t support hours past midnight.';

function hoursMessage(raw: string, field: 'opens' | 'closes'): string {
  if (raw === 'Required') {
    return field === 'opens' ? 'Enter an opening time' : 'Enter a closing time';
  }
  if (raw === 'Invalid time') {
    return field === 'opens' ? 'Enter a valid time, e.g. 12:00' : 'Enter a valid time, e.g. 22:00';
  }
  if (raw === 'Must be after open') {
    return CLOSING_MESSAGE;
  }
  return raw;
}

const RULE_LIMITS: Array<[keyof BookingRulesDraft, string, number, number]> = [
  ['reservationIntervalMinutes', 'r-interval', RESERVATION_INTERVAL_MIN, RESERVATION_INTERVAL_MAX],
  ['reservationLastSeatingBufferMinutes', 'r-buffer', 15, 300],
  ['reservationDefaultDurationMinutes', 'r-duration', 15, 300],
  ['reservationLifecycleGraceMinutes', 'r-grace', 0, 120],
];

export const BOOKING_RULE_LIMITS: Record<string, { min: number; max: number }> = Object.fromEntries(
  RULE_LIMITS.map(([, key, min, max]) => [key, { min, max }]),
);

function validateRules(rules: BookingRulesDraft, errors: AvailabilityErrors) {
  for (const [field, key, min, max] of RULE_LIMITS) {
    const raw = rules[field].trim();
    const value = Number(raw);
    if (!raw || !Number.isInteger(value) || value < min || value > max) {
      errors[key] = `Enter a whole number from ${min} to ${max}`;
    }
  }
}

export function validateAvailabilityDraft(
  draft: AvailabilityPageDraft,
  dirtyGroups: readonly AvailabilitySaveGroup[],
): AvailabilityErrors {
  const errors: AvailabilityErrors = {};
  const hours = validateHours(draft.weeklyRows, draft.overrideRows);

  for (const [day, dayErrors] of Object.entries(hours.weeklyErrors)) {
    const dayOfWeek = Number(day);
    if (dayErrors.opensAt)
      errors[weekdayFieldKey(dayOfWeek, 'opens')] = hoursMessage(dayErrors.opensAt, 'opens');
    if (dayErrors.closesAt)
      errors[weekdayFieldKey(dayOfWeek, 'closes')] = hoursMessage(dayErrors.closesAt, 'closes');
    if (dayErrors.reservationIntervalMinutes)
      errors[weekdayFieldKey(dayOfWeek, 'interval')] = INTERVAL_MESSAGE;
    if (dayErrors.reservationSlotTimes)
      errors[weekdayFieldKey(dayOfWeek, 'slots')] = SLOT_TIMES_MESSAGE;
  }

  draft.overrideRows.forEach((row, index) => {
    const rowErrors = hours.overrideErrors[index];
    const id = row.id ?? String(index);
    if (!rowErrors) return;
    if (rowErrors.effectiveDate === 'Required')
      errors[overrideFieldKey(id, 'date')] = 'Choose a date';
    if (rowErrors.effectiveDate === 'Duplicate date') {
      errors[overrideFieldKey(id, 'date')] = 'Two special dates share this date';
    }
    if (rowErrors.opensAt)
      errors[overrideFieldKey(id, 'opens')] = hoursMessage(rowErrors.opensAt, 'opens');
    if (rowErrors.closesAt)
      errors[overrideFieldKey(id, 'closes')] = hoursMessage(rowErrors.closesAt, 'closes');
    if (rowErrors.reservationIntervalMinutes)
      errors[overrideFieldKey(id, 'interval')] = INTERVAL_MESSAGE;
    if (rowErrors.reservationSlotTimes) errors[overrideFieldKey(id, 'slots')] = SLOT_TIMES_MESSAGE;
  });

  // Meal times are checked against the draft hours, not the saved ones.
  const services = validateServices(draft.dayConfigs);
  for (const day of draft.dayConfigs) {
    const dayErrors = services.serviceErrors[day.dayOfWeek];
    if (!dayErrors) continue;
    for (const meal of MEAL_KEYS) {
      const mealErrors = dayErrors[meal];
      if (!mealErrors) continue;
      const label = MEAL_LABEL[meal];
      if (mealErrors.start === 'Required')
        errors[weekdayFieldKey(day.dayOfWeek, `${meal}-start`)] = 'Enter a start time';
      if (mealErrors.start === 'Before kitchen opens') {
        errors[weekdayFieldKey(day.dayOfWeek, `${meal}-start`)] =
          `${label} starts before opening (${day.opensAt || '—'})`;
      }
      if (mealErrors.end === 'Required')
        errors[weekdayFieldKey(day.dayOfWeek, `${meal}-end`)] = 'Enter an end time';
      if (mealErrors.end === 'After kitchen closes') {
        errors[weekdayFieldKey(day.dayOfWeek, `${meal}-end`)] =
          `${label} ends after closing (${day.closesAt || '—'})`;
      }
      if (mealErrors.end === 'Must be after start') {
        errors[weekdayFieldKey(day.dayOfWeek, `${meal}-end`)] = 'End must be after start';
      }
    }
  }

  for (const [optionKey, rows] of Object.entries(draft.turnBands)) {
    if (!rows || rows.length === 0) continue;
    const result = validateTurnBandRows(rows);
    if (!result.ok) {
      errors[bookingTypeFieldKey(optionKey)] = 'Table times by party size need fixing';
    }
  }

  validateRules(draft.rules, errors);

  if (dirtyGroups.includes('meals') && !hasRequiredBookingTypes(draft.occasions)) {
    errors[TYPES_REQUIRED_KEY] =
      'Meal times can’t be saved until Lunch and Dinner booking types exist';
  }

  return errors;
}

/** Errors in page order, so "Show first issue" goes to the top-most one. */
export function orderAvailabilityErrorKeys(errors: AvailabilityErrors): string[] {
  const rank = (key: string): [number, number, string] => {
    const weekday = /^w(\d)-/.exec(key);
    if (weekday) return [1, WEEK_ORDER.indexOf(Number(weekday[1])), key];
    if (key.startsWith('o-')) return [2, 0, key];
    // The default table time sits at the top of Booking types and table times.
    if (key === 'r-duration') return [4, -1, key];
    if (key.startsWith('r-')) return [3, ['r-interval', 'r-buffer', 'r-grace'].indexOf(key), key];
    if (key === TYPES_REQUIRED_KEY) return [0, 0, key];
    return [4, 0, key];
  };
  return Object.keys(errors).sort((left, right) => {
    const [a1, a2, a3] = rank(left);
    const [b1, b2, b3] = rank(right);
    return a1 - b1 || a2 - b2 || a3.localeCompare(b3);
  });
}

export function countErrors(
  errors: AvailabilityErrors,
  prefix: string | ((key: string) => boolean),
): number {
  const match = typeof prefix === 'string' ? (key: string) => key.startsWith(prefix) : prefix;
  return Object.keys(errors).filter(match).length;
}
