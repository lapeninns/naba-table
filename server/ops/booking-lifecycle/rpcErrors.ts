import { z } from 'zod';

import type { Tables } from '@/types/supabase';

/**
 * Classifies errors raised by the booking lifecycle / table-move RPCs.
 *
 * The RPCs raise a machine-readable MESSAGE (for example `booking_state_conflict`) with a
 * SQLSTATE, and some add a JSON DETAIL with safe structured fields. PostgREST forwards them
 * as `{ code, message, details }`. Nothing here returns DB text to a caller; routes map the
 * classification to C1 codes.
 */

export type BookingStatus = Tables<'bookings'>['status'];

type RpcErrorLike = { code?: unknown; message?: unknown; details?: unknown };

function asRpcError(error: unknown): RpcErrorLike | null {
  return error && typeof error === 'object' ? (error as RpcErrorLike) : null;
}

function matches(error: unknown, code: string, message?: string): boolean {
  const record = asRpcError(error);
  if (!record || record.code !== code) return false;
  return message === undefined || record.message === message;
}

/** apply_booking_state_transition / move_booking_tables compare-and-set lost (P0004). */
export function isBookingStateConflictError(error: unknown): boolean {
  return matches(error, 'P0004', 'booking_state_conflict');
}

/** cancel_booking_and_release_table_state rejected a checked_in/completed/no_show booking. */
export function isBookingNotCancellableRpcError(error: unknown): boolean {
  return matches(error, 'P0004', 'booking_not_cancellable');
}

/** Any "booking not found" raise (P0002) other than the undo history lookup. */
export function isBookingNotFoundRpcError(error: unknown): boolean {
  return matches(error, 'P0002') && !isNoShowHistoryMissingError(error);
}

export function isNoShowHistoryMissingError(error: unknown): boolean {
  return matches(error, 'P0002', 'no_show_history_missing');
}

export function isTablesUnavailableError(error: unknown): boolean {
  return matches(error, 'P0001', 'tables_unavailable');
}

export function isTableSelectionInvalidError(error: unknown): boolean {
  return matches(error, 'P0001', 'table_selection_invalid');
}

export function isIdempotencyKeyReusedError(error: unknown): boolean {
  return matches(error, 'P0003', 'idempotency_key_reused');
}

export function isInvalidMoveRequestError(error: unknown): boolean {
  return matches(error, '22023', 'invalid_move_request');
}

const BOOKING_STATUSES = [
  'pending',
  'pending_allocation',
  'confirmed',
  'PRIORITY_WAITLIST',
  'checked_in',
  'completed',
  'cancelled',
  'no_show',
] as const satisfies readonly BookingStatus[];

const statusSchema = z.enum(BOOKING_STATUSES);
const uuidListSchema = z.array(z.string().uuid()).max(100);

export const stateConflictDetailSchema = z.object({
  currentStatus: statusSchema.optional(),
  reason: z.enum(['STATUS', 'ASSIGNMENTS_CHANGED', 'DATE_LOCKED']).optional(),
});

export const tablesUnavailableDetailSchema = z.object({
  reason: z.enum(['CONFLICT', 'HOLD', 'INACTIVE', 'NOT_FOUND']),
  tableIds: uuidListSchema.optional(),
});

export const tableSelectionInvalidDetailSchema = z.object({
  reason: z.enum(['CAPACITY', 'ZONE', 'NOT_MOVABLE', 'ADJACENCY', 'WINDOW']),
});

/**
 * Parses the JSON DETAIL of an RPC raise against a schema. Returns null for anything that is
 * not JSON or does not match, so unexpected DB text can never reach a response.
 */
export function parseRpcErrorDetail<T>(error: unknown, schema: z.ZodType<T>): T | null {
  const details = asRpcError(error)?.details;
  if (typeof details !== 'string' || details.length === 0 || details.length > 2_000) return null;
  try {
    const parsed = schema.safeParse(JSON.parse(details));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function isBookingStatus(value: unknown): value is BookingStatus {
  return statusSchema.safeParse(value).success;
}
