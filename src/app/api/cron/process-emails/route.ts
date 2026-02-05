import { NextResponse } from 'next/server';


import {
  sendBookingCancellationEmail,
  sendBookingConfirmationEmail,
  sendBookingRejectedEmail,
  sendBookingReminderEmail,
  sendBookingReviewRequestEmail,
  sendBookingUpdateEmail,
  sendRestaurantCancellationEmail,
} from '@/server/emails/bookings';
import { recordObservabilityEvent } from '@/server/observability';
import { type EmailJobPayload, type EmailJobType } from '@/server/queue/email';
import { getServiceSupabaseClient } from '@/server/supabase';

import type { BookingRecord } from '@/server/bookings';
import type { Job, Queue } from 'bullmq';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Vercel cron jobs have a 10s timeout on hobby, 60s on pro
// Process jobs in batches to stay within limits
const MAX_JOBS_PER_RUN = 10;
const MAX_DELAYED_SCAN = 200;
const CRON_SECRET = process.env.CRON_SECRET;
const REVIEW_ONLY_TYPES: ReadonlySet<EmailJobType> = new Set(['review_request']);
const MAX_CRON_RETRIES = 5;
const RETRY_BACKOFF_BASE_MS = 60_000;
const RETRY_BACKOFF_CAP_MS = 30 * 60_000;

function isValidEmail(value?: string | null): boolean {
  return Boolean(value && value.trim().length > 3 && value.includes('@'));
}

async function fetchBooking(bookingId: string): Promise<BookingRecord | null> {
  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .eq('id', bookingId)
    .maybeSingle();
  if (error) {
    console.error('[cron][process-emails] failed to fetch booking', {
      bookingId,
      error: error.message,
    });
    return null;
  }
  return (data ?? null) as BookingRecord | null;
}

function parseTypeFilter(typesParam: string | null): { types: Set<EmailJobType> | null; error?: string } {
  if (!typesParam) {
    return { types: null };
  }

  const rawTypes = typesParam
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  if (rawTypes.length === 0) {
    return { types: null };
  }

  const invalidTypes = rawTypes.filter((value) => !REVIEW_ONLY_TYPES.has(value as EmailJobType));
  if (invalidTypes.length > 0) {
    return {
      types: null,
      error: `Unsupported email types: ${invalidTypes.join(', ')}. Only review_request is allowed.`,
    };
  }

  return { types: new Set(rawTypes as EmailJobType[]) };
}

function shouldSendByStatus(type: EmailJobType, booking: BookingRecord): boolean {
  const status = booking.status ?? null;
  const now = Date.now();

  switch (type) {
    case 'request_received':
      return status === 'pending' || status === 'pending_allocation';
    case 'confirmation':
      return status === 'confirmed';
    case 'reminder_24h':
    case 'reminder_short':
      if (status !== 'confirmed') return false;
      // Never send pre-event reminders after the booking start time.
      if (booking.start_at) {
        const startAt = Date.parse(booking.start_at);
        if (Number.isFinite(startAt) && now >= startAt) return false;
      }
      return true;
    case 'review_request':
      if (status !== 'completed') return false;
      // Avoid sending very stale review requests (typically indicates backlog).
      if (booking.end_at) {
        const endAt = Date.parse(booking.end_at);
        if (Number.isFinite(endAt) && now - endAt > 30 * 24 * 60 * 60 * 1000) return false;
      }
      return true;
    case 'cancelled':
    case 'restaurant_cancellation':
      return status === 'cancelled';
    case 'booking_rejected':
      return true;
    case 'updated':
      return true;
    default:
      return false;
  }
}

async function dispatchEmail(type: EmailJobType, booking: BookingRecord): Promise<void> {
  switch (type) {
    case 'request_received':
    case 'confirmation':
      await sendBookingConfirmationEmail(booking);
      return;
    case 'reminder_24h':
      await sendBookingReminderEmail(booking, { variant: 'standard' });
      return;
    case 'reminder_short':
      await sendBookingReminderEmail(booking, { variant: 'short' });
      return;
    case 'review_request':
      await sendBookingReviewRequestEmail(booking);
      return;
    case 'updated':
      await sendBookingUpdateEmail(booking);
      return;
    case 'cancelled':
      await sendBookingCancellationEmail(booking);
      return;
    case 'restaurant_cancellation':
      await sendRestaurantCancellationEmail(booking);
      return;
    case 'booking_rejected':
      await sendBookingRejectedEmail(booking);
      return;
    default: {
      console.warn(`[cron][process-emails] Unknown email type: ${type}`);
    }
  }
}

