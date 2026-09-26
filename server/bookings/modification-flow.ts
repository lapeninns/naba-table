import { randomUUID } from 'crypto';
import { after } from 'next/server';

import { conflict, type ApiErrorBody } from '@/lib/api/errors';
import { logger } from '@/lib/logger';
import { CancellableAutoAssign } from '@/server/booking/auto-assign/cancellable-auto-assign';
import { BookingValidationError } from '@/server/booking/BookingValidationService';
import {
  updateBookingAndClearAssignmentsAtomically,
  type BookingRecord,
  type UpdateBookingPayload,
} from '@/server/bookings';
import { withBookingReadOverlay } from '@/server/bookings/modification-quote-client';
import { buildInlineLastResult } from '@/server/capacity/auto-assign-last-result';
import { releaseTableHold } from '@/server/capacity/holds';
import { quoteTablesForBooking } from '@/server/capacity/tables';
import {
  sendBookingModificationConfirmedEmail,
  sendBookingModificationPendingEmail,
} from '@/server/emails/bookings';
import {
  bookingEmailIntentKey,
  ensureBookingEmailIntent,
} from '@/server/jobs/booking-side-effect-intents';
import { recordObservabilityEvent } from '@/server/observability';
import { getInlineAutoAssignTimeoutMs, isEmailQueueEnabled } from '@/server/runtime-policy';

import type { EmailJobType } from '@/server/queue/email-contract';
import type { Database, Json, Tables } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { NextResponse } from 'next/server';

type DbClient = SupabaseClient<Database, 'public'>;

export type ModificationFlowSource = 'guest' | 'ops';

type BeginFlowParams = {
  client: DbClient;
  bookingId: string;
  payload: UpdateBookingPayload;
  existingBooking: Tables<'bookings'>;
  source: ModificationFlowSource;
};

const SUPPRESS_EMAILS =
  process.env.LOAD_TEST_DISABLE_EMAILS === 'true' || process.env.SUPPRESS_EMAILS === 'true';

/** Statuses whose booking has no table to protect: a failed search may still apply the change. */
const AWAITING_ALLOCATION_STATUSES = new Set(['pending', 'pending_allocation']);

const PLANNER_STRATEGY = { requireAdjacency: null, maxTables: null };
const PLANNER_TRIGGER = 'inline_modification';

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export type BookingModificationConflictCode =
  | 'MODIFICATION_NO_TABLES'
  | 'MODIFICATION_TABLES_UNCONFIRMED'
  | 'BOOKING_STATE_CONFLICT';

const CONFLICT_COPY: Record<BookingModificationConflictCode, string> = {
  MODIFICATION_NO_TABLES:
    'There is no table available for that change. The booking has not been changed.',
  MODIFICATION_TABLES_UNCONFIRMED:
    'We could not confirm a table for that change. The booking has not been changed. Please try again.',
  BOOKING_STATE_CONFLICT:
    'This booking changed while it was being edited. The booking has not been changed. Refresh and try again.',
};

/**
 * The modification was refused and the booking is exactly as it was: same date,
 * time, party size, status and tables. Always a 409.
 *
 * It extends BookingValidationError (issue code CAPACITY_EXCEEDED), so routes that
 * already map BookingValidationError through mapValidationFailure answer 409
 * without changes. Routes that want the C1 body use
 * bookingModificationConflictResponse().
 */
export class BookingModificationConflictError extends BookingValidationError {
  readonly status = 409 as const;
  readonly code: BookingModificationConflictCode;
  readonly retryable: boolean;
  readonly reason: string | null;

  constructor(code: BookingModificationConflictCode, options: { reason?: string | null } = {}) {
    const message = CONFLICT_COPY[code];
    super({
      ok: false,
      issues: [
        {
          code: 'CAPACITY_EXCEEDED',
          message,
          severity: 'error',
          overridable: false,
          detail: { modificationCode: code },
        },
      ],
    });
    this.name = 'BookingModificationConflictError';
    this.code = code;
    this.retryable = code !== 'MODIFICATION_NO_TABLES';
    this.reason = options.reason ?? null;
  }
}

export function isBookingModificationConflictError(
  error: unknown,
): error is BookingModificationConflictError {
  return error instanceof BookingModificationConflictError;
}

