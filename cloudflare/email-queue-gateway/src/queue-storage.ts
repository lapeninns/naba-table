import { isJsonObject } from './contracts';

import type { QueueJob } from './contracts';

export const DEFAULT_MAX_JOBS = 25;
export const MAX_SCAN = 200;

const JOB_HISTORY_LIMIT = 10;
const JOB_HISTORY_LIMIT_ALL = 'all';

export function scheduleKey(scheduledAt: number, jobId: string): string {
  return `schedule:${String(scheduledAt).padStart(15, '0')}:${jobId}`;
}

export function jobKey(jobId: string): string {
  return `job:${jobId}`;
}

export function dlqKey(jobId: string): string {
  return `dlq:${jobId}`;
}

export function parseBackoffDelay(backoff: unknown, attempt: number): number {
  if (!isJsonObject(backoff)) {
    return 60_000;
  }

  const type = typeof backoff.type === 'string' ? backoff.type : 'exponential';
  const baseDelay =
    typeof backoff.delay === 'number' && Number.isFinite(backoff.delay) && backoff.delay > 0
      ? Math.floor(backoff.delay)
      : 60_000;

  if (type === 'fixed') {
    return baseDelay;
  }

  return Math.min(30 * 60_000, baseDelay * Math.pow(2, Math.max(0, attempt - 1)));
}

export function normalizeMaxJobs(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_MAX_JOBS;
  }
  return Math.max(1, Math.min(100, Math.floor(value)));
}

export function normalizeJobHistoryLimit(value: string | null): number {
  if (typeof value === 'string' && value.trim().toLowerCase() === JOB_HISTORY_LIMIT_ALL) {
    return Number.POSITIVE_INFINITY;
  }

  const parsed = typeof value === 'string' ? Number.parseInt(value, 10) : Number.NaN;
  if (!Number.isFinite(parsed)) {
    return JOB_HISTORY_LIMIT;
  }

  return Math.max(1, Math.min(5_000, Math.floor(parsed)));
}

export function toJobSummary(job: QueueJob): {
  id: string;
  payload: QueueJob['payload'];
  scheduledFor: string | null;
  status: QueueJob['status'];
} {
  return {
    id: job.id,
    payload: job.payload,
    scheduledFor: typeof job.payload?.scheduledFor === 'string' ? job.payload.scheduledFor : null,
    status: job.status ?? null,
  };
}
