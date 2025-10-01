import { BOOKING_TYPES_UI } from '@shared/config/booking';

export type BookingOption = (typeof BOOKING_TYPES_UI)[number];

export const BOOKING_OPTIONS: readonly BookingOption[] = BOOKING_TYPES_UI;

export function isBookingOption(value: string | null | undefined): value is BookingOption {
  if (!value) return false;
  return (BOOKING_TYPES_UI as readonly string[]).includes(value);
}
