import { sanitizeCorrelationId } from '@/lib/observability/request-correlation';

import type { BookingCreateAttemptContext } from '@/server/bookings/create-failure-response';

export const BOOKING_ATTEMPT_ID_HEADER = 'x-booking-attempt-id';
export const BOOKING_ATTEMPT_NUMBER_HEADER = 'x-booking-attempt';

const MAX_ATTEMPT_NUMBER = 100;

/**
 * Extracts the privacy-safe client attempt correlation headers sent by the
 * booking wizard. The attempt id is a client-generated random UUID that stays
 * stable across retries of one logical submission; the attempt number
 * distinguishes retries from independent failures. Both are sanitized and
 * bounded before use.
 */
export function parseBookingAttemptHeaders(
  headers: Pick<Headers, 'get'>,
): BookingCreateAttemptContext {
  const attemptId = sanitizeCorrelationId(headers.get(BOOKING_ATTEMPT_ID_HEADER));

  const rawAttemptNumber = headers.get(BOOKING_ATTEMPT_NUMBER_HEADER);
  const parsedAttemptNumber = rawAttemptNumber ? Number.parseInt(rawAttemptNumber, 10) : Number.NaN;
  const attemptNumber =
    Number.isInteger(parsedAttemptNumber) &&
    parsedAttemptNumber >= 1 &&
    parsedAttemptNumber <= MAX_ATTEMPT_NUMBER
      ? parsedAttemptNumber
      : null;

  return { attemptId, attemptNumber };
}
