import { DateTime } from 'luxon';

import { recordObservabilityEvent } from '@/server/observability';
import { processEmailJobs, type ProcessEmailJobResult } from '@/server/queue/email-processing';
import { getServiceSupabaseClient } from '@/server/supabase';

import { EMAIL_DLQ_NAME, EMAIL_QUEUE_NAME } from './email-contract';

import type {
  EmailJobPayload,
  EmailJobType,
  EmailQueueDrainResult,
  EmailQueueStatusSnapshot,
  QueueJobSummary,
} from './email-contract';
import type { Json, Tables, TablesInsert } from '@/types/supabase';

const DEFAULT_ATTEMPTS = 5;
const DEFAULT_BACKOFF = { type: 'exponential', delay: 60_000 } as const;
const EMAIL_JOB_ID_SEPARATOR = '__';
const DEFAULT_MAX_JOBS = 25;
const MAX_JOB_HISTORY = 5_000;

export type EmailDispatchIntentStatus =
  | 'pending'
  | 'processing'
  | 'sent'
  | 'skipped'
  | 'failed'
  | 'cancelled';

type EmailDispatchIntentRow = Tables<'email_dispatch_intents'>;
type EmailDispatchIntentInsert = TablesInsert<'email_dispatch_intents'>;

type BackoffPolicy = {
  type?: 'fixed' | 'exponential' | null;
  delay?: number | null;
};

type ScheduleEmailIntentOptions = {
  jobId?: string;
  attempts?: number;
  backoff?: BackoffPolicy;
};

type CancelEmailIntentsParams = {
  bookingId: string;
  types?: ReadonlyArray<EmailJobType> | Set<EmailJobType> | null;
};

type JobHistoryLimit = number | 'all' | undefined;
type EmailQueueStatusOptions = {
  jobLimit?: JobHistoryLimit;
  restaurantId?: string | null;
};

function buildEmailJobId(type: EmailJobType, bookingId: string): string {
  return `email${EMAIL_JOB_ID_SEPARATOR}${type}${EMAIL_JOB_ID_SEPARATOR}${bookingId}`;
}

function sanitizeEmailJobId(jobId: string): string {
  return jobId.replace(/:/g, EMAIL_JOB_ID_SEPARATOR);
}

function normalizeBackoff(backoff: BackoffPolicy | undefined) {
  const type = backoff?.type === 'fixed' ? 'fixed' : 'exponential';
  const delay =
    typeof backoff?.delay === 'number' && Number.isFinite(backoff.delay) && backoff.delay > 0
      ? Math.floor(backoff.delay)
      : DEFAULT_BACKOFF.delay;

  return { type, delay } as const;
}

function parseBackoffDelay(backoff: { type: string; delay: number }, attempt: number): number {
  const baseDelay =
    typeof backoff.delay === 'number' && Number.isFinite(backoff.delay) && backoff.delay > 0
      ? Math.floor(backoff.delay)
      : DEFAULT_BACKOFF.delay;

  if (backoff.type === 'fixed') {
    return baseDelay;
  }

  return Math.min(30 * 60_000, baseDelay * Math.pow(2, Math.max(0, attempt - 1)));
}

function normalizeScheduledFor(payload: EmailJobPayload): string {
  const candidate = payload.scheduledFor ? new Date(payload.scheduledFor) : new Date();
  if (Number.isNaN(candidate.getTime())) {
    throw new Error(`Invalid scheduledFor value: ${payload.scheduledFor}`);
  }
  return candidate.toISOString();
}

function normalizeTypes(
  types?: ReadonlyArray<EmailJobType> | Set<EmailJobType> | null,
): EmailJobType[] | null {
  if (!types) return null;
  const values = Array.isArray(types) ? types : Array.from(types);
  return values.length > 0 ? values : null;
}

