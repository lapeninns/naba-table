import { Job, QueueEvents, Worker } from "bullmq";

import { closeRedisConnection, getRedisConnection } from "@/lib/queue/redis";
import {
  sendBookingConfirmationEmail,
  sendBookingReminderEmail,
  sendBookingReviewRequestEmail,
} from "@/server/emails/bookings";
import { recordObservabilityEvent } from "@/server/observability";
import { EMAIL_QUEUE_NAME, type EmailJobPayload, getEmailDlq } from "@/server/queue/email";
import { getServiceSupabaseClient } from "@/server/supabase";

import type { BookingRecord } from "@/server/bookings";

// A simple structured logger for demonstration purposes
const logger = {
  info: (msg: string, context: object = {}) => console.log(JSON.stringify({ level: "info", msg, ...context })),
  warn: (msg: string, context: object = {}) => console.warn(JSON.stringify({ level: "warn", msg, ...context })),
  error: (msg: string, context: object = {}) => console.error(JSON.stringify({ level: "error", msg, ...context })),
};

const SUPPRESS_EMAILS =
  process.env.LOAD_TEST_DISABLE_EMAILS === "true" || process.env.SUPPRESS_EMAILS === "true";

const concurrency = (() => {
  const configured = Number.parseInt(process.env.EMAIL_QUEUE_CONCURRENCY ?? "", 10);
  return Number.isFinite(configured) && configured > 0 ? configured : 5;
})();

type EmailPrefs = {
  sendReminder24h: boolean;
  sendReminderShort: boolean;
  sendReviewRequest: boolean;
};

async function fetchRestaurantEmailPrefs(
  restaurantId: string | null,
  supabase = getServiceSupabaseClient(),
): Promise<EmailPrefs> {
  if (!restaurantId) return { sendReminder24h: true, sendReminderShort: true, sendReviewRequest: true };
  const { data, error } = await supabase
    .from("restaurants")
    .select("email_send_reminder_24h,email_send_reminder_short,email_send_review_request")
    .eq("id", restaurantId)
    .maybeSingle();

  if (error || !data) {
    return { sendReminder24h: true, sendReminderShort: true, sendReviewRequest: true };
  }

  return {
    sendReminder24h: data.email_send_reminder_24h ?? true,
    sendReminderShort: data.email_send_reminder_short ?? true,
    sendReviewRequest: data.email_send_review_request ?? true,
  };
}

function isPast(dateIso?: string | null, bufferMs = 0): boolean {
  if (!dateIso) return true;
  const ts = new Date(dateIso).getTime();
  return Number.isNaN(ts) || ts + bufferMs < Date.now();
}

import { Job, QueueEvents, Worker } from "bullmq";

import { closeRedisConnection, getRedisConnection } from "@/lib/queue/redis";
import {
  sendBookingConfirmationEmail,
  sendBookingRejectedEmail,
  sendBookingReminderEmail,
  sendBookingReviewRequestEmail,
  sendRestaurantCancellationEmail,
} from "@/server/emails/bookings";
import { recordObservabilityEvent } from "@/server/observability";
import { EMAIL_QUEUE_NAME, type EmailJobPayload, getEmailDlq } from "@/server/queue/email";
import { getServiceSupabaseClient } from "@/server/supabase";

import type { BookingRecord } from "@/server/bookings";

// A simple structured logger for demonstration purposes
const logger = {
  info: (msg: string, context: object = {}) => console.log(JSON.stringify({ level: "info", msg, ...context })),
  warn: (msg: string, context: object = {}) => console.warn(JSON.stringify({ level: "warn", msg, ...context })),
  error: (msg: string, context: object = {}) => console.error(JSON.stringify({ level: "error", msg, ...context })),
};

const SUPPRESS_EMAILS =
  process.env.LOAD_TEST_DISABLE_EMAILS === "true" || process.env.SUPPRESS_EMAILS === "true";

const concurrency = (() => {
  const configured = Number.parseInt(process.env.EMAIL_QUEUE_CONCURRENCY ?? "", 10);
  return Number.isFinite(configured) && configured > 0 ? configured : 5;
})();

type EmailPrefs = {
  sendReminder24h: boolean;
  sendReminderShort: boolean;
  sendReviewRequest: boolean;
};

