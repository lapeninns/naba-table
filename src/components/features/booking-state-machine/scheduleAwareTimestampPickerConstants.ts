import { DEFAULT_RESERVATION_INTERVAL_MINUTES } from '@reserve/shared/config/reservations';

export const DEFAULT_MINUTES_STEP = DEFAULT_RESERVATION_INTERVAL_MINUTES;
export const DEFAULT_TIMEZONE = 'UTC';
export const CLOSED_COPY = 'We’re closed on this date. Please choose a different day.';
export const NO_SLOTS_COPY =
  'All reservation times are taken on this date. Please choose a different day.';
export const UNKNOWN_COPY =
  'We couldn’t load availability right now. Please try again or choose another date.';
export const UNAVAILABLE_SELECTION_COPY =
  'Selected time is no longer available. Please choose another slot.';
export const OVERRIDE_SELECTION_COPY =
  'There are no regular slots for this date at this time, but you can still save changes to override availability.';
