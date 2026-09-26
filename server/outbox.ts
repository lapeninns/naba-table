import { logger } from '@/lib/logger';
import { emitHoldConfirmed } from '@/server/capacity/telemetry';
import { recordObservabilityEvent } from '@/server/observability';
import { getServiceSupabaseClient } from '@/server/supabase';

import type { Database, Json, Tables } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database, 'public'>;

export type OutboxPayload = Record<string, unknown>;

export type EnqueueParams = {
  eventType: string;
  restaurantId?: string | null;
  bookingId?: string | null;
  idempotencyKey?: string | null;
  dedupeKey?: string | null;
  payload: OutboxPayload;
  client?: DbClient;
};

/**
 * `duplicate` means an equivalent pending/processing event already exists
 * (unique index `capacity_outbox_dedupe`). `failed` is returned, never thrown, so
 * hot paths stay non-blocking, but it is logged and visible to the caller.
 */
export type OutboxEnqueueResult =
  | { status: 'enqueued' }
  | { status: 'duplicate' }
  | { status: 'failed'; errorCode: string };

export type OutboxBatchSummary = {
  processed: number;
  failed: number;
  /** Dead-lettered this batch: by the claim (attempts used up) or by a failed last attempt. */
  dead: number;
  pending: number;
  error?: 'CLAIM_FAILED';
};

type OutboxRow = Tables<'capacity_outbox'>;

/** How long a claimed row stays invisible to other workers before it can be re-claimed. */
export const OUTBOX_LEASE_SECONDS = 300;
/** A row that has been claimed this many times without completing is dead-lettered. */
export const OUTBOX_MAX_ATTEMPTS = 10;

function errorCodeOf(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === 'string' && code.length > 0) {
      return code;
    }
  }
  return 'UNKNOWN';
}

export async function enqueueOutboxEvent(params: EnqueueParams): Promise<OutboxEnqueueResult> {
  const { eventType, restaurantId, bookingId, idempotencyKey, dedupeKey, payload, client } = params;
  try {
    const supabase = client ?? getServiceSupabaseClient();
    const { error } = await supabase.from('capacity_outbox').insert({
      event_type: eventType,
      restaurant_id: restaurantId ?? null,
      booking_id: bookingId ?? null,
      idempotency_key: idempotencyKey ?? null,
      dedupe_key: dedupeKey ?? null,
      payload: payload as Json,
      status: 'pending',
      attempt_count: 0,
      next_attempt_at: null,
    });
    if (!error) {
      return { status: 'enqueued' };
    }
    if (errorCodeOf(error) === '23505') {
      return { status: 'duplicate' };
    }
    throw error;
  } catch (error) {
    const errorCode = errorCodeOf(error);
    logger.warn('[outbox] enqueue failed', {
      eventType,
      bookingId: bookingId ?? null,
      restaurantId: restaurantId ?? null,
      errorCode,
    });
    return { status: 'failed', errorCode };
  }
}

function computeBackoffMs(attempt: number): number {
  const base = 250; // ms
  const max = 30_000; // 30s
  const exp = Math.min(attempt, 8);
  const jitter = Math.random() * base;
  return Math.min(max, Math.pow(2, exp) * base + jitter);
}

async function handleEvent(row: OutboxRow): Promise<void> {
  const { event_type: type, payload } = row;
  if (type === 'capacity.hold.confirmed') {
    await emitHoldConfirmed(payload as unknown as Parameters<typeof emitHoldConfirmed>[0]);
    return;
  }
  if (type === 'capacity.assignment.sync') {
    await recordObservabilityEvent({
      source: 'capacity.sync',
      eventType: 'capacity.assignment.synchronized',
      severity: 'info',
      context: payload,
      restaurantId: row.restaurant_id ?? undefined,
      bookingId: row.booking_id ?? undefined,
    });
    return;
  }
  // Unknown event: complete it so it cannot loop forever, and leave a trace.
  logger.warn('[outbox] unknown event type', { eventType: type, outboxId: row.id });
}

/**
 * Settles a claimed row. The claim's attempt_count is the fencing token: every
 * claim (including a re-claim after an expired lease) increments it, so a worker
 * whose lease expired and whose row was re-claimed by another worker matches
 * nothing here and cannot overwrite the new owner's state. Returns false when the
 * guard matched nothing.
 */
