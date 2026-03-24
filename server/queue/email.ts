import {
  extractCloudflareGatewayError,
  isCloudflareGatewayConfigured,
  requestCloudflareGateway,
} from '@/server/cloudflare/gateway';
import { recordObservabilityEvent } from '@/server/observability';

export type EmailJobType =
  | 'request_received'
  | 'confirmation'
  | 'updated'
  | 'cancelled'
  | 'reminder_24h'
  | 'reminder_short'
  | 'review_request'
  | 'booking_rejected'
  | 'restaurant_cancellation';

export type EmailJobPayload = {
  bookingId: string;
  restaurantId: string | null;
  type: EmailJobType;
  scheduledFor?: string | null;
  failedReason?: string | null;
  failedAt?: string | null;
  cronAttemptsMade?: number | null;
};

export const EMAIL_QUEUE_NAME = 'pending-booking-emails';
export const EMAIL_DLQ_NAME = `${EMAIL_QUEUE_NAME}-dlq`;

const DEFAULT_ATTEMPTS = 5;
const DEFAULT_BACKOFF = { type: 'exponential', delay: 60_000 } as const;
const EMAIL_JOB_ID_SEPARATOR = '__';
const ENQUEUE_RETRY_ATTEMPTS = 3;
const ENQUEUE_RETRY_BASE_DELAY_MS = 50;
export type QueueJobSummary = {
  id: string;
  payload: EmailJobPayload;
  scheduledFor?: string | null;
  status?: string | null;
};

export type EmailQueueStatusSnapshot = {
  status: 'ok' | 'disabled';
  provider: 'cloudflare';
  queue: {
    name: string;
    dlqName: string;
    counts: {
      waiting: number;
      active: number;
      completed: number;
      failed: number;
      delayed: number;
      total: number;
      dlq?: number | null;
    };
    jobs?: {
      waiting?: QueueJobSummary[];
      active?: QueueJobSummary[];
      failed?: QueueJobSummary[];
      delayed?: QueueJobSummary[];
      dlq?: QueueJobSummary[];
    } | null;
  };
  timestamp: string;
};

export type EmailQueueDrainResult = {
  success: boolean;
  message?: string;
  processed?: number;
  stats?: {
    sent: number;
    skipped: number;
    failed: number;
  };
  results?: Array<{ jobId: string; success: boolean; skipped?: boolean; error?: string }>;
  filterTypes?: EmailJobType[] | null;
  debug?: Record<string, number | string | null | string[]>;
};

function buildEmailJobId(type: EmailJobType, bookingId: string): string {
  return `email${EMAIL_JOB_ID_SEPARATOR}${type}${EMAIL_JOB_ID_SEPARATOR}${bookingId}`;
}

function sanitizeEmailJobId(jobId: string): string {
  return jobId.replace(/:/g, EMAIL_JOB_ID_SEPARATOR);
}

