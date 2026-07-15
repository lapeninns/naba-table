export type JsonObject = Record<string, unknown>;

export type GatewayStub = {
  fetch: (request: Request) => Promise<Response>;
};

export type GatewayBinding<Id> = {
  get: (id: Id) => GatewayStub;
  idFromName: (name: string) => Id;
};

export type EmailQueueGatewayEnv<Id = DurableObjectId> = {
  APP_PROCESS_EMAILS_TOKEN: string;
  APP_PROCESS_EMAILS_URL: string;
  CAPACITY_VERSION_STATE: GatewayBinding<Id>;
  EMAIL_QUEUE_STATE: GatewayBinding<Id>;
  GATEWAY_TOKEN: string;
  RATE_LIMIT_STATE: GatewayBinding<Id>;
  DEPLOY_SHA?: string;
  ERROR_INSIGHT_TOKEN?: string;
  ERROR_INSIGHT_WEBHOOK_URL?: string;
  POSTHOG_PROJECT_API_KEY?: string;
  POSTHOG_HOST?: string;
  CF_VERSION_METADATA?: { id: string; tag: string; timestamp: string };
};

export type QueueJobPayload = JsonObject & {
  bookingId: string;
  type: string;
  cronAttemptsMade?: number;
};

export type QueueJob = {
  id: string;
  queue: string;
  dlq: string;
  payload: QueueJobPayload;
  attempts: number;
  attemptsMade: number;
  backoff: unknown;
  scheduledAt: number;
  createdAt: number;
  updatedAt: number;
  status: 'active' | 'delayed' | 'failed' | 'waiting';
  lastError: string | null;
  failedAt?: string;
};

export type QueueMeta = {
  completedCount: number;
};

export type ProcessingResult = {
  jobId: string;
  success: boolean;
  error?: string;
};

export type BatchStats = {
  sent: number;
  skipped: number;
  failed: number;
};

export type BatchResult = {
  success: boolean;
  processed: number;
  stats: BatchStats;
  results: ProcessingResult[];
};

export type ProcessDueJobsOptions = {
  types: string[] | null;
  maxJobs: number;
};

export function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isQueueJobPayload(value: unknown): value is QueueJobPayload {
  return (
    isJsonObject(value) && typeof value.bookingId === 'string' && typeof value.type === 'string'
  );
}

export function isBatchResult(value: unknown): value is BatchResult {
  if (!isJsonObject(value) || typeof value.success !== 'boolean') {
    return false;
  }

  if (!isJsonObject(value.stats) || !Array.isArray(value.results)) {
    return false;
  }

  const stats = value.stats;
  return (
    typeof value.processed === 'number' &&
    typeof stats.sent === 'number' &&
    typeof stats.skipped === 'number' &&
    typeof stats.failed === 'number' &&
    value.results.every(
      (result) =>
        isJsonObject(result) &&
        typeof result.jobId === 'string' &&
        typeof result.success === 'boolean' &&
        (result.error === undefined || typeof result.error === 'string'),
    )
  );
}
