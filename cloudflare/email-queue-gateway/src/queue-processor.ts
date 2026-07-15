import { isBatchResult, isJsonObject } from './contracts';
import { dlqKey, jobKey, MAX_SCAN, parseBackoffDelay, scheduleKey } from './queue-storage';

import type {
  BatchResult,
  ProcessDueJobsOptions,
  ProcessingResult,
  QueueJob,
  QueueMeta,
} from './contracts';

export type QueueProcessorStorage = {
  list: <Value>(options: { prefix: string; limit?: number }) => Promise<Map<string, Value>>;
  get: <Value>(key: string) => Promise<Value | undefined>;
  put: (key: string, value: unknown) => Promise<void>;
  delete: (key: string) => Promise<boolean>;
};

export type QueueProcessorContext = {
  storage: QueueProcessorStorage;
  appProcessingUrl: string;
  appProcessingToken: string;
  getMeta: () => Promise<QueueMeta>;
  putMeta: (meta: QueueMeta) => Promise<void>;
  scheduleNextAlarm: () => Promise<void>;
};

export async function processDueJobs(
  context: QueueProcessorContext,
  { types, maxJobs }: ProcessDueJobsOptions,
) {
  const now = Date.now();
  const selected: QueueJob[] = [];
  const scheduleEntries = await context.storage.list<string>({
    prefix: 'schedule:',
    limit: MAX_SCAN,
  });

  for (const [key, storedJobId] of scheduleEntries) {
    if (selected.length >= maxJobs) break;

    const [, timestampPart, jobIdFromKey] = key.split(':');
    const scheduledAt = Number(timestampPart);
    const jobId = typeof storedJobId === 'string' ? storedJobId : jobIdFromKey;

    if (!jobId) continue;
    if (!Number.isFinite(scheduledAt)) continue;
    if (scheduledAt > now) break;

    const job = await context.storage.get<QueueJob>(jobKey(jobId));
    if (!job) {
      await context.storage.delete(key);
      continue;
    }

    if (types && !types.includes(job.payload.type)) {
      continue;
    }

    selected.push(job);
    job.status = 'active';
    job.updatedAt = now;
    await context.storage.put(jobKey(jobId), job);
    await context.storage.delete(key);
  }

  if (selected.length === 0) {
    await context.scheduleNextAlarm();
    return {
      success: true,
      message: 'No pending emails to process',
      processed: 0,
      stats: { sent: 0, skipped: 0, failed: 0 },
      results: [],
      filterTypes: types,
    };
  }

  let batchResult: BatchResult;
  try {
    const response = await fetch(context.appProcessingUrl, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${context.appProcessingToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        jobs: selected.map((job) => ({ id: job.id, payload: job.payload })),
      }),
    });

    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok || !isBatchResult(payload) || payload.success !== true) {
      const providerError =
        isJsonObject(payload) && typeof payload.error === 'string' ? payload.error : null;
      throw new Error(providerError ?? `App processing failed with status ${response.status}`);
    }
    batchResult = payload;
  } catch (error) {
    batchResult = {
      success: false,
      processed: selected.length,
      stats: { sent: 0, skipped: 0, failed: selected.length },
      results: selected.map((job) => ({
        jobId: job.id,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      })),
    };
  }

  const meta = await context.getMeta();
  const resultsById = new Map<string, ProcessingResult>(
    batchResult.results.map((result) => [result.jobId, result]),
  );

  for (const job of selected) {
    const result = resultsById.get(job.id) ?? {
      jobId: job.id,
      success: false,
      error: 'Missing processing result',
    };

    if (result.success) {
      await context.storage.delete(jobKey(job.id));
      meta.completedCount = (meta.completedCount ?? 0) + 1;
      continue;
    }

    const nextAttempt = (job.attemptsMade ?? 0) + 1;
    const errorMessage =
      typeof result.error === 'string' && result.error.length > 0
        ? result.error
        : 'Unknown processing error';

    if (nextAttempt >= job.attempts) {
      const failedRecord = {
        ...job,
        status: 'failed',
        attemptsMade: nextAttempt,
        failedAt: new Date().toISOString(),
        lastError: errorMessage,
      };
      await context.storage.delete(jobKey(job.id));
      await context.storage.put(dlqKey(job.id), failedRecord);
      continue;
    }

    const retryDelayMs = parseBackoffDelay(job.backoff, nextAttempt);
    const retryScheduledAt = Date.now() + retryDelayMs;
    const retriedJob = {
      ...job,
      attemptsMade: nextAttempt,
      updatedAt: Date.now(),
      scheduledAt: retryScheduledAt,
      status: retryDelayMs > 0 ? 'delayed' : 'waiting',
      lastError: errorMessage,
      payload: {
        ...job.payload,
        cronAttemptsMade: nextAttempt,
        failedReason: errorMessage,
        failedAt: new Date().toISOString(),
      },
    };

    await context.storage.put(jobKey(job.id), retriedJob);
    await context.storage.put(scheduleKey(retryScheduledAt, job.id), job.id);
  }

  await context.putMeta(meta);
  await context.scheduleNextAlarm();

  return {
    success: true,
    message: `Processed ${selected.length} jobs`,
    processed: selected.length,
    stats: batchResult.stats,
    results: batchResult.results,
    filterTypes: types,
  };
}
