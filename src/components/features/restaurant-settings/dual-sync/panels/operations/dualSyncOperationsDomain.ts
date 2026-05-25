import {
  formatDualSyncDirectionLabel,
  getDualSyncDirectionIconKey,
  type DualSyncDirectionIconKey,
} from '../../dualSyncDirectionDomain';
import { formatDualSyncTimestamp } from '../../dualSyncFormattingDomain';

import type { DualSyncPublishOperation, DualSyncPublishOperationStatus } from '@/server/dual-sync';
import type { ListDualSyncOperationsResponse } from '@/services/ops/dual-sync';

export type DualSyncOperationStatusIconKey = 'success' | 'failure' | 'skipped' | 'pending';

export interface DualSyncOperationsPanelModel {
  readonly operations: ReadonlyArray<DualSyncPublishOperation>;
}

export const DUAL_SYNC_OPERATION_STATUS_LABEL: Record<DualSyncPublishOperationStatus, string> = {
  pending: 'Pending',
  running: 'Running',
  succeeded: 'Succeeded',
  failed: 'Failed',
  skipped: 'Skipped',
  retrying: 'Retrying',
};

export const DUAL_SYNC_OPERATION_STATUS_VARIANT: Record<
  DualSyncPublishOperationStatus,
  'status-confirmed' | 'status-pending' | 'status-cancelled' | 'status-completed'
> = {
  pending: 'status-pending',
  running: 'status-pending',
  succeeded: 'status-confirmed',
  failed: 'status-cancelled',
  skipped: 'status-completed',
  retrying: 'status-pending',
};

export function getOperationStatusIconKey(
  status: DualSyncPublishOperationStatus,
): DualSyncOperationStatusIconKey {
  if (status === 'succeeded') return 'success';
  if (status === 'failed') return 'failure';
  if (status === 'skipped') return 'skipped';
  return 'pending';
}

export function formatOperationTimestamp(value: string | null): string {
  return formatDualSyncTimestamp(value, { emptyFallback: '—' });
}

export function getOperationDurationMs(op: DualSyncPublishOperation): number | null {
  if (!op.startedAt || !op.finishedAt) return null;
  const start = Date.parse(op.startedAt);
  const end = Date.parse(op.finishedAt);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return end - start;
}

export function formatOperationDuration(ms: number | null): string {
  if (ms === null) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export function getOperationDirectionLabel(
  direction: DualSyncPublishOperation['direction'],
): 'Import' | 'Export' {
  return formatDualSyncDirectionLabel(direction) as 'Import' | 'Export';
}

export function getOperationDirectionIconKey(
  direction: DualSyncPublishOperation['direction'],
): DualSyncDirectionIconKey {
  return getDualSyncDirectionIconKey(direction);
}

export function buildDualSyncOperationsPanelModel(
  response: ListDualSyncOperationsResponse | null | undefined,
): DualSyncOperationsPanelModel {
  return {
    operations: response?.operations ?? [],
  };
}