async function settleClaimedRow(
  supabase: DbClient,
  claimed: Pick<OutboxRow, 'id' | 'attempt_count'>,
  patch: { status: 'done' | 'pending' | 'dead'; next_attempt_at: string | null },
): Promise<boolean> {
  const rowId = claimed.id;
  const { data, error } = await supabase
    .from('capacity_outbox')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', rowId)
    .eq('status', 'processing')
    .eq('attempt_count', claimed.attempt_count)
    .select('id');
  if (error) {
    logger.error('[outbox] settle failed', {
      outboxId: rowId,
      nextStatus: patch.status,
      errorCode: errorCodeOf(error),
    });
    return false;
  }
  if (!Array.isArray(data) || data.length === 0) {
    logger.warn('[outbox] lease lost before settle', { outboxId: rowId, nextStatus: patch.status });
    return false;
  }
  return true;
}

export async function processOutboxBatch(params?: {
  limit?: number;
  leaseSeconds?: number;
  client?: DbClient;
}): Promise<OutboxBatchSummary> {
  const { limit = 100, leaseSeconds = OUTBOX_LEASE_SECONDS, client } = params ?? {};
  const supabase = client ?? getServiceSupabaseClient();

  // One statement claims the batch (FOR UPDATE SKIP LOCKED + lease), so two workers
  // can never receive the same row while its lease is live.
  const { data, error } = await supabase.rpc('claim_capacity_outbox_batch', {
    p_limit: limit,
    p_lease_seconds: leaseSeconds,
    // Rows whose attempts are used up (the worker kept dying before settling) are
    // dead-lettered by the claim instead of being re-claimed forever. The claim
    // returns them with status 'dead' so they are counted here.
    p_max_attempts: OUTBOX_MAX_ATTEMPTS,
  });

  if (error) {
    logger.error('[outbox] claim failed', { errorCode: errorCodeOf(error) });
    return { processed: 0, failed: 0, dead: 0, pending: 0, error: 'CLAIM_FAILED' };
  }

  const returned: OutboxRow[] = Array.isArray(data) ? data : [];
  if (returned.length === 0) {
    return { processed: 0, failed: 0, dead: 0, pending: 0 };
  }

  let processed = 0;
  let failed = 0;
  let dead = 0;

  // Only 'processing' rows are this worker's to handle. 'dead' rows were
  // dead-lettered by the claim itself and are already final.
  const rows: OutboxRow[] = [];
  for (const row of returned) {
    if (row.status === 'dead') {
      dead += 1;
      logger.warn('[outbox] dead-lettered by claim', {
        outboxId: row.id,
        eventType: row.event_type,
        attempts: row.attempt_count,
      });
      continue;
    }
    rows.push(row);
  }

  for (const row of rows) {
    try {
      await handleEvent(row);
    } catch (handlerError) {
      // attempt_count was incremented by the claim, so it already counts this attempt.
      const attempts = row.attempt_count ?? 1;
      const isDead = attempts >= OUTBOX_MAX_ATTEMPTS;
      const next = isDead ? null : new Date(Date.now() + computeBackoffMs(attempts)).toISOString();
      const settled = await settleClaimedRow(supabase, row, {
        status: isDead ? 'dead' : 'pending',
        next_attempt_at: next,
      });
      if (settled) {
        if (isDead) {
          dead += 1;
        } else {
          failed += 1;
        }
      }
      logger.warn('[outbox] handler failed', {
        outboxId: row.id,
        eventType: row.event_type,
        attempts,
        errorName: handlerError instanceof Error ? handlerError.name : 'UnknownError',
      });
      continue;
    }

    if (await settleClaimedRow(supabase, row, { status: 'done', next_attempt_at: null })) {
      processed += 1;
    }
  }

  const summary: OutboxBatchSummary = {
    processed,
    failed,
    dead,
    pending: Math.max(0, rows.length - processed),
  };
  try {
    await recordObservabilityEvent({
      source: 'outbox',
      eventType: 'outbox.batch',
      severity: failed > 0 || dead > 0 ? 'warning' : 'info',
      context: summary,
    });
  } catch {
    // Telemetry is best-effort; the summary is still returned.
  }
  return summary;
}
