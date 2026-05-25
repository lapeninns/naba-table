/**
 * Pending outbound candidate panel for unified dual-sync.
 *
 * Renders the lazy candidate query exposed by `useOpsDualSync` and lets
 * operators cancel open candidates without deleting their audit rows.
 */

'use client';

import { useMemo } from 'react';

import { DualSyncPendingCandidatesContent } from './DualSyncPendingCandidatesContent';
import {
  buildDualSyncPendingCandidatesPanelModel,
  getCancellingDualSyncCandidateId,
} from './dualSyncPendingCandidatesDomain';
import {
  DualSyncPendingCandidatesEmptyState,
  DualSyncPendingCandidatesErrorState,
  DualSyncPendingCandidatesLoadingState,
} from './DualSyncPendingCandidatesStates';
import { useDualSyncPendingCandidateCancel } from './useDualSyncPendingCandidateCancel';

import type { DualSyncOutboundCandidate } from '@/server/dual-sync';
import type { ListDualSyncCandidatesResponse } from '@/services/ops/dual-sync';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';

export interface DualSyncPendingCandidatesPanelProps {
  readonly candidatesQuery: UseQueryResult<ListDualSyncCandidatesResponse, Error>;
  readonly cancelCandidateMutation: UseMutationResult<DualSyncOutboundCandidate, Error, string>;
  readonly className?: string;
}

export function DualSyncPendingCandidatesPanel({
  candidatesQuery,
  cancelCandidateMutation,
  className,
}: DualSyncPendingCandidatesPanelProps) {
  const cancellingCandidateId = getCancellingDualSyncCandidateId(
    cancelCandidateMutation.isPending,
    cancelCandidateMutation.variables,
  );
  const model = useMemo(
    () => buildDualSyncPendingCandidatesPanelModel(candidatesQuery.data, cancellingCandidateId),
    [candidatesQuery.data, cancellingCandidateId],
  );
  const cancelState = useDualSyncPendingCandidateCancel(cancelCandidateMutation);

  if (candidatesQuery.isLoading) {
    return <DualSyncPendingCandidatesLoadingState className={className} />;
  }

  if (candidatesQuery.isError) {
    return (
      <DualSyncPendingCandidatesErrorState
        message={candidatesQuery.error?.message ?? 'Unknown error.'}
        onRetry={() => candidatesQuery.refetch()}
        className={className}
      />
    );
  }

  if (model.candidateRows.length === 0) {
    return <DualSyncPendingCandidatesEmptyState className={className} />;
  }

  return (
    <DualSyncPendingCandidatesContent
      cancelDisabled={cancelState.cancelDisabled}
      candidateRows={model.candidateRows}
      className={className}
      onCancel={cancelState.onCancel}
    />
  );
}
