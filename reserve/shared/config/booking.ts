export const BOOKING_TYPES = ['lunch', 'dinner'] as const;
export type BookingType = (typeof BOOKING_TYPES)[number];

export const BOOKING_TYPES_UI = ['lunch', 'dinner'] as const satisfies readonly BookingType[];

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

const isBookingTypeValue = createEnumPredicate(BOOKING_TYPES);
export const isBookingType = (value: string): value is BookingType => isBookingTypeValue(value);
export const isBookingStatus = createEnumPredicate(BOOKING_STATUSES);
export const isSeatingPreference = createEnumPredicate(SEATING_PREFERENCES);

function formatValidList(values: readonly string[]) {
  return values.map((entry) => `"${entry}"`).join(', ');
}

export function ensureBookingType(value: string, fieldName = 'booking type'): BookingType {
  const normalized = (value ?? '').trim();
  if (!isBookingType(normalized)) {
    throw new Error(`Invalid ${fieldName}: value is required.`);
  }
  return normalized as BookingType;
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
