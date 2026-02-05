import { Queue, QueueEvents, type JobsOptions } from "bullmq";

import { getRedisConnection } from "@/lib/queue/redis";
import { recordObservabilityEvent } from "@/server/observability";

export type EmailJobType =
  | "request_received"
  | "confirmation"
  | "updated"
  | "cancelled"
  | "reminder_24h"
  | "reminder_short"
  | "review_request"
  | "booking_rejected"
  | "restaurant_cancellation";

export type EmailJobPayload = {
  bookingId: string;
  restaurantId: string | null;
  type: EmailJobType;
  scheduledFor?: string | null;
  failedReason?: string | null;
  failedAt?: string | null;
  // Cron-based processing does not run with a BullMQ worker lock token, so we track retry attempts
  // in the job payload when re-enqueuing with backoff.
  cronAttemptsMade?: number | null;
};

export const EMAIL_QUEUE_NAME = "pending-booking-emails";
export const EMAIL_DLQ_NAME = `${EMAIL_QUEUE_NAME}-dlq`;

const DEFAULT_ATTEMPTS = 5;
const DEFAULT_BACKOFF = { type: "exponential", delay: 60_000 } as const;
const EMAIL_JOB_ID_SEPARATOR = "__";
const ENQUEUE_RETRY_ATTEMPTS = 3;
const ENQUEUE_RETRY_BASE_DELAY_MS = 50;

let emailQueue: Queue<EmailJobPayload> | null = null;
let emailDlq: Queue<EmailJobPayload> | null = null;

function isDuplicateJobIdError(error: unknown): boolean {
  if (!error) return false;
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error !== null && "message" in error
        ? String((error as { message?: unknown }).message)
        : String(error);

  // BullMQ throws when a job with the same jobId already exists. This is an idempotent outcome
  // for our email scheduling layer (the existing job is the single source of truth).
  return message.toLowerCase().includes("job") && message.toLowerCase().includes("already exists");
}

function buildEmailJobId(type: EmailJobType, bookingId: string): string {
  return `email${EMAIL_JOB_ID_SEPARATOR}${type}${EMAIL_JOB_ID_SEPARATOR}${bookingId}`;
}

function sanitizeEmailJobId(jobId: string): string {
  return jobId.replace(/:/g, EMAIL_JOB_ID_SEPARATOR);
}

function ensureQueueSetup(): void {
  if (!emailQueue) {
    emailQueue = new Queue<EmailJobPayload>(EMAIL_QUEUE_NAME, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: false,
        attempts: DEFAULT_ATTEMPTS,
        backoff: DEFAULT_BACKOFF,
      },
    });
  }

  if (!emailDlq) {
    emailDlq = new Queue<EmailJobPayload>(EMAIL_DLQ_NAME, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        removeOnComplete: false,
        removeOnFail: false,
      },
    });
  }
}

export function getEmailQueue(): Queue<EmailJobPayload> {
  ensureQueueSetup();
  return emailQueue!;
}

export function getEmailDlq(): Queue<EmailJobPayload> {
  ensureQueueSetup();
  return emailDlq!;
}

export function createEmailQueueEvents(): QueueEvents {
  ensureQueueSetup();
  return new QueueEvents(EMAIL_QUEUE_NAME, { connection: getRedisConnection() });
}

type EnqueueEmailOptions = {
  jobId?: string;
  delayMs?: number;
  attempts?: number;
  backoff?: JobsOptions["backoff"];
};

export async function enqueueEmailJob(payload: EmailJobPayload, options: EnqueueEmailOptions = {}): Promise<void> {
  const queue = getEmailQueue();
  const jobId = sanitizeEmailJobId(options.jobId ?? buildEmailJobId(payload.type, payload.bookingId));
  const delay = Math.max(0, Math.floor(options.delayMs ?? 0));
  const attempts = options.attempts ?? DEFAULT_ATTEMPTS;
  const backoff = options.backoff ?? DEFAULT_BACKOFF;

  try {
    let lastError: unknown = null;
    for (let attempt = 1; attempt <= ENQUEUE_RETRY_ATTEMPTS; attempt += 1) {
      try {
        await queue.add("pending-booking-email", payload, {
          jobId,
          delay,
          attempts,
          backoff,
          removeOnComplete: true,
          removeOnFail: false,
        });

        // Avoid noisy logs in production. Observability events cover failures.
        if (process.env.NODE_ENV !== "production") {
          console.log(`[queue][email] job enqueued`, { jobId, delay, queue: queue.name });
        }
        return;
      } catch (error) {
        if (isDuplicateJobIdError(error)) {
          // Treat duplicates as success. The existing job will be processed by the worker/cron.
          return;
        }
        lastError = error;
        if (attempt >= ENQUEUE_RETRY_ATTEMPTS) {
          break;
        }
        const backoffMs = ENQUEUE_RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    }

    const message = lastError instanceof Error ? lastError.message : String(lastError);
    throw new Error(message);
  } catch (error) {
    console.error(`[queue][email] failed to add job`, {
      jobId,
      bookingId: payload.bookingId,
      type: payload.type,
      delay,
      error: error instanceof Error ? error.message : String(error),
    });
    await recordObservabilityEvent({
      source: "queue.email",
      eventType: "email_queue.enqueue_failed",
      severity: "error",
      context: {
        jobId,
        bookingId: payload.bookingId,
        type: payload.type,
        delay,
        error: error instanceof Error ? error.message : String(error),
      },
      restaurantId: payload.restaurantId ?? undefined,
      bookingId: payload.bookingId,
    });
    throw error;
  }
}

export async function removeEmailJob(jobId: string): Promise<boolean> {
  const queue = getEmailQueue();
  const normalizedId = sanitizeEmailJobId(jobId);
  let job = await queue.getJob(normalizedId);
  if (!job && normalizedId !== jobId) {
    job = await queue.getJob(jobId);
  }
  if (job) {
    try {
      await job.remove();
      return true;
    } catch (error) {
      console.warn(`[queue] failed to remove job ${jobId}`, error);
      return false;
    }
  }
  return false;
}