async function processJob(
  payload: EmailJobPayload,
): Promise<{ success: boolean; skipped?: boolean; error?: string }> {
  const booking = await fetchBooking(payload.bookingId);
  if (!booking) {
    return { success: true, skipped: true }; // Skip missing bookings
  }

  if (!isValidEmail(booking.customer_email)) {
    return { success: true, skipped: true }; // Skip invalid emails
  }

  if (!shouldSendByStatus(payload.type, booking)) {
    return { success: true, skipped: true }; // Status changed, skip
  }

  try {
    await dispatchEmail(payload.type, booking);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

function computeRetryDelayMs(attempt: number): number {
  if (!Number.isFinite(attempt) || attempt <= 0) return RETRY_BACKOFF_BASE_MS;
  const exponential = RETRY_BACKOFF_BASE_MS * Math.pow(2, Math.max(0, attempt - 1));
  return Math.min(RETRY_BACKOFF_CAP_MS, Math.max(RETRY_BACKOFF_BASE_MS, Math.floor(exponential)));
}

function getCronAttemptCount(payload: EmailJobPayload): number {
  const raw = payload.cronAttemptsMade;
  return typeof raw === 'number' && Number.isFinite(raw) && raw >= 0 ? Math.floor(raw) : 0;
}

async function rescheduleFailedJob(
  queue: Queue<EmailJobPayload>,
  job: Job<EmailJobPayload>,
  errorMessage: string,
): Promise<{ action: 'retry_scheduled'; attempt: number; delayMs: number } | { action: 'dlq' }> {
  const payload = job.data;
  const attempt = getCronAttemptCount(payload) + 1;
  const failedAt = new Date().toISOString();

  if (attempt >= MAX_CRON_RETRIES) {
    try {
      const { getEmailDlq } = await import('@/server/queue/email');
      const dlq = getEmailDlq();
      await dlq.add(
        'failed-booking-email',
        {
          ...payload,
          failedReason: errorMessage,
          failedAt,
          cronAttemptsMade: attempt,
        } as EmailJobPayload,
        { removeOnComplete: false, removeOnFail: false },
      );
    } catch (dlqError) {
      console.error('[cron][process-emails] failed to enqueue DLQ entry', {
        jobId: job.id,
        error: dlqError instanceof Error ? dlqError.message : String(dlqError),
      });
    }

    await recordObservabilityEvent({
      source: 'cron.process-emails',
      eventType: 'email_job.exhausted_retries',
      severity: 'error',
      context: {
        jobId: job.id ?? null,
        type: payload.type,
        bookingId: payload.bookingId,
        attempt,
        error: errorMessage,
      },
      restaurantId: payload.restaurantId ?? undefined,
      bookingId: payload.bookingId,
    });

    // Remove the original job to prevent infinite processing loops.
    await job.remove();
    return { action: 'dlq' };
  }

  const delayMs = computeRetryDelayMs(attempt);
  const nextPayload = {
    ...payload,
    failedReason: errorMessage,
    failedAt,
    cronAttemptsMade: attempt,
  } as EmailJobPayload;

  const jobId = job.id?.toString() ?? null;
  if (!jobId) {
    // No stable job id to re-enqueue; leave it for next run.
    return { action: 'retry_scheduled', attempt, delayMs };
  }

  // BullMQ state transitions require a worker token. In a serverless cron, we emulate retries by
  // removing the current job and re-adding it with the same jobId and a backoff delay.
  await job.remove();
  await queue.add('pending-booking-email', nextPayload, {
    jobId,
    delay: delayMs,
    removeOnComplete: true,
    removeOnFail: false,
  });

  return { action: 'retry_scheduled', attempt, delayMs };
}

async function selectReadyJobs(
  queue: Queue<EmailJobPayload>,
  now: number,
  allowedTypes: Set<EmailJobType> | null,
): Promise<{ jobs: Array<Job<EmailJobPayload>>; debug: Record<string, number> }> {
  const waitingJobs = await queue.getJobs(['wait'], 0, Math.max(0, MAX_JOBS_PER_RUN - 1), true);
  const matchingWaitingJobs = allowedTypes
    ? waitingJobs.filter((job) => allowedTypes.has(job.data.type))
    : waitingJobs;

  if (matchingWaitingJobs.length >= MAX_JOBS_PER_RUN) {
    return {
      jobs: matchingWaitingJobs.slice(0, MAX_JOBS_PER_RUN),
      debug: {
        waitingFetched: waitingJobs.length,
        waitingMatched: matchingWaitingJobs.length,
        delayedScanned: 0,
        delayedReady: 0,
        delayedMatched: 0,
      },
    };
  }

  const remaining = MAX_JOBS_PER_RUN - matchingWaitingJobs.length;
  const delayedScanLimit = Math.max(remaining, MAX_DELAYED_SCAN) - 1;
  // BullMQ returns delayed jobs newest-first by default; that can starve due jobs.
  // We must scan oldest-first to reliably pick up any due delayed jobs.
  const delayedJobs = await queue.getJobs(['delayed'], 0, delayedScanLimit, true);
  const matchedDelayed = allowedTypes
    ? delayedJobs.filter((job) => allowedTypes.has(job.data.type))
    : delayedJobs;
  const readyDelayed = delayedJobs
    .filter((job) => {
      if (allowedTypes && !allowedTypes.has(job.data.type)) {
        return false;
      }
      const processAt = job.timestamp + (job.opts.delay ?? 0);
      return processAt <= now;
    })
    .slice(0, remaining);

  return {
    jobs: [...matchingWaitingJobs, ...readyDelayed],
    debug: {
      waitingFetched: waitingJobs.length,
      waitingMatched: matchingWaitingJobs.length,
      delayedScanned: delayedJobs.length,
      delayedReady: readyDelayed.length,
      delayedMatched: matchedDelayed.length,
    },
  };
}

export async function GET(request: Request) {
  // Verify cron secret to prevent unauthorized access
  // Vercel cron jobs automatically send CRON_SECRET in the Authorization header as Bearer token
  // See: https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs
  const authHeader = request.headers.get('authorization');

  // Check if request has valid Bearer token (Vercel sends CRON_SECRET automatically)
  const hasValidBearerToken = CRON_SECRET && authHeader === `Bearer ${CRON_SECRET}`;

  if (CRON_SECRET && !hasValidBearerToken) {
    console.warn('[cron][process-emails] Unauthorized request', {
      hasAuthHeader: !!authHeader,
      hasCronSecret: !!CRON_SECRET,
    });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // If no CRON_SECRET is set, log a warning (endpoint is unprotected)
  if (!CRON_SECRET) {
    console.warn('[cron][process-emails] CRON_SECRET not set - endpoint is unprotected');
  }

  const url = new URL(request.url);
  const { types: allowedTypes, error: typesError } = parseTypeFilter(url.searchParams.get('types'));
  if (typesError) {
    return NextResponse.json({ error: typesError }, { status: 400 });
  }

  const { getEmailQueue } = await import('@/server/queue/email');
  const queue = getEmailQueue();
  const results: Array<{ jobId: string; success: boolean; skipped?: boolean; error?: string }> = [];

  try {
    const now = Date.now();
    const counts = await queue.getJobCounts('wait', 'delayed');
    const waitingCount = counts.wait ?? 0;
    const delayedCount = counts.delayed ?? 0;

    await recordObservabilityEvent({
      source: 'cron.process-emails',
      eventType: 'run.start',
      severity: 'info',
      context: {
        waitingCount,
        delayedCount,
        filterTypes: allowedTypes ? Array.from(allowedTypes) : null,
      },
    });

    if (waitingCount === 0 && delayedCount === 0) {
      return NextResponse.json({
        success: true,
        message: 'No pending emails to process',
        processed: 0,
        debug: {
          delayedCount,
          waitingCount,
          filterTypes: allowedTypes ? Array.from(allowedTypes) : null,
        },
      });
    }

    const { jobs: readyJobs, debug: selectionDebug } = await selectReadyJobs(
      queue,
      now,
      allowedTypes,
    );

    if (readyJobs.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No pending emails to process',
        processed: 0,
        debug: {
          delayedCount,
          waitingCount,
          ...selectionDebug,
          filterTypes: allowedTypes ? Array.from(allowedTypes) : null,
        },
      });
    }

    for (const job of readyJobs) {
      try {
        const payload = job.data;
        const result = await processJob(payload);

        if (result.success) {
          // Successful sends and skip conditions are terminal for a single job.
          await job.remove();
        } else {
          // Failed sends should never be dropped: reschedule with backoff and keep a DLQ path.
          const rescheduled = await rescheduleFailedJob(queue, job, result.error ?? 'Unknown error');
          console.warn('[cron][process-emails] rescheduled failed job', {
            jobId: job.id ?? 'unknown',
            type: payload.type,
            action: rescheduled.action,
            ...(rescheduled.action === 'retry_scheduled'
              ? { attempt: rescheduled.attempt, delayMs: rescheduled.delayMs }
              : {}),
          });
        }

        results.push({ jobId: job.id ?? 'unknown', ...result });
        const jobBucket = (job.opts.delay ?? 0) > 0 ? 'delayed' : 'waiting';
        console.log(`[cron][process-emails] Processed ${jobBucket} job ${job.id}:`, result);
      } catch (error) {
        console.error(`[cron][process-emails] Failed to process job ${job.id}:`, error);
        results.push({
          jobId: job.id ?? 'unknown',
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const successCount = results.filter((r) => r.success && !r.skipped).length;
    const skippedCount = results.filter((r) => r.skipped).length;
    const failedCount = results.filter((r) => !r.success).length;

    await recordObservabilityEvent({
      source: 'cron.process-emails',
      eventType: 'run.complete',
      severity: failedCount > 0 ? 'warning' : 'info',
      context: {
        processed: results.length,
        sent: successCount,
        skipped: skippedCount,
        failed: failedCount,
        filterTypes: allowedTypes ? Array.from(allowedTypes) : null,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Processed ${results.length} jobs`,
      stats: {
        sent: successCount,
        skipped: skippedCount,
        failed: failedCount,
      },
      filterTypes: allowedTypes ? Array.from(allowedTypes) : null,
      results,
    });
  } catch (error) {
    console.error('[cron][process-emails] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
