import { BOOKING_TYPES_UI } from '@shared/config/booking';

import type { OccasionKey } from '@reserve/shared/occasions';

export type BookingOption = OccasionKey;

export const BOOKING_OPTIONS: readonly BookingOption[] =
  BOOKING_TYPES_UI as readonly BookingOption[];

export function isBookingOption(
  value: string | null | undefined,
  options: readonly BookingOption[] = BOOKING_OPTIONS,
): value is BookingOption {
  if (!value) return false;
  return options.includes(value as BookingOption);
}