/** C1 409 response for a refused modification (no DB or planner text). */
export function bookingModificationConflictResponse(
  error: BookingModificationConflictError,
): NextResponse<ApiErrorBody> {
  return conflict(error.code, CONFLICT_COPY[error.code], { retryable: error.retryable });
}

// ---------------------------------------------------------------------------
// Table selection for the proposed window
// ---------------------------------------------------------------------------

type QuoteOutcome =
  | {
      ok: true;
      holdId: string;
      requireAdjacency: boolean;
      durationMs: number;
      alternates: number;
    }
  | { ok: false; reason: string; durationMs: number; alternates: number };

function holdRequiresAdjacency(metadata: Json | null | undefined): boolean {
  if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
    return metadata.requireAdjacency === true;
  }
  return false;
}

/**
 * Quotes (and holds) tables for the booking AS IT WOULD BE after the change. The
 * booking row is not touched: the planner reads it through an overlay carrying the
 * proposed values. The hold is bound to the booking, and hold admission ignores the
 * booking's own current assignments, so it may keep a table it already has.
 */
async function quoteTablesForProposedWindow(params: {
  client: DbClient;
  bookingId: string;
  payload: UpdateBookingPayload;
  timeoutMs: number;
}): Promise<QuoteOutcome> {
  const timeoutMs = Math.max(500, params.timeoutMs);
  const start = Date.now();
  const autoAssign = new CancellableAutoAssign(timeoutMs);
  const overlay: Record<string, unknown> = { ...params.payload };
  delete overlay.status;
  const plannerClient = withBookingReadOverlay(params.client, params.bookingId, overlay);

  try {
    const quote = await autoAssign.runWithTimeout((signal) =>
      quoteTablesForBooking({
        bookingId: params.bookingId,
        // No staff actor for system modifications; the hold stores NULL.
        createdBy: undefined as unknown as string,
        holdTtlSeconds: 180,
        client: plannerClient,
        signal,
      }),
    );
    const durationMs = Date.now() - start;
    const alternates = quote.alternates?.length ?? 0;
    if (!quote.hold) {
      return {
        ok: false,
        reason: durationMs >= timeoutMs ? 'INLINE_TIMEOUT' : (quote.reason ?? 'NO_HOLD'),
        durationMs,
        alternates,
      };
    }
    return {
      ok: true,
      holdId: quote.hold.id,
      requireAdjacency: holdRequiresAdjacency(quote.hold.metadata),
      durationMs,
      alternates,
    };
  } catch (error) {
    const durationMs = Date.now() - start;
    if (error instanceof Error && error.name === 'AbortError') {
      return { ok: false, reason: 'INLINE_TIMEOUT', durationMs, alternates: 0 };
    }
    logger.error('[booking.modification] table selection failed', {
      bookingId: params.bookingId,
      errorName: error instanceof Error ? error.name : 'UnknownError',
    });
    return { ok: false, reason: 'INLINE_ERROR', durationMs, alternates: 0 };
  }
}

// ---------------------------------------------------------------------------
// Swap
// ---------------------------------------------------------------------------

type SwapRpcClient = {
  rpc: (
    fn: 'modify_booking_with_table_swap',
    args: Database['public']['Functions']['modify_booking_with_table_swap']['Args'],
  ) => PromiseLike<{ data: unknown; error: { code?: string | null } | null }>;
};

/** SQLSTATEs that mean "the held tables could not be confirmed right now". */
const RETRYABLE_SWAP_CODES = new Set([
  'P0001', // hold not bound / expired / assignment conflict raised by the assignment RPCs
  'P0002', // hold (or booking) disappeared, e.g. swept after expiry
  'P0003', // policy or adjacency drift, idempotency mismatch
  '23514', // inactive / out-of-service table, zone rules
  '23P01', // overlapping hold or allocation
  '40001', // serialization failure
  '40P01', // deadlock
  '55P03', // lock not available
]);

function sqlStateOf(error: unknown): string | null {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' ? code : null;
  }
  return null;
}

async function releaseHoldQuietly(client: DbClient, holdId: string, bookingId: string) {
  try {
    await releaseTableHold({ holdId, client });
  } catch (error) {
    // The hold expires on its own (180 s TTL); this only frees the tables sooner.
    logger.warn('[booking.modification] failed to release unused hold', {
      bookingId,
      holdId,
      errorName: error instanceof Error ? error.name : 'UnknownError',
    });
  }
}

