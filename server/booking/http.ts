import type { BookingError, BookingErrorCode, BookingValidationResponse } from "./types";

const ERROR_STATUS: Partial<Record<BookingErrorCode, number>> = {
  CAPACITY_EXCEEDED: 409,
  MISSING_OVERRIDE: 403,
};

function statusFromIssues(issues: BookingError[]): number {
  const primary = issues[0];
  if (!primary) {
    return 400;
  }
  return ERROR_STATUS[primary.code] ?? 400;
}

export function mapValidationFailure(
  response: BookingValidationResponse & { ok: false },
): { status: number; body: BookingValidationResponse } {
  return {
    status: statusFromIssues(response.issues),
    body: response,
  };
}

export function withValidationHeaders<T extends Record<string, unknown> & { headers?: Record<string, string> }>(
  responseInit: T,
): T {
  return {
    ...responseInit,
    headers: {
      ...(responseInit.headers ?? {}),
      "X-Booking-Validation": "unified",
    },
  };
}
