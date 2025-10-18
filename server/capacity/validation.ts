import { DateTime } from "luxon";

import { getVenuePolicy, ServiceNotFoundError, ServiceOverrunError, whichService, type ServiceKey, type VenuePolicy } from "./policy";
import { __internal as tableInternals } from "./tables";

type ComputeBookingWindow = (args: {
  startISO?: string | null;
  bookingDate?: string | null;
  startTime?: string | null;
  partySize: number;
  policy: VenuePolicy;
  serviceHint?: ServiceKey | null;
}) => {
  service: ServiceKey;
  durationMinutes: number;
  dining: {
    start: DateTime;
    end: DateTime;
  };
  block: {
    start: DateTime;
    end: DateTime;
  };
};

const computeBookingWindow = tableInternals.computeBookingWindow as ComputeBookingWindow;

export type BookingValidationInput = {
  startISO?: string | null;
  bookingDate?: string | null;
  startTime?: string | null;
  partySize: number;
  dwellMinutes?: number | null;
  allowAfterHours?: boolean;
  serviceHint?: ServiceKey | null;
  timezone?: string | null;
  policyOverride?: VenuePolicy;
};

export type BookingValidationResult = {
  ok: boolean;
  reasons: string[];
  service?: ServiceKey;
  dining?: {
    start: string;
    end: string;
  };
  block?: {
    start: string;
    end: string;
  };
  expectedDiningMinutes?: number;
};

function ensureIso(dateTime: DateTime | null | undefined): string | null {
  if (!dateTime || !dateTime.isValid) {
    return null;
  }
  return dateTime.toISO();
}

export function validateBookingWindow(input: BookingValidationInput): BookingValidationResult {
  const {
    startISO,
    bookingDate,
    startTime,
    partySize,
    dwellMinutes,
    allowAfterHours = false,
    serviceHint,
    timezone,
    policyOverride,
  } = input;

  const reasons: string[] = [];

  if (!Number.isFinite(partySize) || partySize <= 0) {
    reasons.push("party_size_must_be_positive");
  }

  const policy = policyOverride ?? getVenuePolicy({ timezone });

  let window: ReturnType<typeof computeBookingWindow> | null = null;

  try {
    window = computeBookingWindow({
      startISO,
      bookingDate,
      startTime,
      partySize,
      policy,
      serviceHint: serviceHint ?? null,
    });
  } catch (error) {
    if (error instanceof ServiceNotFoundError) {
      if (!allowAfterHours) {
        reasons.push("outside_service_hours");
      }
    } else if (error instanceof ServiceOverrunError) {
      if (!allowAfterHours) {
        reasons.push("booking_exceeds_service_end");
      }
    } else {
      reasons.push("unable_to_compute_window");
    }
  }

  if (!window) {
    return {
      ok: reasons.length === 0,
      reasons,
    };
  }

  const service = window.service ?? whichService(window.dining.start, policy);
  if (dwellMinutes) {
    const minimumDining = window.dining.end.diff(window.dining.start, "minutes").minutes;
    if (dwellMinutes < minimumDining) {
      reasons.push("dwell_below_minimum");
    }
  }

  return {
    ok: reasons.length === 0,
    reasons,
    service,
    dining: {
      start: ensureIso(window.dining.start)!,
      end: ensureIso(window.dining.end)!,
    },
    block: {
      start: ensureIso(window.block.start)!,
      end: ensureIso(window.block.end)!,
    },
    expectedDiningMinutes: window.dining.end.diff(window.dining.start, "minutes").minutes,
  };
}
