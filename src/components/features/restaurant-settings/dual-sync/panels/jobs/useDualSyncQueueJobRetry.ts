import { useCallback } from 'react';

import {
  getDualSyncQueueJobRetryErrorToastIntent,
  getDualSyncQueueJobRetrySuccessToastIntent,
} from './dualSyncQueueJobsDomain';
import { useDualSyncToastBridge } from '../../hooks/useDualSyncToastBridge';

import type { DualSyncJob } from '@/server/dual-sync';
import type { UseMutationResult } from '@tanstack/react-query';

export function useDualSyncQueueJobRetry(
  retryJobMutation: UseMutationResult<DualSyncJob, Error, string>,
) {
  const showToast = useDualSyncToastBridge();

  const onRetry = useCallback(
    async (job: DualSyncJob) => {
      try {
        await retryJobMutation.mutateAsync(job.id);
        showToast(getDualSyncQueueJobRetrySuccessToastIntent());
      } catch (error) {
        showToast(getDualSyncQueueJobRetryErrorToastIntent(error));
      }
    },
    [retryJobMutation, showToast],
  );

  return {
    onRetry,
    retryDisabled: retryJobMutation.isPending,
    retryingJobId: retryJobMutation.variables,
  };
}