async function fetchRestaurantEmailPrefs(
  restaurantId: string | null,
  supabase = getServiceSupabaseClient(),
): Promise<EmailPrefs> {
  if (!restaurantId) return { sendReminder24h: true, sendReminderShort: true, sendReviewRequest: true };
  const { data, error } = await supabase
    .from("restaurants")
    .select("email_send_reminder_24h,email_send_reminder_short,email_send_review_request")
    .eq("id", restaurantId)
    .maybeSingle();

  if (error || !data) {
    return { sendReminder24h: true, sendReminderShort: true, sendReviewRequest: true };
  }

  return {
    sendReminder24h: data.email_send_reminder_24h ?? true,
    sendReminderShort: data.email_send_reminder_short ?? true,
    sendReviewRequest: data.email_send_review_request ?? true,
  };
}

function isPast(dateIso?: string | null, bufferMs = 0): boolean {
  if (!dateIso) return true;
  const ts = new Date(dateIso).getTime();
  return Number.isNaN(ts) || ts + bufferMs < Date.now();
}

async function processEmailJob(job: Job<EmailJobPayload>): Promise<void> {
  const { id: jobId, data: jobData } = job;
  const logContext = { jobId, bookingId: jobData.bookingId, jobType: jobData.type };
  
  logger.info("Processing email job", logContext);

  if (SUPPRESS_EMAILS) {
    logger.warn("Emails are suppressed via environment variable", logContext);
    await recordObservabilityEvent({
      source: "queue.email",
      eventType: "email_queue.suppressed",
      context: { bookingId: jobData.bookingId, type: jobData.type },
      restaurantId: jobData.restaurantId ?? undefined,
      bookingId: jobData.bookingId,
    });
    return;
  }

  const redis = getRedisConnection();
  const idempotencyKey = `email-sent:${jobId}`;

  try {
    // 1. IDEMPOTENCY CHECK
    const alreadySent = await redis.get(idempotencyKey);
    if (alreadySent) {
      logger.warn("Idempotency key found, skipping email to prevent duplicate.", logContext);
      return;
    }

    // 2. FETCH BOOKING (Primary race condition check)
    const supabase = getServiceSupabaseClient();
    const { data: booking, error } = await supabase
      .from("bookings")
      .select("*, customers(user_profiles(is_email_suppressed))") // Fetch suppression status via relations
      .eq("id", jobData.bookingId)
      .maybeSingle();

    if (error) {
      throw new Error(error.message ?? String(error));
    }
    if (!booking) {
      // This is not a retryable error, so we can throw to send to DLQ
      throw new Error(`Booking ${jobData.bookingId} not found`);
    }

    // 3. SUPPRESSION LIST CHECK
    // Access the nested data from the query
    const isSuppressed = (booking as any).customers?.user_profiles?.is_email_suppressed ?? false;
    if (isSuppressed) {
      logger.warn("User is on suppression list, skipping email.", logContext);
      return;
    }

    const bookingRecord = booking as BookingRecord;
    const prefs = await fetchRestaurantEmailPrefs(bookingRecord.restaurant_id ?? null, supabase);

    // 4. PROCESS JOB BY TYPE (State validation)
    switch (jobData.type) {
      case "request_received": {
        if (bookingRecord.status === "pending" || bookingRecord.status === "pending_allocation") {
          await sendBookingConfirmationEmail(bookingRecord);
        } else {
          logger.info("Skipping request_received, booking no longer pending.", { ...logContext, status: bookingRecord.status });
        }
        break;
      }
      case "confirmation": {
        if (bookingRecord.status === "confirmed") {
          await sendBookingConfirmationEmail(bookingRecord);
        } else {
          logger.info("Skipping confirmation, booking not confirmed.", { ...logContext, status: bookingRecord.status });
        }
        break;
      }
      case "reminder_24h":
      case "reminder_short": {
        const prefCheck = jobData.type === "reminder_24h" ? prefs.sendReminder24h : prefs.sendReminderShort;
        if (!prefCheck) {
          logger.info("Skipping reminder, disabled by restaurant.", logContext);
          break;
        }
        if (bookingRecord.status !== "confirmed") {
          logger.info("Skipping reminder, booking not confirmed.", { ...logContext, status: bookingRecord.status });
          break;
        }
        if (isPast(bookingRecord.start_at, -15 * 60_000)) {
          logger.info("Skipping reminder, start time is in the past.", logContext);
          break;
        }
        await sendBookingReminderEmail(bookingRecord, { variant: jobData.type === "reminder_short" ? "short" : "standard" });
        break;
      }
      case "review_request": {
        if (!prefs.sendReviewRequest) {
          logger.info("Skipping review_request, disabled by restaurant.", logContext);
          break;
        }
        if (bookingRecord.status !== "completed") {
          logger.info("Skipping review_request, booking not completed.", { ...logContext, status: bookingRecord.status });
          break;
        }
        await sendBookingReviewRequestEmail(bookingRecord);
        break;
      }
      case "booking_rejected": {
        // Assuming a 'rejected' status exists or that this is sent when a booking is deleted from a pending state.
        await sendBookingRejectedEmail(bookingRecord);
        break;
      }
      case "restaurant_cancellation": {
        // Assuming this is sent when a restaurant cancels a 'confirmed' booking.
        await sendRestaurantCancellationEmail(bookingRecord);
        break;
      }
      default: {
        throw new Error(`Unsupported email job type: ${(jobData as any).type}`);
      }
    }
    
    // 5. MARK AS PROCESSED for idempotency
    // Set key with a 48-hour expiry to be safe.
    await redis.set(idempotencyKey, "true", "EX", 60 * 60 * 48);

  } catch (error) {
    logger.error("Email job failed", { ...logContext, error: error instanceof Error ? error.message : String(error) });
    // Re-throw the error to let BullMQ handle the retry/failure and move to DLQ
    throw error;
  }
}

