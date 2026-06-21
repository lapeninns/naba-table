import { formatDualSyncSectionLabel, formatPublishJobTimestamp } from './dualSyncPublishJobsDomain';

import type { DualSyncPublishJobRollup } from '@/server/dual-sync/publish/operations';

export type DualSyncPublishJobStatus = 'success' | 'partial' | 'failed' | 'in-flight';

export interface DualSyncPublishJobRowViewModel {
  readonly id: string;
  readonly status: DualSyncPublishJobStatus;
  readonly shortId: string;
  readonly startedAtLabel: string;
  readonly durationLabel: string;
  readonly succeededCount: number;
  readonly failedCount: number;
  readonly skippedCount: number;
  readonly hasSkippedCount: boolean;
  readonly importCount: number;
  readonly exportCount: number;
  readonly hasImportCount: boolean;
  readonly hasExportCount: boolean;
  readonly errorCodes: readonly string[];
  readonly hasErrorCodes: boolean;
  readonly sectionLabels: readonly {
    readonly key: string;
    readonly label: string;
  }[];
}

export function shortenPublishJobId(id: string): string {
  return id.slice(0, 8);
}

export function getPublishJobDurationMs(job: DualSyncPublishJobRollup): number | null {
  if (!job.startedAt || !job.finishedAt) return null;
  const start = Date.parse(job.startedAt);
  const end = Date.parse(job.finishedAt);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return Math.max(0, end - start);
}

export function formatPublishJobDuration(ms: number | null): string {
  if (ms === null) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(2)}s`;
  return `${(ms / 60_000).toFixed(1)}m`;
}

export function getPublishJobStatus(job: DualSyncPublishJobRollup): DualSyncPublishJobStatus {
  if (job.otherCount > 0 || !job.finishedAt) return 'in-flight';
  if (job.failedCount === 0) return 'success';
  if (job.succeededCount > 0) return 'partial';
  return 'failed';
}

export function buildDualSyncPublishJobRowViewModel(
  job: DualSyncPublishJobRollup,
): DualSyncPublishJobRowViewModel {
  return {
    id: job.publishJobId,
    status: getPublishJobStatus(job),
    shortId: shortenPublishJobId(job.publishJobId),
    startedAtLabel: formatPublishJobTimestamp(job.startedAt),
    durationLabel: formatPublishJobDuration(getPublishJobDurationMs(job)),
    succeededCount: job.succeededCount,
    failedCount: job.failedCount,
    skippedCount: job.skippedCount,
    hasSkippedCount: job.skippedCount > 0,
    importCount: job.importCount,
    exportCount: job.exportCount,
    hasImportCount: job.importCount > 0,
    hasExportCount: job.exportCount > 0,
    errorCodes: job.errorCodes,
    hasErrorCodes: job.errorCodes.length > 0,
    sectionLabels: job.sections.map((section) => ({
      key: section,
      label: formatDualSyncSectionLabel(section),
    })),
  };
}