// ---------------------------------------------------------------------------
// Durable follow-up work
// ---------------------------------------------------------------------------

async function queueModificationEmail(params: {
  client: DbClient;
  booking: BookingRecord;
  type: Extract<EmailJobType, 'updated' | 'request_received'>;
  discriminator: string;
}): Promise<void> {
  const { booking } = params;
  if (SUPPRESS_EMAILS || !booking.customer_email?.trim() || !booking.restaurant_id) {
    return;
  }

  if (!isEmailQueueEnabled()) {
    // Local/dev only: there is no durable queue to hand the email to.
    try {
      if (params.type === 'updated') {
        await sendBookingModificationConfirmedEmail(booking);
      } else {
        await sendBookingModificationPendingEmail(booking);
      }
    } catch (error) {
      logger.error('[booking.modification] inline email failed', {
        bookingId: booking.id,
        emailType: params.type,
        errorName: error instanceof Error ? error.name : 'UnknownError',
      });
    }
    return;
  }

  // One email per committed modification: the key carries the hold (swap) or
  // attempt id, and the intent is insert-if-absent, so retries never resend.
  const ensured = await ensureBookingEmailIntent(params.client, {
    bookingId: booking.id,
    restaurantId: booking.restaurant_id,
    type: params.type,
    dedupeKey: bookingEmailIntentKey(params.type, booking.id, params.discriminator),
  });
  if (!ensured.ok) {
    logger.error('[booking.modification] email could not be queued', {
      bookingId: booking.id,
      emailType: params.type,
      errorCode: ensured.errorCode,
    });
  }
}

function scheduleAutoAssignAfterResponse(bookingId: string): void {
  try {
    // next/server after() keeps the serverless invocation alive until the work
    // finishes (waitUntil), unlike a dangling promise.
    after(async () => {
      try {
        const { autoAssignAndConfirmIfPossible } = await import('@/server/jobs/auto-assign');
        await autoAssignAndConfirmIfPossible(bookingId, {
          forceRun: true,
          reason: 'modification',
          emailVariant: 'modified',
        });
      } catch (error) {
        logger.error('[booking.modification] background auto-assign failed', {
          bookingId,
          errorName: error instanceof Error ? error.name : 'UnknownError',
        });
      }
    });
  } catch (error) {
    // after() is unavailable outside a request scope (scripts, tests). The booking
    // stays pending and visible to staff for allocation.
    logger.warn('[booking.modification] auto-assign could not be scheduled', {
      bookingId,
      errorName: error instanceof Error ? error.name : 'UnknownError',
    });
  }
}

async function recordModificationEvent(
  eventType: string,
  params: { restaurantId: string; bookingId: string; context: { [key: string]: Json | undefined } },
): Promise<void> {
  try {
    await recordObservabilityEvent({
      source: 'booking.modification',
      eventType,
      severity: eventType.endsWith('.rejected') ? 'warning' : 'info',
      restaurantId: params.restaurantId,
      bookingId: params.bookingId,
      context: params.context,
    });
  } catch {
    // Telemetry is best-effort.
  }
}

// ---------------------------------------------------------------------------
// Flow
// ---------------------------------------------------------------------------

/**
 * Applies a date/time/party-size change that needs new tables.
 *
 * 1. Tables are selected (and held) for the proposed window first; the booking
 *    and its current tables are untouched while the planner runs.
 * 2. With a hold, one transactional RPC (modify_booking_with_table_swap) applies
 *    the change, releases the old tables and assigns the held ones. The booking
 *    ends `confirmed`. Any failure rolls back to the old state.
 * 3. Without a hold, a booking that has tables (confirmed) is left exactly as it
 *    was and BookingModificationConflictError (409) is thrown. A booking still
 *    awaiting allocation (pending / pending_allocation) has nothing to lose: the
 *    change is applied, it stays pending, and auto-assign runs after the response.
 *
 * Guest emails are queued (email_dispatch_intents), not sent inline. Callers keep
 * passing `skipEmail: true` to enqueueBookingUpdatedSideEffects for this flow.
 *
 * @throws BookingModificationConflictError when the change was refused (409).
 */
