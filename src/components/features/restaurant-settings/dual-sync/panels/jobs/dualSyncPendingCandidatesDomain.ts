import { formatDualSyncTimestamp } from '../../dualSyncFormattingDomain';
import { getDualSyncErrorToastIntent } from '../../dualSyncShellActionDomain';

import type { DualSyncToastIntent } from '../../dualSyncShellActionDomain';
import type { DualSyncOutboundCandidate, DualSyncOutboundStatus } from '@/server/dual-sync';
import type { ListDualSyncCandidatesResponse } from '@/services/ops/dual-sync';

export type DualSyncCandidateStatusVariant =
  | 'status-confirmed'
  | 'status-pending'
  | 'status-cancelled'
  | 'status-completed';

export interface DualSyncPendingCandidateRowModel {
  readonly id: string;
  readonly fieldKey: string;
  readonly sectionKey: string;
  readonly source: string;
  readonly statusLabel: string;
  readonly statusVariant: DualSyncCandidateStatusVariant;
  readonly baselineHashLabel: string;
  readonly updatedAtLabel: string;
  readonly canCancel: boolean;
  readonly isCancelling: boolean;
}

export interface DualSyncPendingCandidatesPanelModel {
  readonly candidateRows: DualSyncPendingCandidateRowModel[];
}

export const DUAL_SYNC_CANDIDATE_STATUS_LABEL: Record<DualSyncOutboundStatus, string> = {
  open: 'Open',
  resolved: 'Resolved',
  superseded: 'Superseded',
  cancelled: 'Cancelled',
};

export const DUAL_SYNC_CANDIDATE_STATUS_VARIANT: Record<
  DualSyncOutboundStatus,
  DualSyncCandidateStatusVariant
> = {
  open: 'status-pending',
  resolved: 'status-confirmed',
  superseded: 'status-completed',
  cancelled: 'status-cancelled',
};

export function formatDualSyncCandidateTimestamp(value: string | null): string {
  return formatDualSyncTimestamp(value, { emptyFallback: '-' });
}

export function formatDualSyncCandidateHash(value: string | null): string {
  if (!value) return '-';
  return value.length > 12 ? value.slice(0, 12) : value;
}

export function buildDualSyncPendingCandidateRowModel(
  candidate: DualSyncOutboundCandidate,
  cancellingCandidateId: string | undefined,
): DualSyncPendingCandidateRowModel {
  return {
    id: candidate.id,
    fieldKey: candidate.fieldKey,
    sectionKey: candidate.sectionKey,
    source: candidate.source,
    statusLabel: DUAL_SYNC_CANDIDATE_STATUS_LABEL[candidate.status],
    statusVariant: DUAL_SYNC_CANDIDATE_STATUS_VARIANT[candidate.status],
    baselineHashLabel: formatDualSyncCandidateHash(candidate.baselineGbpHash),
    updatedAtLabel: formatDualSyncCandidateTimestamp(candidate.updatedAt),
    canCancel: candidate.status === 'open',
    isCancelling: cancellingCandidateId === candidate.id,
  };
}

export function buildDualSyncPendingCandidateRowModels(
  candidates: ReadonlyArray<DualSyncOutboundCandidate>,
  cancellingCandidateId: string | undefined,
): DualSyncPendingCandidateRowModel[] {
  return candidates.map((candidate) =>
    buildDualSyncPendingCandidateRowModel(candidate, cancellingCandidateId),
  );
}

export function getCancellingDualSyncCandidateId(
  isPending: boolean,
  variables: unknown,
): string | undefined {
  return isPending && typeof variables === 'string' ? variables : undefined;
}

export function buildDualSyncPendingCandidatesPanelModel(
  response: ListDualSyncCandidatesResponse | null | undefined,
  cancellingCandidateId: string | undefined,
): DualSyncPendingCandidatesPanelModel {
  return {
    candidateRows: buildDualSyncPendingCandidateRowModels(
      response?.candidates ?? [],
      cancellingCandidateId,
    ),
  };
}

export function getDualSyncPendingCandidateCancelSuccessToastIntent(): DualSyncToastIntent {
  return {
    kind: 'success',
    message: 'Pending change cancelled.',
  };
}

export function getDualSyncPendingCandidateCancelErrorToastIntent(
  error: unknown,
): DualSyncToastIntent {
  return getDualSyncErrorToastIntent(error, 'Pending change cancellation failed.');
}