export function isEmailQueueGatewayConfigured(): boolean {
  return isCloudflareGatewayConfigured();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type EnqueueEmailOptions = {
  jobId?: string;
  delayMs?: number;
  attempts?: number;
  backoff?: unknown;
};

function isDuplicateJobResponse(response: Response, body: unknown): boolean {
  if (response.status === 409) {
    return true;
  }

  if (!body || typeof body !== 'object') {
    return false;
  }

  const candidate = body as { duplicate?: unknown; status?: unknown };
  return candidate.duplicate === true || candidate.status === 'duplicate';
}

export async function enqueueEmailJob(
  payload: EmailJobPayload,
  options: EnqueueEmailOptions = {},
): Promise<void> {
  const jobId = sanitizeEmailJobId(options.jobId ?? buildEmailJobId(payload.type, payload.bookingId));
  const delay = Math.max(0, Math.floor(options.delayMs ?? 0));
  const attempts = options.attempts ?? DEFAULT_ATTEMPTS;
  const backoff = options.backoff ?? DEFAULT_BACKOFF;

  try {
    let lastError: unknown = null;
    for (let attempt = 1; attempt <= ENQUEUE_RETRY_ATTEMPTS; attempt += 1) {
      try {
        const { response, body } = await requestCloudflareGateway<{ duplicate?: boolean; status?: string }>(
          '/messages',
          {
            method: 'POST',
            body: JSON.stringify({
              queue: EMAIL_QUEUE_NAME,
              dlq: EMAIL_DLQ_NAME,
              jobId,
              delayMs: delay,
              attempts,
              backoff,
              payload,
            }),
          },
        );

        if (!response.ok && !isDuplicateJobResponse(response, body)) {
          throw new Error(
            extractCloudflareGatewayError(body, `Gateway enqueue failed with status ${response.status}`),
          );
        }

        if (isDuplicateJobResponse(response, body)) {
          return;
        }

        if (process.env.NODE_ENV !== 'production') {
          console.log('[queue][email] job enqueued', { jobId, delay, queue: EMAIL_QUEUE_NAME });
        }
        return;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.toLowerCase().includes('duplicate')) {
          return;
        }
        lastError = error;
        if (attempt >= ENQUEUE_RETRY_ATTEMPTS) {
          break;
        }
        const backoffMs = ENQUEUE_RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
        await sleep(backoffMs);
      }
    }

    const message = lastError instanceof Error ? lastError.message : String(lastError);
    throw new Error(message);
  } catch (error) {
    console.error('[queue][email] failed to add job', {
      jobId,
      bookingId: payload.bookingId,
      type: payload.type,
      delay,
      error: error instanceof Error ? error.message : String(error),
    });
    await recordObservabilityEvent({
      source: 'queue.email',
      eventType: 'email_queue.enqueue_failed',
      severity: 'error',
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
  const normalizedId = sanitizeEmailJobId(jobId);
  try {
    const { response } = await requestCloudflareGateway(`/messages/${encodeURIComponent(normalizedId)}`, {
      method: 'DELETE',
    });
    if (response.status === 404) {
      return false;
    }
    return response.ok;
  } catch (error) {
    console.warn('[queue] failed to remove job', {
      jobId,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

export async function getEmailQueueStatus(
  includeJobs = false,
  options?: {
    jobLimit?: number | 'all';
  },
): Promise<EmailQueueStatusSnapshot> {
  const queryParams = new URLSearchParams();
  if (includeJobs) {
    queryParams.set('includeJobs', '1');
  }
  if (includeJobs && options?.jobLimit !== undefined) {
    queryParams.set('jobLimit', String(options.jobLimit));
  }
  const query = queryParams.size > 0 ? `?${queryParams.toString()}` : '';
  const { response, body } = await requestCloudflareGateway<EmailQueueStatusSnapshot>(`/status${query}`, {
    method: 'GET',
  });

  if (!response.ok || !body) {
    throw new Error(
      extractCloudflareGatewayError(body, `Gateway status request failed with status ${response.status}`),
    );
  }

  return body;
}

export async function triggerEmailQueueDrain(params?: {
  types?: EmailJobType[] | Set<EmailJobType> | null;
  maxJobs?: number | null;
}): Promise<EmailQueueDrainResult> {
  const types =
    params?.types instanceof Set
      ? Array.from(params.types)
      : Array.isArray(params?.types)
        ? params?.types
        : null;

  const { response, body } = await requestCloudflareGateway<EmailQueueDrainResult>('/drain', {
    method: 'POST',
    body: JSON.stringify({
      queue: EMAIL_QUEUE_NAME,
      dlq: EMAIL_DLQ_NAME,
      types,
      maxJobs: params?.maxJobs ?? null,
    }),
  });

  if (!response.ok || !body) {
    throw new Error(
      extractCloudflareGatewayError(body, `Gateway drain request failed with status ${response.status}`),
    );
  }

  return body;
}
