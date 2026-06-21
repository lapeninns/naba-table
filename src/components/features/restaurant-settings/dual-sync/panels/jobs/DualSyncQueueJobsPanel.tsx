/**
 * Durable queue recovery panel for unified dual-sync.
 *
 * Uses the lazy `jobsQuery` and `retryJobMutation` exposed by
 * `useOpsDualSync` so operators can see retry/dead-letter state without
 * leaving the settings workspace.
 */

'use client';

import { useMemo } from 'react';

import { DualSyncQueueJobsContent } from './DualSyncQueueJobsContent';
import { buildDualSyncQueueJobsPanelModel } from './dualSyncQueueJobsDomain';
import {
  DualSyncQueueJobsEmptyState,
  DualSyncQueueJobsErrorState,
  DualSyncQueueJobsLoadingState,
} from './DualSyncQueueJobsStates';
import { useDualSyncQueueJobRetry } from './useDualSyncQueueJobRetry';

import type { DualSyncJob } from '@/server/dual-sync';
import type { ListDualSyncJobsResponse } from '@/services/ops/dual-sync';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';

export interface DualSyncQueueJobsPanelProps {
  readonly jobsQuery: UseQueryResult<ListDualSyncJobsResponse, Error>;
  readonly retryJobMutation: UseMutationResult<DualSyncJob, Error, string>;
  readonly className?: string;
}

export function DualSyncQueueJobsPanel({
  jobsQuery,
  retryJobMutation,
  className,
}: DualSyncQueueJobsPanelProps) {
  const model = useMemo(() => buildDualSyncQueueJobsPanelModel(jobsQuery.data), [jobsQuery.data]);
  const retryState = useDualSyncQueueJobRetry(retryJobMutation);

  if (jobsQuery.isLoading) {
    return <DualSyncQueueJobsLoadingState className={className} />;
  }

  if (jobsQuery.isError) {
    return (
      <DualSyncQueueJobsErrorState
        className={className}
        message={jobsQuery.error?.message ?? 'Unknown error.'}
        onRetry={() => jobsQuery.refetch()}
      />
    );
  }

  if (model.jobs.length === 0) {
    return <DualSyncQueueJobsEmptyState className={className} />;
  }

  return (
    <DualSyncQueueJobsContent
      className={className}
      jobs={model.jobs}
      onRetry={retryState.onRetry}
      retryDisabled={retryState.retryDisabled}
      retryingJobId={retryState.retryingJobId}
    />
  );
}
