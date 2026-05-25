import { formatDualSyncSectionLabel, formatPublishJobTimestamp } from './dualSyncPublishJobsDomain';
import {
  formatDualSyncDirectionToken,
  getDualSyncDirectionIconKey,
  type DualSyncDirectionIconKey,
} from '../../dualSyncDirectionDomain';

import type {
  DualSyncPublishBatch,
  DualSyncPublishOperation,
  DualSyncPublishOperationGroup,
} from '@/server/dual-sync';
import type { DualSyncPublishJobDetail } from '@/server/dual-sync/publish/operations';

export const DUAL_SYNC_OPERATION_STATUS_VARIANTS: Record<
  string,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  succeeded: 'default',
  failed: 'destructive',
  skipped: 'outline',
  pending: 'secondary',
  running: 'secondary',
  retrying: 'secondary',
};

export interface DualSyncPublishBatchViewModel {
  readonly id: string;
  readonly status: string;
  readonly acceptedCount: number;
  readonly rejectedCount: number;
  readonly ignoredCount: number;
  readonly clientRequestLabel: string;
}

export interface DualSyncOperationGroupViewModel {
  readonly id: string;
  readonly status: string;
  readonly statusVariant: 'default' | 'secondary' | 'destructive' | 'outline';
  readonly errorCode: string | null;
  readonly writeGroup: string;
  readonly sectionLabel: string;
  readonly preflightLabel: string;
  readonly decisionCount: number;
  readonly masksLabel: string;
}

export interface DualSyncPublishOperationViewModel {
  readonly id: string;
  readonly status: string;
  readonly statusVariant: 'default' | 'secondary' | 'destructive' | 'outline';
  readonly fieldKey: string;
  readonly direction: 'import_from_google' | 'export_to_google';
  readonly directionIconKey: DualSyncDirectionIconKey;
  readonly directionLabel: string;
  readonly startedAtLabel: string;
  readonly errorCode: string | null;
  readonly errorMessage: string | null;
  readonly errorPreview: string | null;
}

export function hasDualSyncPublishJobDetailRecords(detail: DualSyncPublishJobDetail): boolean {
  return detail.operations.length > 0 || detail.operationGroups.length > 0 || detail.batch !== null;
}

export function buildDualSyncPublishBatchViewModel(
  batch: DualSyncPublishBatch,
): DualSyncPublishBatchViewModel {
  return {
    id: batch.id,
    status: batch.status,
    acceptedCount: batch.acceptedCount,
    rejectedCount: batch.rejectedCount,
    ignoredCount: batch.ignoredCount,
    clientRequestLabel: batch.clientRequestId ? batch.clientRequestId : 'no client request',
  };
}

export function buildDualSyncOperationGroupViewModel(
  group: DualSyncPublishOperationGroup,
): DualSyncOperationGroupViewModel {
  return {
    id: group.id,
    status: group.status,
    statusVariant: DUAL_SYNC_OPERATION_STATUS_VARIANTS[group.status] ?? 'outline',
    errorCode: group.errorCode,
    writeGroup: group.writeGroup,
    sectionLabel: formatDualSyncSectionLabel(group.sectionKey),
    preflightLabel:
      group.preflightStatus ?? (group.requiresPreflight ? 'required' : 'not_required'),
    decisionCount: group.decisionCount,
    masksLabel:
      group.googleUpdateMasks.length > 0 ? group.googleUpdateMasks.join(', ') : 'mask-only',
  };
}

export function buildDualSyncOperationGroupViewModels(
  groups: ReadonlyArray<DualSyncPublishOperationGroup>,
): DualSyncOperationGroupViewModel[] {
  return groups.map(buildDualSyncOperationGroupViewModel);
}

export function buildDualSyncPublishOperationViewModel(
  operation: DualSyncPublishOperation,
): DualSyncPublishOperationViewModel {
  return {
    id: operation.id,
    status: operation.status,
    statusVariant: DUAL_SYNC_OPERATION_STATUS_VARIANTS[operation.status] ?? 'outline',
    fieldKey: operation.fieldKey,
    direction: operation.direction,
    directionIconKey: getDualSyncDirectionIconKey(operation.direction),
    directionLabel: formatDualSyncDirectionToken(operation.direction),
    startedAtLabel: formatPublishJobTimestamp(operation.startedAt ?? operation.createdAt),
    errorCode: operation.errorCode,
    errorMessage: operation.errorMessage,
    errorPreview: formatDualSyncOperationErrorPreview(operation.errorMessage),
  };
}

export function buildDualSyncPublishOperationViewModels(
  operations: ReadonlyArray<DualSyncPublishOperation>,
): DualSyncPublishOperationViewModel[] {
  return operations.map(buildDualSyncPublishOperationViewModel);
}

export function formatDualSyncOperationErrorPreview(value: string | null): string | null {
  if (!value) return null;
  return value.length > 80 ? `${value.slice(0, 80)}…` : value;
}
