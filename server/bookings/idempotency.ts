import { createHash } from 'crypto';
import { DateTime } from 'luxon';

import { conflict, type ApiErrorBody } from '@/lib/api/errors';

import type { Json } from '@/types/supabase';
import type { NextResponse } from 'next/server';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Creator replay window from the guest-auth design (§4.2 key-match rule). */
export const CREATOR_KEY_REPLAY_WINDOW_MS = 15 * 60_000;

export const IDEMPOTENCY_KEY_REUSED_CODE = 'IDEMPOTENCY_KEY_REUSED';
export const IDEMPOTENCY_KEY_REUSED_MESSAGE =
  'This booking request was already used with different details. Start a new booking to continue.';

/**
 * How a create request resolved its booking:
 * - `inserted`: this request inserted the row;
 * - `key_replay`: the row carries this request's own `Idempotency-Key`;
 * - `recovered`: an existing row matched by the deterministic key or the slot signature.
 */
export type BookingCreateOrigin = 'inserted' | 'key_replay' | 'recovered';

type IdempotentBookingShape = {
  booking_date?: string | null;
  start_time?: string | null;
  party_size?: number | null;
  customer_id?: string | null;
  customer_email?: string | null;
  idempotency_key?: string | null;
  created_at?: string | null;
};

export function normalizeIdempotencyKey(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function coerceUuid(value: string | null): string | null {
  if (!value) return null;
  return UUID_REGEX.test(value) ? value : null;
}

/**
 * Server-derived key for clients that send no `Idempotency-Key`. It covers every field the
 * create RPC compares on replay (customer, date, start, party size), so a key-less guest who
 * changes the party size makes a new request, never a 409 about a key they did not send.
 */
export function buildDeterministicIdempotencyKey(params: {
  restaurantId: string;
  customerId: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  partySize: number;
}): string {
  const payload = `${params.restaurantId}|${params.customerId}|${params.bookingDate}|${params.startTime}|${params.endTime}|${params.partySize}`;
  return createHash('sha256').update(payload).digest('hex').slice(0, 32);
}

/**
 * `p_details` marker for a server-derived key. The create RPC strips it before storing and,
 * for a derived key only, releases the key of a cancelled or no-show booking instead of
 * replaying it, so a derived key never claims a finished slot.
 */
export const DERIVED_IDEMPOTENCY_KEY_DETAILS = { idempotency_key_kind: 'derived' } as const;

export function withIdempotencyKeyKind(
  details: Json | null,
  headerIdempotencyKey: string | null,
): Json | null {
  if (headerIdempotencyKey) return details;
  const base = details && typeof details === 'object' && !Array.isArray(details) ? details : {};
  return { ...base, ...DERIVED_IDEMPOTENCY_KEY_DETAILS };
}

/** Observability-safe key reference: raw idempotency keys never leave the request. */
export function hashIdempotencyKey(key: string | null | undefined): string | undefined {
  if (!key) return undefined;
  return createHash('sha256').update(key).digest('hex').slice(0, 12);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * The create RPC reports a key reused with a different payload as
 * `error: 'IDEMPOTENCY_KEY_REUSED'` plus `details.idempotencyConflict = true`. The unified
 * validation path maps unknown RPC codes away, so the details marker is checked too.
 */
export function isIdempotencyKeyReusedResult(result: {
  error?: string | null;
  details?: unknown;
}): boolean {
  if (result.error === IDEMPOTENCY_KEY_REUSED_CODE) return true;
  return isRecord(result.details) && result.details.idempotencyConflict === true;
}

export function buildIdempotencyKeyReusedResponse(): NextResponse<ApiErrorBody> {
  return conflict(IDEMPOTENCY_KEY_REUSED_CODE, IDEMPOTENCY_KEY_REUSED_MESSAGE, {
    retryable: false,
  });
}

function toMinute(time: string | null | undefined): string {
  return (time ?? '').trim().slice(0, 5);
}

function normalizeContactEmail(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

/**
 * Whether an existing keyed booking was created from the same salient payload. Mirrors the
 * RPC's comparison (customer, date, start minute, party size); the email check applies only
 * when both sides carry one, for lookups that run before the customer is resolved.
 */
export function matchesIdempotentCreatePayload(
  booking: IdempotentBookingShape,
  payload: {
    bookingDate: string;
    startTime: string;
    partySize: number;
    customerId?: string | null;
    customerEmail?: string | null;
  },
): boolean {
  if (booking.booking_date !== payload.bookingDate) return false;
  if (toMinute(booking.start_time) !== toMinute(payload.startTime)) return false;
  if (booking.party_size !== payload.partySize) return false;
  if (payload.customerId && booking.customer_id !== payload.customerId) return false;

  const requestedEmail = normalizeContactEmail(payload.customerEmail);
  const storedEmail = normalizeContactEmail(booking.customer_email);
  if (requestedEmail && storedEmail && requestedEmail !== storedEmail) return false;

  return true;
}

export function resolveBookingCreateOrigin({
  booking,
  duplicate,
  headerIdempotencyKey,
  recovered,
}: {
  booking: IdempotentBookingShape;
  duplicate: boolean;
  headerIdempotencyKey: string | null;
  recovered: boolean;
}): BookingCreateOrigin {
  if (!duplicate && !recovered) return 'inserted';
  return headerIdempotencyKey !== null && booking.idempotency_key === headerIdempotencyKey
    ? 'key_replay'
    : 'recovered';
}

/**
 * Guest-auth design §4.2 key-match rule: a non-inserted create may still act as the creator
 * only when it replays the client's own uuid key within the replay window. Deterministic
 * fallback keys are 32 hex chars, never uuids.
 */
export function isCreatorKeyReplayEligible({
  booking,
  headerIdempotencyKey,
  now = Date.now(),
}: {
  booking: IdempotentBookingShape;
  headerIdempotencyKey: string | null;
  now?: number;
}): boolean {
  if (!headerIdempotencyKey || !coerceUuid(headerIdempotencyKey)) return false;
  if (booking.idempotency_key !== headerIdempotencyKey) return false;
  if (!booking.created_at) return false;
  const createdAt = DateTime.fromISO(booking.created_at, { setZone: true });
  return createdAt.isValid && createdAt.toMillis() >= now - CREATOR_KEY_REPLAY_WINDOW_MS;
}
