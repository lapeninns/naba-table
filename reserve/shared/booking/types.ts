import { BOOKING_TYPES_UI } from '@shared/config/booking';

export type BookingOption = (typeof BOOKING_TYPES_UI)[number];

export const BOOKING_OPTIONS: readonly BookingOption[] = BOOKING_TYPES_UI;

export function isBookingOption(
  value: string | null | undefined,
  options: readonly BookingOption[] = BOOKING_OPTIONS,
): value is BookingOption {
  if (!value) return false;
  return options.includes(value as BookingOption);
}
