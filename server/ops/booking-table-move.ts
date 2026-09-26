import { z } from 'zod';

import {
  isBookingNotFoundRpcError,
  isBookingStateConflictError,
  isIdempotencyKeyReusedError,
  isInvalidMoveRequestError,
  isTableSelectionInvalidError,
  isTablesUnavailableError,
  parseRpcErrorDetail,
  stateConflictDetailSchema,
  tableSelectionInvalidDetailSchema,
  tablesUnavailableDetailSchema,
  type BookingStatus,
} from '@/server/ops/booking-lifecycle/rpcErrors';

import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Atomic table move for a booking (`move_booking_tables`). One DB transaction releases the
 * "from" tables and assigns the "to" tables; the booking status never changes and no
 * notification side effect is triggered. Contract: mw/handoffs/S3a-contract.md section 4.
 */

type DbClient = SupabaseClient<Database>;

export type MoveAssignmentRow = {
  id: string;
  booking_id: string;
  table_id: string;
  assigned_at: string;
  assigned_by: string | null;
};

/** Mirrors the POST /assign-tables success body (DirectAssignmentResult). */
export type MoveBookingTablesSuccess = {
  success: true;
  assignments: MoveAssignmentRow[];
  booking: { id: string; status: BookingStatus; party_size: number };
  summary: { tableCount: number; totalCapacity: number; partySize: number; slack: number };
};

export type MoveBookingTablesOutcome = {
  body: MoveBookingTablesSuccess;
  replayed: boolean;
  bookingDate: string | null;
};

export type MoveBookingTablesFailure =
  | { kind: 'BOOKING_NOT_FOUND' }
  | { kind: 'INVALID_REQUEST' }
  | { kind: 'IDEMPOTENCY_KEY_REUSED' }
  | {
      kind: 'BOOKING_STATE_CONFLICT';
      currentStatus: BookingStatus | null;
      reason: 'STATUS' | 'ASSIGNMENTS_CHANGED' | 'DATE_LOCKED' | null;
    }
  | {
      kind: 'TABLES_UNAVAILABLE';
      reason: 'CONFLICT' | 'HOLD' | 'INACTIVE' | 'NOT_FOUND';
      tableIds: string[];
    }
  | {
      kind: 'TABLE_SELECTION_INVALID';
      reason: 'CAPACITY' | 'ZONE' | 'NOT_MOVABLE' | 'ADJACENCY' | 'WINDOW';
    };

export class MoveBookingTablesError extends Error {
  readonly failure: MoveBookingTablesFailure;

  constructor(failure: MoveBookingTablesFailure) {
    super(`move_booking_tables rejected: ${failure.kind}`);
    this.name = 'MoveBookingTablesError';
    this.failure = failure;
  }
}

const assignmentRowSchema = z.object({
  id: z.string(),
  booking_id: z.string(),
  table_id: z.string(),
  assigned_at: z.string(),
  assigned_by: z.string().nullable(),
});

/** Classifies an RPC error; returns null for anything unexpected (caller reports a 500). */
export function classifyMoveBookingTablesError(error: unknown): MoveBookingTablesFailure | null {
  if (isBookingStateConflictError(error)) {
    const detail = parseRpcErrorDetail(error, stateConflictDetailSchema);
    return {
      kind: 'BOOKING_STATE_CONFLICT',
      currentStatus: detail?.currentStatus ?? null,
      reason: detail?.reason ?? null,
    };
  }
  if (isTablesUnavailableError(error)) {
    const detail = parseRpcErrorDetail(error, tablesUnavailableDetailSchema);
    return {
      kind: 'TABLES_UNAVAILABLE',
      reason: detail?.reason ?? 'CONFLICT',
      tableIds: detail?.tableIds ?? [],
    };
  }
  if (isTableSelectionInvalidError(error)) {
    const detail = parseRpcErrorDetail(error, tableSelectionInvalidDetailSchema);
    return { kind: 'TABLE_SELECTION_INVALID', reason: detail?.reason ?? 'CAPACITY' };
  }
  if (isIdempotencyKeyReusedError(error)) return { kind: 'IDEMPOTENCY_KEY_REUSED' };
  if (isInvalidMoveRequestError(error)) return { kind: 'INVALID_REQUEST' };
  if (isBookingNotFoundRpcError(error)) return { kind: 'BOOKING_NOT_FOUND' };
  return null;
}

export async function moveBookingTables(input: {
  client: DbClient;
  bookingId: string;
  restaurantId: string;
  fromTableIds: string[];
  toTableIds: string[];
  idempotencyKey: string;
  movedBy: string | null;
}): Promise<MoveBookingTablesOutcome> {
  const { client, bookingId, restaurantId, fromTableIds, toTableIds, idempotencyKey, movedBy } =
    input;

  const { data, error } = await client.rpc('move_booking_tables', {
    p_booking_id: bookingId,
    p_restaurant_id: restaurantId,
    p_from_table_ids: fromTableIds,
    p_to_table_ids: toTableIds,
    p_idempotency_key: idempotencyKey,
    p_moved_by: movedBy,
  });

  if (error) {
    const failure = classifyMoveBookingTablesError(error);
    if (failure) {
      throw new MoveBookingTablesError(failure);
    }
    throw error;
  }

  const row = data?.[0];
  if (!row) {
    throw new Error('move_booking_tables returned no row');
  }

  const assignments = z.array(assignmentRowSchema).parse(row.assignments ?? []);
  const partySize = row.booking_party_size;
  const totalCapacity = row.total_capacity;

  return {
    replayed: row.replayed,
    bookingDate: row.booking_date ?? null,
    body: {
      success: true,
      assignments,
      booking: { id: bookingId, status: row.booking_status, party_size: partySize },
      summary: {
        tableCount: row.table_count,
        totalCapacity,
        partySize,
        slack: Math.max(0, totalCapacity - partySize),
      },
    },
  };
}
