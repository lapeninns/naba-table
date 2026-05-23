import { formatDualSyncTimestamp } from '../../dualSyncFormattingDomain';

import type { DualSyncToastIntent } from '../../dualSyncShellActionDomain';
import type { DualSyncJob, DualSyncJobKind, DualSyncJobStatus } from '@/server/dual-sync';
import type { ListDualSyncJobsResponse } from '@/services/ops/dual-sync';

export type DualSyncQueueJobStatusIconKey = 'success' | 'failure' | 'retrying' | 'pending';

export interface DualSyncQueueJobsPanelModel {
  readonly jobs: ReadonlyArray<DualSyncJob>;
}

export const DUAL_SYNC_QUEUE_JOB_STATUS_LABEL: Record<DualSyncJobStatus, string> = {
  queued: 'Queued',
  running: 'Running',
  succeeded: 'Succeeded',
  failed: 'Failed',
  retrying: 'Retrying',
  dead_letter: 'Dead letter',
  cancelled: 'Cancelled',
};

export const DUAL_SYNC_QUEUE_JOB_STATUS_VARIANT: Record<
  DualSyncJobStatus,
  'status-confirmed' | 'status-pending' | 'status-cancelled' | 'status-completed'
> = {
  queued: 'status-pending',
  running: 'status-pending',
  succeeded: 'status-confirmed',
  failed: 'status-cancelled',
  retrying: 'status-pending',
  dead_letter: 'status-cancelled',
  cancelled: 'status-completed',
};

export const DUAL_SYNC_QUEUE_JOB_KIND_LABEL: Record<DualSyncJobKind, string> = {
  google_refresh_manual: 'Manual refresh',
  google_refresh_scheduled: 'Scheduled refresh',
  core_write_recompute: 'Core recompute',
  publish_batch: 'Publish batch',
  auto_export: 'Auto-export',
  mirror_refresh_after_publish: 'Mirror refresh',
};

const RETRYABLE_STATUSES: ReadonlyArray<DualSyncJobStatus> = ['failed', 'dead_letter', 'cancelled'];

export function formatQueueJobTimestamp(value: string | null): string {
  return formatDualSyncTimestamp(value, { emptyFallback: '-' });
}

export function getQueueJobStatusIconKey(status: DualSyncJobStatus): DualSyncQueueJobStatusIconKey {
  if (status === 'succeeded') return 'success';
  if (status === 'failed' || status === 'dead_letter' || status === 'cancelled') return 'failure';
  if (status === 'retrying') return 'retrying';
  return 'pending';
}

export function canRetryQueueJob(job: DualSyncJob): boolean {
  return RETRYABLE_STATUSES.includes(job.status);
}

export function formatQueueJobShortId(job: DualSyncJob): string {
  return job.id.slice(0, 8);
}

export function formatQueueJobErrorPreview(message: string, maxLength = 96): string {
  return message.length > maxLength ? `${message.slice(0, maxLength)}...` : message;
}

export function buildDualSyncQueueJobsPanelModel(
  response: ListDualSyncJobsResponse | null | undefined,
): DualSyncQueueJobsPanelModel {
  return {
    jobs: response?.jobs ?? [],
  };
}

export function getDualSyncQueueJobRetrySuccessToastIntent(): DualSyncToastIntent {
  return {
    kind: 'success',
    message: 'Queue job requeued.',
  };
}

export function getDualSyncQueueJobRetryErrorToastIntent(error: unknown): DualSyncToastIntent {
  return {
    kind: 'error',
    message: error instanceof Error ? error.message : 'Queue job retry failed.',
  };
}