async function main(): Promise<void> {
  const worker = new Worker<EmailJobPayload>(
    EMAIL_QUEUE_NAME,
    async (bullJob) => {
      // The whole logic is now wrapped in processEmailJob
      await processEmailJob(bullJob);
    },
    {
      connection: getRedisConnection(),
      concurrency,
    },
  );

  const queueEvents = new QueueEvents(EMAIL_QUEUE_NAME, {
    connection: getRedisConnection(),
  });

  worker.on("failed", async (bullJob, err) => {
    if (!bullJob) {
      return;
    }
    const attemptsAllowed = bullJob.opts.attempts ?? 1;
    const attemptsMade = bullJob.attemptsMade;
    
    // This event is still useful for detailed logging
    await recordObservabilityEvent({
      source: "queue.email",
      eventType: "email_queue.failed_attempt",
      severity: attemptsMade >= attemptsAllowed ? "error" : "warning",
      restaurantId: bullJob.data.restaurantId ?? undefined,
      bookingId: bullJob.data.bookingId,
      context: {
        jobId: bullJob.id,
        attemptsMade,
        attemptsAllowed,
        type: bullJob.data.type,
        error: err instanceof Error ? err.message : String(err),
      },
    });

    // Manually moving to DLQ when all retries are exhausted
    if (attemptsMade >= attemptsAllowed) {
      logger.error("Job failed all retries, moving to DLQ", { jobId: bullJob.id, bookingId: bullJob.data.bookingId });
      const dlq = getEmailDlq();
      await dlq.add(
        "email-dlq",
        {
          ...bullJob.data,
          failedReason: err instanceof Error ? err.message : String(err),
          failedAt: new Date().toISOString(),
        },
        { removeOnComplete: true, removeOnFail: true }, // Clean up from DLQ if it fails/completes there
      );
    }
  });

  worker.on("completed", async (bullJob) => {
    if (!bullJob) return;
    // The original observability event is good, but we can add more context
    await recordObservabilityEvent({
      source: "queue.email",
      eventType: "email_queue.completed",
      restaurantId: bullJob.data.restaurantId ?? undefined,
      bookingId: bullJob.data.bookingId,
      context: {
        jobId: bullJob.id,
        attemptsMade: bullJob.attemptsMade,
        durationMs: bullJob.finishedOn && bullJob.processedOn
          ? bullJob.finishedOn - bullJob.processedOn
          : undefined,
        type: bullJob.data.type,
      },
    });
  });

  queueEvents.on("failed", async ({ jobId, failedReason }) => {
    // This event fires for internal queue errors, good to keep.
    await recordObservabilityEvent({
      source: "queue.email",
      eventType: "email_queue.event_failed",
      severity: "error",
      context: {
        jobId,
        failedReason,
      },
    });
  });

  const shutdown = async (signal: string) => {
    console.info(`[queue][email] Shutting down worker (${signal})`);
    await worker.close();
    await queueEvents.close();
    await closeRedisConnection();
    process.exit(0);
  };

  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });
  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });

  console.log(`[queue][email] Worker started (concurrency=${concurrency})`);
}

void main().catch(async (error) => {
  console.error("[queue][email] Worker failed to start", error);
  await closeRedisConnection();
  process.exit(1);
});
