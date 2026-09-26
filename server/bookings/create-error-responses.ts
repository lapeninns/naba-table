import { conflict, VALIDATION_FAILED_MESSAGE, type ApiErrorBody } from '@/lib/api/errors';
import { isIdempotencyKeyReusedResult } from '@/server/bookings/idempotency';

import type { BookingError } from '@/server/booking';
import type { NextResponse } from 'next/server';

export const BOOKING_CONFLICT_CODE = 'BOOKING_CONFLICT';
export const BOOKING_CONFLICT_MESSAGE = 'This time slot was just booked. Please try again.';
export const BOOKING_CONFLICT_RETRY_AFTER_SECONDS = 1;

export type BookingCommitConflict = 'idempotency_key_reused' | 'booking_conflict';

/**
 * The unified validation service keeps `code` collapsed (`BOOKING_CONFLICT` becomes
 * `CAPACITY_EXCEEDED`, unknown codes become `UNKNOWN`) but carries the create RPC's own code on
 * `rpcCode`, so the two non-capacity conflicts are recovered from it.
 */
export function detectBookingCommitConflict(
  issues: ReadonlyArray<Pick<BookingError, 'code' | 'rpcCode'>>,
): BookingCommitConflict | null {
  for (const issue of issues) {
    if (isIdempotencyKeyReusedResult({ error: issue.rpcCode })) {
      return 'idempotency_key_reused';
    }
    if (issue.rpcCode === BOOKING_CONFLICT_CODE) {
      return 'booking_conflict';
    }
  }
  return null;
}

/** Retryable 409 for a transient create race; clients retry once with the same key. */
export function buildBookingConflictRetryResponse(): NextResponse<ApiErrorBody> {
  const retryAfter = BOOKING_CONFLICT_RETRY_AFTER_SECONDS;
  return conflict(BOOKING_CONFLICT_CODE, BOOKING_CONFLICT_MESSAGE, {
    retryable: true,
    retryAfter,
    headers: { 'Retry-After': String(retryAfter), 'X-Conflict-Type': 'race_condition' },
  });
}

/**
 * Adds the C1 `error`/`code`/`message` fields to a unified validation failure body while
 * keeping its legacy `ok`/`issues`/`alternatives` fields for existing readers. Issue messages
 * are authored by the validation service, never database or provider text.
 */
export function withBookingValidationErrorFields<
  TBody extends { issues: ReadonlyArray<Pick<BookingError, 'code' | 'message'>> },
>(body: TBody): TBody & Pick<ApiErrorBody, 'error' | 'code' | 'message'> {
  const primary = body.issues[0];
  const message = primary?.message?.trim() || VALIDATION_FAILED_MESSAGE;
  const code = primary?.code ?? 'VALIDATION_FAILED';
  return { ...body, error: message, code, message };
}
