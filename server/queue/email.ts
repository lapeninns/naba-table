import { Queue, QueueEvents, type JobsOptions } from "bullmq";

import { EMAIL_JOB_TYPES, type EmailJobType } from "@/lib/queue/email-types";
import { getRedisConnection } from "@/lib/queue/redis";
import { recordObservabilityEvent } from "@/server/observability";

export { EMAIL_JOB_TYPES };
export type { EmailJobType };

export type EmailJobPayload = {
  bookingId: string;
  restaurantId: string | null;
  type: EmailJobType;
  scheduledFor?: string | null;
  failedReason?: string | null;
  failedAt?: string | null;
};

export const EMAIL_QUEUE_NAME = "pending-booking-emails";
export const EMAIL_DLQ_NAME = `${EMAIL_QUEUE_NAME}-dlq`;

const DEFAULT_ATTEMPTS = 5;
const DEFAULT_BACKOFF = { type: "exponential", delay: 60_000 } as const;
const EMAIL_JOB_ID_SEPARATOR = "__";

let emailQueue: Queue<EmailJobPayload> | null = null;
let emailDlq: Queue<EmailJobPayload> | null = null;

function buildEmailJobId(type: EmailJobType, bookingId: string): string {
  return `email${EMAIL_JOB_ID_SEPARATOR}${type}${EMAIL_JOB_ID_SEPARATOR}${bookingId}`;
}

function sanitizeEmailJobId(jobId: string): string {
  return jobId.replace(/:/g, EMAIL_JOB_ID_SEPARATOR);
}

export function getEmailJobId(type: EmailJobType, bookingId: string): string {
  return sanitizeEmailJobId(buildEmailJobId(type, bookingId));
}

export function getEmailJobIdCandidates(type: EmailJobType, bookingId: string): string[] {
  const raw = buildEmailJobId(type, bookingId);
  const sanitized = sanitizeEmailJobId(raw);
  return sanitized === raw ? [raw] : [sanitized, raw];
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
    const job = await queue.add("pending-booking-email", payload, {
      jobId,
      delay,
      attempts,
      backoff,
      removeOnComplete: true,
      removeOnFail: false,
    });
    console.log(`[queue][email] ✅ Job added: ${job.id}, delay: ${delay}ms, queue: ${queue.name}`);
  } catch (error) {
    console.error(`[queue][email] ❌ Failed to add job: ${jobId}`, error);
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