function normalizeJobHistoryLimit(limit: JobHistoryLimit): number {
  if (limit === 'all') {
    return MAX_JOB_HISTORY;
  }

  if (typeof limit !== 'number' || !Number.isFinite(limit)) {
    return 10;
  }

  return Math.max(1, Math.min(MAX_JOB_HISTORY, Math.floor(limit)));
}

function asRecord(value: Json | null): Record<string, Json | undefined> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, Json | undefined>;
}

function toIsoDateTime(value: string | null | undefined): string | null {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

function toPayload(row: EmailDispatchIntentRow): EmailJobPayload {
  const payload = asRecord(row.payload);

  return {
    bookingId:
      typeof payload.bookingId === 'string' && payload.bookingId.length > 0
        ? payload.bookingId
        : row.booking_id,
    restaurantId:
      typeof payload.restaurantId === 'string' ? payload.restaurantId : row.restaurant_id,
    type:
      typeof payload.type === 'string' && payload.type.length > 0
        ? (payload.type as EmailJobType)
        : (row.email_type as EmailJobType),
    scheduledFor:
      typeof payload.scheduledFor === 'string' && payload.scheduledFor.length > 0
        ? payload.scheduledFor
        : (toIsoDateTime(row.scheduled_for) ?? undefined),
    failedReason: row.last_error,
    failedAt:
      row.status === 'failed' || row.status === 'processing'
        ? toIsoDateTime(row.last_attempt_at)
        : null,
    cronAttemptsMade: row.attempts_made,
  };
}

function toQueueStatus(
  row: EmailDispatchIntentRow,
  nowMs: number,
): 'waiting' | 'active' | 'delayed' | 'dlq' | null {
  if (row.status === 'processing') return 'active';
  if (row.status === 'failed') return 'dlq';
  if (row.status !== 'pending') return null;

  const scheduledFor = DateTime.fromISO(row.scheduled_for, { setZone: true });
  if (!scheduledFor.isValid) {
    return 'waiting';
  }

  return scheduledFor.toMillis() > nowMs ? 'delayed' : 'waiting';
}

function toQueueJobSummary(row: EmailDispatchIntentRow): QueueJobSummary {
  return {
    id: row.dedupe_key,
    payload: toPayload(row),
    scheduledFor: row.scheduled_for,
    status: row.status,
  };
}

async function countPendingRows(
  nowIso: string,
  mode: 'due' | 'future',
  restaurantId?: string | null,
): Promise<number> {
  const supabase = getServiceSupabaseClient();
  let query = supabase
    .from('email_dispatch_intents')
    .select('id', { head: true, count: 'exact' })
    .eq('status', 'pending');
  if (restaurantId) {
    query = query.eq('restaurant_id', restaurantId);
  }
  const filtered =
    mode === 'due' ? query.lte('scheduled_for', nowIso) : query.gt('scheduled_for', nowIso);
  const { count, error } = await filtered;

  if (error) {
    throw new Error(error.message);
  }

  return count ?? 0;
}

async function countStatusRows(
  status: EmailDispatchIntentStatus | ReadonlyArray<EmailDispatchIntentStatus>,
  restaurantId?: string | null,
): Promise<number> {
  const supabase = getServiceSupabaseClient();
  let query = Array.isArray(status)
    ? supabase
        .from('email_dispatch_intents')
        .select('id', { head: true, count: 'exact' })
        .in('status', [...status])
    : supabase
        .from('email_dispatch_intents')
        .select('id', { head: true, count: 'exact' })
        .eq('status', status as EmailDispatchIntentStatus);
  if (restaurantId) {
    query = query.eq('restaurant_id', restaurantId);
  }
  const { count, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return count ?? 0;
}

async function listPendingRows(
  nowIso: string,
  mode: 'due' | 'future',
  limit: number,
  restaurantId?: string | null,
): Promise<EmailDispatchIntentRow[]> {
  const supabase = getServiceSupabaseClient();
  let query = supabase.from('email_dispatch_intents').select('*').eq('status', 'pending');
  if (restaurantId) {
    query = query.eq('restaurant_id', restaurantId);
  }
  const filtered =
    mode === 'due' ? query.lte('scheduled_for', nowIso) : query.gt('scheduled_for', nowIso);
  const { data, error } = await filtered
    .order('scheduled_for', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as EmailDispatchIntentRow[];
}

async function listStatusRows(
  status: EmailDispatchIntentStatus,
  limit: number,
  restaurantId?: string | null,
): Promise<EmailDispatchIntentRow[]> {
  const supabase = getServiceSupabaseClient();
  let query = supabase.from('email_dispatch_intents').select('*').eq('status', status);
  if (restaurantId) {
    query = query.eq('restaurant_id', restaurantId);
  }
  const { data, error } = await query
    .order('scheduled_for', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as EmailDispatchIntentRow[];
}

async function finalizeIntentResult(
  row: EmailDispatchIntentRow,
  result: ProcessEmailJobResult,
): Promise<void> {
  const supabase = getServiceSupabaseClient();
  const now = new Date().toISOString();

  if (result.success) {
    const nextStatus: EmailDispatchIntentStatus = result.skipped ? 'skipped' : 'sent';
    const { error } = await supabase
      .from('email_dispatch_intents')
      .update({
        status: nextStatus,
        processed_at: now,
        claimed_at: null,
        last_error: null,
        updated_at: now,
        payload: {
          ...asRecord(row.payload),
          cronAttemptsMade: row.attempts_made,
          failedReason: null,
          failedAt: null,
        } satisfies Json,
      })
      .eq('id', row.id);

    if (error) {
      throw new Error(error.message);
    }

    return;
  }

  const errorMessage =
    typeof result.error === 'string' && result.error.trim().length > 0
      ? result.error.trim()
      : 'Unknown processing error';

  if (row.attempts_made >= row.max_attempts) {
    const { error } = await supabase
      .from('email_dispatch_intents')
      .update({
        status: 'failed',
        processed_at: now,
        claimed_at: null,
        last_error: errorMessage,
        updated_at: now,
        payload: {
          ...asRecord(row.payload),
          cronAttemptsMade: row.attempts_made,
          failedReason: errorMessage,
          failedAt: now,
        } satisfies Json,
      })
      .eq('id', row.id);

    if (error) {
      throw new Error(error.message);
    }

    await recordObservabilityEvent({
      source: 'queue.email',
      eventType: 'email_queue.intent_failed',
      severity: 'warning',
      context: {
        dedupeKey: row.dedupe_key,
        bookingId: row.booking_id,
        type: row.email_type,
        attemptsMade: row.attempts_made,
        maxAttempts: row.max_attempts,
        error: errorMessage,
      },
      restaurantId: row.restaurant_id ?? undefined,
      bookingId: row.booking_id,
    });

    return;
  }

  const retryDelayMs = parseBackoffDelay(
    { type: row.backoff_type, delay: row.backoff_delay_ms },
    row.attempts_made,
  );
  const nextScheduledFor = new Date(Date.now() + retryDelayMs).toISOString();
  const { error } = await supabase
    .from('email_dispatch_intents')
    .update({
      status: 'pending',
      scheduled_for: nextScheduledFor,
      claimed_at: null,
      last_error: errorMessage,
      updated_at: now,
      payload: {
        ...asRecord(row.payload),
        cronAttemptsMade: row.attempts_made,
        failedReason: errorMessage,
        failedAt: now,
        scheduledFor: nextScheduledFor,
      } satisfies Json,
    })
    .eq('id', row.id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function scheduleEmailIntent(
  payload: EmailJobPayload,
  options: ScheduleEmailIntentOptions = {},
): Promise<void> {
  const dedupeKey = sanitizeEmailJobId(
    options.jobId ?? buildEmailJobId(payload.type, payload.bookingId),
  );
  const scheduledFor = normalizeScheduledFor(payload);
  const scheduledForDateTime = DateTime.fromISO(scheduledFor, { setZone: true });
  const delayMs = scheduledForDateTime.isValid
    ? Math.max(0, scheduledForDateTime.toMillis() - Date.now())
    : 0;
  const attempts =
    typeof options.attempts === 'number' &&
    Number.isFinite(options.attempts) &&
    options.attempts > 0
      ? Math.floor(options.attempts)
      : DEFAULT_ATTEMPTS;
  const backoff = normalizeBackoff(options.backoff);
  const now = new Date().toISOString();

  const row: EmailDispatchIntentInsert = {
    dedupe_key: dedupeKey,
    booking_id: payload.bookingId,
    restaurant_id: payload.restaurantId,
    email_type: payload.type,
    scheduled_for: scheduledFor,
    status: 'pending',
    attempts_made: 0,
    max_attempts: attempts,
    backoff_type: backoff.type,
    backoff_delay_ms: backoff.delay,
    claimed_at: null,
    last_attempt_at: null,
    processed_at: null,
    cancelled_at: null,
    last_error: null,
    updated_at: now,
    payload: {
      ...payload,
      scheduledFor,
      cronAttemptsMade: 0,
      failedReason: null,
      failedAt: null,
    } satisfies Json,
  };

  const supabase = getServiceSupabaseClient();

  const { error } = await supabase
    .from('email_dispatch_intents')
    .upsert(row, { onConflict: 'dedupe_key' });

  if (!error) {
    return;
  }

  console.error('[queue][email] failed to schedule intent', {
    dedupeKey,
    bookingId: payload.bookingId,
    type: payload.type,
    scheduledFor,
    error: error.message,
  });
  await recordObservabilityEvent({
    source: 'queue.email',
    eventType: 'email_queue.enqueue_failed',
    severity: 'error',
    context: {
      dedupeKey,
      bookingId: payload.bookingId,
      type: payload.type,
      delayMs,
      scheduledFor,
      error: error.message,
    },
    restaurantId: payload.restaurantId ?? undefined,
    bookingId: payload.bookingId,
  });
  throw new Error(error.message);
}

export async function cancelEmailIntents(params: CancelEmailIntentsParams): Promise<number> {
  const types = normalizeTypes(params.types);
  const supabase = getServiceSupabaseClient();
  const now = new Date().toISOString();
  let query = supabase
    .from('email_dispatch_intents')
    .update({
      status: 'cancelled',
      cancelled_at: now,
      processed_at: now,
      claimed_at: null,
      updated_at: now,
    })
    .eq('booking_id', params.bookingId)
    .in('status', ['pending', 'processing'])
    .is('cancelled_at', null);

  if (types) {
    query = query.in('email_type', types);
  }

  const { data, error } = await query.select('id');

  if (error) {
    throw new Error(error.message);
  }

  return data?.length ?? 0;
}

export async function cancelEmailIntentByDedupeKey(dedupeKey: string): Promise<boolean> {
  const supabase = getServiceSupabaseClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('email_dispatch_intents')
    .update({
      status: 'cancelled',
      cancelled_at: now,
      processed_at: now,
      claimed_at: null,
      updated_at: now,
    })
    .eq('dedupe_key', sanitizeEmailJobId(dedupeKey))
    .in('status', ['pending', 'processing'])
    .is('cancelled_at', null)
    .select('id')
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(data?.id);
}

export async function getEmailQueueStatusFromIntents(
  includeJobs = false,
  options?: EmailQueueStatusOptions,
): Promise<EmailQueueStatusSnapshot> {
  const nowIso = new Date().toISOString();
  const nowMs = Date.now();
  const restaurantId = options?.restaurantId ?? null;
  const jobLimit = normalizeJobHistoryLimit(options?.jobLimit);
  const [
    waitingCount,
    activeCount,
    delayedCount,
    failedCount,
    completedCount,
    waitingRows,
    activeRows,
    delayedRows,
    failedRows,
  ] = await Promise.all([
    countPendingRows(nowIso, 'due', restaurantId),
    countStatusRows('processing', restaurantId),
    countPendingRows(nowIso, 'future', restaurantId),
    countStatusRows('failed', restaurantId),
    countStatusRows(['sent', 'skipped'], restaurantId),
    includeJobs ? listPendingRows(nowIso, 'due', jobLimit, restaurantId) : Promise.resolve([]),
    includeJobs ? listStatusRows('processing', jobLimit, restaurantId) : Promise.resolve([]),
    includeJobs ? listPendingRows(nowIso, 'future', jobLimit, restaurantId) : Promise.resolve([]),
    includeJobs ? listStatusRows('failed', jobLimit, restaurantId) : Promise.resolve([]),
  ]);

  const waiting = waitingRows
    .filter((row) => toQueueStatus(row, nowMs) === 'waiting')
    .map(toQueueJobSummary);
  const active = activeRows
    .filter((row) => toQueueStatus(row, nowMs) === 'active')
    .map(toQueueJobSummary);
  const delayed = delayedRows
    .filter((row) => toQueueStatus(row, nowMs) === 'delayed')
    .map(toQueueJobSummary);
  const failed = failedRows
    .filter((row) => toQueueStatus(row, nowMs) === 'dlq')
    .map(toQueueJobSummary);

  return {
    status: 'ok',
    provider: 'cloudflare',
    queue: {
      name: EMAIL_QUEUE_NAME,
      dlqName: EMAIL_DLQ_NAME,
      counts: {
        waiting: waitingCount,
        active: activeCount,
        completed: completedCount,
        failed: failedCount,
        delayed: delayedCount,
        total: waitingCount + activeCount + delayedCount,
        dlq: failedCount,
      },
      jobs: includeJobs
        ? {
            waiting,
            active,
            failed,
            delayed,
            dlq: failed,
          }
        : null,
    },
    timestamp: new Date().toISOString(),
  };
}

export async function drainDueEmailIntents(params?: {
  types?: ReadonlyArray<EmailJobType> | Set<EmailJobType> | null;
  maxJobs?: number | null;
}): Promise<EmailQueueDrainResult> {
  const supabase = getServiceSupabaseClient();
  const types = normalizeTypes(params?.types);
  const maxJobs =
    typeof params?.maxJobs === 'number' && Number.isFinite(params.maxJobs)
      ? Math.max(1, Math.min(100, Math.floor(params.maxJobs)))
      : DEFAULT_MAX_JOBS;

  const { data, error } = await supabase.rpc('claim_due_email_dispatch_intents', {
    p_max_count: maxJobs,
    p_email_types: types,
  });

  if (error) {
    throw new Error(error.message);
  }

  const claimed = (data ?? []) as EmailDispatchIntentRow[];
  if (claimed.length === 0) {
    return {
      success: true,
      message: 'No pending emails to process',
      processed: 0,
      stats: { sent: 0, skipped: 0, failed: 0 },
      results: [],
      filterTypes: types,
    };
  }

  const processingResult = await processEmailJobs(
    claimed.map((row) => ({
      id: row.id,
      payload: {
        ...toPayload(row),
        cronAttemptsMade: row.attempts_made,
      },
    })),
  );
  const resultsById = new Map(processingResult.results.map((result) => [result.jobId, result]));

  await Promise.all(
    claimed.map(async (row) => {
      const result = resultsById.get(row.id) ?? {
        jobId: row.id,
        success: false,
        error: 'Missing processing result',
      };
      await finalizeIntentResult(row, result);
    }),
  );

  return {
    success: true,
    message: `Processed ${claimed.length} jobs`,
    processed: claimed.length,
    stats: processingResult.stats,
    results: claimed.map((row) => {
      const result = resultsById.get(row.id);
      return {
        jobId: row.dedupe_key,
        success: result?.success ?? false,
        skipped: result?.skipped,
        error: result?.error,
      };
    }),
    filterTypes: types,
    debug: {
      claimed: claimed.length,
      maxJobs,
      types: types ?? null,
    },
  };
}
