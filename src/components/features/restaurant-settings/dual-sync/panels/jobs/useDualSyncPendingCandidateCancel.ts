import { useCallback } from 'react';

import {
  getDualSyncPendingCandidateCancelErrorToastIntent,
  getDualSyncPendingCandidateCancelSuccessToastIntent,
} from './dualSyncPendingCandidatesDomain';
import { useDualSyncToastBridge } from '../../hooks/useDualSyncToastBridge';

import type { DualSyncOutboundCandidate } from '@/server/dual-sync';
import type { UseMutationResult } from '@tanstack/react-query';

export function useDualSyncPendingCandidateCancel(
  cancelCandidateMutation: UseMutationResult<DualSyncOutboundCandidate, Error, string>,
) {
  const showToast = useDualSyncToastBridge();

  const onCancel = useCallback(
    async (candidateId: string) => {
      try {
        await cancelCandidateMutation.mutateAsync(candidateId);
        showToast(getDualSyncPendingCandidateCancelSuccessToastIntent());
      } catch (error) {
        showToast(getDualSyncPendingCandidateCancelErrorToastIntent(error));
      }
    },
    [cancelCandidateMutation, showToast],
  );

  return {
    cancelDisabled: cancelCandidateMutation.isPending,
    onCancel,
  };
}
