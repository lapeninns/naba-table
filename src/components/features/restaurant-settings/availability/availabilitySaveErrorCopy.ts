/** Save-step names shown in the save bar ("Saving 1 of 2: …", "… not saved."). */
export const AVAILABILITY_CATALOG_STEP_NAME = 'Booking types';
export const AVAILABILITY_CATALOG_REMOVAL_STEP_NAME = 'Removed booking types';

/** Shown to restaurant staff who are not Nabatable platform admins. */
export const BOOKING_TYPES_MANAGED_NOTE = 'Booking types are managed by Nabatable.';

/**
 * Staff-facing copy for Availability save failures, keyed by the API error code (never by the
 * server message). Codes without an entry fall back to the save bar's generic text; a stale write
 * (`CONFLICT`) already has its own save-bar message.
 */
const SAVE_FAILURE_COPY: ReadonlyMap<string, string> = new Map([
  [
    'PLATFORM_ADMIN_REQUIRED',
    `${BOOKING_TYPES_MANAGED_NOTE} Only Nabatable can add, change or remove them. Undo your booking-type edits to save the rest of this page.`,
  ],
  [
    'OCCASION_ALREADY_EXISTS',
    'A booking type with this key already exists. Open the new booking type and choose a different key under Advanced.',
  ],
  [
    'OCCASION_IN_USE',
    'A booking type you removed is still used by upcoming bookings or meal times, so it can’t be removed. Turn it off instead.',
  ],
  [
    'OCCASION_BUILTIN',
    'Lunch and Dinner are built in and can’t be removed. Turn them off instead.',
  ],
  [
    'OCCASION_NOT_FOUND',
    'A booking type you edited no longer exists. Reload the page to see the current list.',
  ],
  [
    'SERVICE_PERIOD_OUTSIDE_HOURS',
    'A meal time falls outside that day’s opening hours. Adjust the meal time or the hours, then save again.',
  ],
  [
    'UNKNOWN_BOOKING_TYPE',
    'A meal time or table time uses a booking type that no longer exists. Reload the page, then save again.',
  ],
  [
    'INVALID_AVAILABILITY',
    'Some settings were not accepted. Check the highlighted sections, then save again.',
  ],
  [
    'VALIDATION_FAILED',
    'Some settings were not accepted. Check the highlighted sections, then save again.',
  ],
]);

export function describeAvailabilitySaveFailure(
  reasonCode: string | null | undefined,
): string | null {
  if (!reasonCode) {
    return null;
  }
  return SAVE_FAILURE_COPY.get(reasonCode) ?? null;
}
