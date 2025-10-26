/**
 * Past Time Booking Validation
 * 
 * Prevents creation or modification of bookings with start times in the past.
 * Includes configurable grace period and admin override capability.
 * 
 * @see tasks/prevent-past-bookings-20251015-1323/plan.md
 */

import { RESTAURANT_ADMIN_ROLES } from "@/lib/owner/auth/roles";

import type { RestaurantRole } from "@/lib/owner/auth/roles";

/**
 * Error thrown when a booking time is in the past
 */
export class PastBookingError extends Error {
  readonly code = "BOOKING_IN_PAST" as const;
  
  constructor(
    message: string,
    public readonly details: {
      bookingTime: string;
      serverTime: string;
      timezone: string;
      gracePeriodMinutes: number;
      timeDeltaMinutes: number;
    }
  ) {
    super(message);
    this.name = "PastBookingError";
    Object.setPrototypeOf(this, PastBookingError.prototype);
  }
}

/**
 * Options for past time validation
 */
export type PastTimeValidationOptions = {
  /** Grace period in minutes (default: 5) - accounts for latency/clock skew */
  graceMinutes?: number;
  /** Whether to allow override (requires admin role) */
  allowOverride?: boolean;
  /** Actor's role for permission check */
  actorRole?: RestaurantRole | null;
};

/**
 * Gets current date/time in a specific timezone
 * 
 * @param timezone - IANA timezone string (e.g., "America/Los_Angeles")
 * @returns Date object representing "now" in that timezone
 */
function zonedDateTimeToUtc(timezone: string, isoLocal: string): Date {
  const date = new Date(isoLocal);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date value for timezone conversion: ${isoLocal}`);
  }

  let sameInstantInZone: Date;
  try {
    const localized = date.toLocaleString("en-US", { timeZone: timezone });
    sameInstantInZone = new Date(localized);
  } catch (error) {
    throw new Error(`Failed to resolve timezone "${timezone}"`, { cause: error });
  }

  if (Number.isNaN(sameInstantInZone.getTime())) {
    throw new Error(`Invalid localized date for timezone "${timezone}" derived from "${isoLocal}"`);
  }

  const diff = date.getTime() - sameInstantInZone.getTime();
  return new Date(date.getTime() + diff);
}

export function getCurrentTimeInTimezone(timezone: string): Date {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(new Date());
  const lookup = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";

  const isoLocal = `${lookup("year")}-${lookup("month")}-${lookup("day")}T${lookup("hour")}:${lookup("minute")}:${lookup("second")}`;
  return zonedDateTimeToUtc(timezone, isoLocal);
}

/**
 * Converts booking date/time components to Date object
 * 
 * @param bookingDate - Date string in YYYY-MM-DD format
 * @param startTime - Time string in HH:MM format
 * @returns Date object representing the booking time
 */
function parseBookingTime(timezone: string, bookingDate: string, startTime: string): Date {
  const segments = startTime.split(":");

  if (segments.length < 2) {
    throw new Error(`Invalid start time format: ${startTime}`);
  }

  const [rawHour, rawMinute, rawSecond = "00"] = segments;

  const hour = rawHour.padStart(2, "0");
  const minute = rawMinute.padStart(2, "0");
  const second = rawSecond.padStart(2, "0");

  const isoLocal = `${bookingDate}T${hour}:${minute}:${second}`;
  return zonedDateTimeToUtc(timezone, isoLocal);
}

/**
 * Formats a Date object to ISO string for display
 * 
 * @param date - Date to format
 * @param timezone - IANA timezone for display
 * @returns ISO-like string with timezone info
 */
function formatDateTimeForDisplay(date: Date, timezone: string): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value ?? "0000";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  const hour = parts.find((p) => p.type === "hour")?.value ?? "00";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "00";
  const second = parts.find((p) => p.type === "second")?.value ?? "00";

  // Get timezone offset for display
  const offsetFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    timeZoneName: "short",
  });
  const timezoneName = offsetFormatter.formatToParts(date).find((p) => p.type === "timeZoneName")?.value ?? timezone;

  return `${year}-${month}-${day}T${hour}:${minute}:${second} ${timezoneName}`;
}

/**
 * Checks if a user role has permission to override past booking restrictions
 * 
 * @param role - User's restaurant role
 * @returns true if role can override (owner or manager)
 */
export function canOverridePastBooking(role: RestaurantRole | null | undefined): boolean {
  if (!role) return false;
  return RESTAURANT_ADMIN_ROLES.includes(role as any);
}

/**
 * Validates that a booking time is not in the past
 * 
 * Throws PastBookingError if booking time is before (server time - grace period)
 * when evaluated in the restaurant's local timezone.
 * 
 * Grace period (default 5 minutes) accounts for:
 * - Network latency (1-2 seconds typical)
 * - Client clock skew (can be ±1-2 minutes)
 * - Request processing time (<1 second)
 * - Safety margin
 * 
 * @param restaurantTimezone - IANA timezone string (e.g., "America/New_York")
 * @param bookingDate - Booking date in YYYY-MM-DD format
 * @param startTime - Booking start time in HH:MM format
 * @param options - Validation options (grace period, override)
 * @throws {PastBookingError} If booking is in the past and override not allowed
 * @throws {Error} If timezone is invalid or date parsing fails
 */
export function assertBookingNotInPast(
  restaurantTimezone: string,
  bookingDate: string,
  startTime: string,
  options: PastTimeValidationOptions = {}
): void {
  const graceMinutes = options.graceMinutes ?? 5;
  const allowOverride = options.allowOverride ?? false;

  // Validate inputs
  if (!restaurantTimezone) {
    throw new Error("Restaurant timezone is required for validation");
  }

  if (!bookingDate || !/^\d{4}-\d{2}-\d{2}$/.test(bookingDate)) {
    throw new Error(`Invalid booking date format: ${bookingDate}`);
  }

  if (!startTime || !/^\d{2}:\d{2}(?::\d{2})?$/.test(startTime)) {
    throw new Error(`Invalid start time format: ${startTime}`);
  }

  try {
    // Get current time in restaurant's timezone
    const serverTime = getCurrentTimeInTimezone(restaurantTimezone);

    // Parse booking time (in same "local" context)
    const bookingTime = parseBookingTime(restaurantTimezone, bookingDate, startTime);

    // Calculate time difference in minutes
    // Positive = future, Negative = past
    const timeDeltaMs = bookingTime.getTime() - serverTime.getTime();
    const timeDeltaMinutes = timeDeltaMs / (1000 * 60);

    // Check if booking is in the past (accounting for grace period)
    const isPast = timeDeltaMinutes < -graceMinutes;

    if (isPast) {
      // Check if override is allowed
      if (allowOverride && canOverridePastBooking(options.actorRole)) {
        // Admin override - log and allow
        return;
      }

      // Booking is in the past - throw error
      throw new PastBookingError(
        `Booking time is in the past. Please select a future date and time.`,
        {
          bookingTime: formatDateTimeForDisplay(bookingTime, restaurantTimezone),
          serverTime: formatDateTimeForDisplay(serverTime, restaurantTimezone),
          timezone: restaurantTimezone,
          gracePeriodMinutes: graceMinutes,
          timeDeltaMinutes: Math.round(timeDeltaMinutes),
        }
      );
    }
  } catch (error) {
    // Re-throw PastBookingError as-is
    if (error instanceof PastBookingError) {
      throw error;
    }

    // Wrap other errors (e.g., invalid timezone)
    throw new Error(
      `Failed to validate booking time: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
