import { formatDualSyncTimestamp } from './dualSyncFormattingDomain';

import type { DualSyncPublishResponse } from '@/services/ops/dual-sync';

export const DUAL_SYNC_PUBLISH_RESULT_STATUS_VARIANT: Record<
  string,
  'status-confirmed' | 'status-pending' | 'status-cancelled'
> = {
  succeeded: 'status-confirmed',
  failed: 'status-cancelled',
  skipped: 'status-pending',
  retrying: 'status-pending',
  pending: 'status-pending',
  running: 'status-pending',
};

export function formatPublishResultTimestamp(value: string | null | undefined): string {
  return formatDualSyncTimestamp(value, { emptyFallback: '-' });
}

export function getPublishResultTitle(
  result: DualSyncPublishResponse | null,
  purpose: 'publish' | 'import' = 'publish',
): string {
  if (purpose === 'import') {
    if (!result) return 'Google values';
    if (result.failedCount > 0) return 'Some Google values were not saved';
    if (result.succeededCount > 0) return 'Google values saved in Nabatable';
    return 'No Google values were saved';
  }
  if (!result) return 'Publish result';
  if (result.failedCount > 0) return 'Publish completed with failures';
  if (result.succeededCount > 0) return 'Publish completed';
  return 'No fields were published';
}

export function getPublishResultStatusVariant(
  status: string,
): 'status-confirmed' | 'status-pending' | 'status-cancelled' {
  return DUAL_SYNC_PUBLISH_RESULT_STATUS_VARIANT[status] ?? 'status-pending';
}

export interface DualSyncPublishOperationTableRow {
  readonly id: string;
  readonly status: string;
  readonly statusVariant: ReturnType<typeof getPublishResultStatusVariant>;
  readonly fieldKey: string;
  readonly errorCode: string | null;
  readonly direction: string;
  readonly maskLabel: string;
  readonly finishedAtLabel: string;
}

export function buildDualSyncPublishOperationTableRows(
  operations: DualSyncPublishResponse['operations'],
): ReadonlyArray<DualSyncPublishOperationTableRow> {
  return operations.map((operation) => ({
    id: operation.id,
    status: operation.status,
    statusVariant: getPublishResultStatusVariant(operation.status),
    fieldKey: operation.fieldKey,
    errorCode: operation.errorCode ?? null,
    direction: operation.direction,
    maskLabel: operation.googleUpdateMask ?? '-',
    finishedAtLabel: formatPublishResultTimestamp(operation.finishedAt),
  }));
}
