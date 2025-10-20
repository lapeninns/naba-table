import type { OccasionKey } from '@reserve/shared/occasions';

export const BOOKING_TYPES = ['breakfast', 'lunch', 'dinner', 'drinks'] as const;
export type BookingType = OccasionKey;

export const BOOKING_TYPES_UI = [
  'lunch',
  'dinner',
  'drinks',
] as const satisfies readonly OccasionKey[];

export const BOOKING_STATUSES = [
  'pending',
  'pending_allocation',
  'confirmed',
  'cancelled',
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const BOOKING_BLOCKING_STATUSES = [
  'pending',
  'pending_allocation',
  'confirmed',
] as const satisfies readonly BookingStatus[];

export const SEATING_PREFERENCES = ['any', 'indoor', 'outdoor', 'window', 'booth', 'bar'] as const;
export type SeatingPreference = (typeof SEATING_PREFERENCES)[number];

export const SEATING_PREFERENCES_UI = [
  'any',
  'indoor',
  'outdoor',
] as const satisfies readonly SeatingPreference[];

function createEnumPredicate<const T extends readonly string[]>(values: T) {
  const set = new Set(values as readonly string[]);
  return (value: string): value is T[number] => set.has(value);
}

export const isBookingType = createEnumPredicate(BOOKING_TYPES);
export const isBookingStatus = createEnumPredicate(BOOKING_STATUSES);
export const isSeatingPreference = createEnumPredicate(SEATING_PREFERENCES);

function formatValidList(values: readonly string[]) {
  return values.map((entry) => `"${entry}"`).join(', ');
}

export function ensureBookingType(value: string, fieldName = 'booking type'): BookingType {
  if (!isBookingType(value)) {
    throw new Error(
      `Invalid ${fieldName}: ${value}. Valid values: ${formatValidList(BOOKING_TYPES)}.`,
    );
  }
  return value;
}

export function ensureBookingStatus(value: string, fieldName = 'booking status'): BookingStatus {
  if (!isBookingStatus(value)) {
    throw new Error(
      `Invalid ${fieldName}: ${value}. Valid values: ${formatValidList(BOOKING_STATUSES)}.`,
    );
  }
  return value;
}

export function ensureSeatingPreference(
  value: string,
  fieldName = 'seating preference',
): SeatingPreference {
  if (!isSeatingPreference(value)) {
    throw new Error(
      `Invalid ${fieldName}: ${value}. Valid values: ${formatValidList(SEATING_PREFERENCES)}.`,
    );
  }
  return value;
}
