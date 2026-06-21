import type { BookingError, BookingValidationResponse } from '@/server/booking';

export function getPrimaryValidationIssue(
  response: BookingValidationResponse,
): BookingError | null {
  return response.issues[0] ?? null;
}