export async function beginBookingModificationFlow(
  params: BeginFlowParams,
): Promise<BookingRecord> {
  const { client, bookingId, payload, source, existingBooking } = params;
  const restaurantId = existingBooking.restaurant_id;
  const attemptId = randomUUID();
  const patch: UpdateBookingPayload = { ...payload };
  delete patch.status;

  const quote = await quoteTablesForProposedWindow({
    client,
    bookingId,
    payload: patch,
    timeoutMs: getInlineAutoAssignTimeoutMs(),
  });

  const lastResult = (success: boolean, reason: string | null, emailSent: boolean): Json =>
    buildInlineLastResult({
      durationMs: quote.durationMs,
      success,
      reason,
      strategy: PLANNER_STRATEGY,
      trigger: PLANNER_TRIGGER,
      alternates: quote.alternates,
      attemptId,
      emailSent,
      emailVariant: 'modified',
    }) as unknown as Json;

  if (quote.ok) {
    const { data, error } = await (client as unknown as SwapRpcClient).rpc(
      'modify_booking_with_table_swap',
      {
        p_booking_id: bookingId,
        p_restaurant_id: restaurantId,
        p_patch: {
          ...patch,
          auto_assign_last_result: lastResult(true, null, !SUPPRESS_EMAILS),
        } as Json,
        p_hold_id: quote.holdId,
        p_expected_status: existingBooking.status,
        p_idempotency_key: `${existingBooking.auto_assign_idempotency_key ?? `mod-${bookingId}`}-mod-${quote.holdId}`,
        p_require_adjacency: quote.requireAdjacency,
        p_history_reason: 'modification_table_swap',
        p_history_metadata: { source, holdId: quote.holdId },
      },
    );

    if (error || !data) {
      await releaseHoldQuietly(client, quote.holdId, bookingId);
      const sqlState = sqlStateOf(error);
      logger.warn('[booking.modification] table swap refused', {
        bookingId,
        restaurantId,
        sqlState,
      });
      if (sqlState === 'P0004') {
        throw new BookingModificationConflictError('BOOKING_STATE_CONFLICT');
      }
      if (sqlState && RETRYABLE_SWAP_CODES.has(sqlState)) {
        throw new BookingModificationConflictError('MODIFICATION_TABLES_UNCONFIRMED', {
          reason: sqlState,
        });
      }
      throw error ?? new Error('modify_booking_with_table_swap returned no booking');
    }

    const confirmed = data as BookingRecord;
    await recordModificationEvent('booking.modification.inline_confirmed', {
      restaurantId,
      bookingId,
      context: { trigger: source, duration_ms: quote.durationMs, alternates: quote.alternates },
    });

    // A booking that was pending gets its first confirmation from the updated
    // side effects (pending -> confirmed); only an already-confirmed booking gets
    // the "changes confirmed" email.
    if (!AWAITING_ALLOCATION_STATUSES.has(existingBooking.status)) {
      await queueModificationEmail({
        client,
        booking: confirmed,
        type: 'updated',
        discriminator: quote.holdId,
      });
    }
    return confirmed;
  }

  if (!AWAITING_ALLOCATION_STATUSES.has(existingBooking.status)) {
    await recordModificationEvent('booking.modification.rejected', {
      restaurantId,
      bookingId,
      context: { trigger: source, reason: quote.reason, previousStatus: existingBooking.status },
    });
    throw new BookingModificationConflictError(
      quote.reason === 'INLINE_TIMEOUT' || quote.reason === 'INLINE_ERROR'
        ? 'MODIFICATION_TABLES_UNCONFIRMED'
        : 'MODIFICATION_NO_TABLES',
      { reason: quote.reason },
    );
  }

  // Awaiting allocation: no tables to protect. Apply the change and keep it pending.
  const updated = await updateBookingAndClearAssignmentsAtomically(
    client,
    bookingId,
    { ...patch, auto_assign_last_result: lastResult(false, quote.reason, false) },
    { restaurantId },
  );
  await recordModificationEvent('booking.modification.pending', {
    restaurantId,
    bookingId,
    context: { trigger: source, reason: quote.reason, previousStatus: existingBooking.status },
  });
  await queueModificationEmail({
    client,
    booking: updated,
    type: 'request_received',
    discriminator: attemptId,
  });
  scheduleAutoAssignAfterResponse(bookingId);
  return updated;
}
