'use client';

import { DualSyncPublishBatchSummary } from './DualSyncPublishBatchSummary';
import { hasDualSyncPublishJobDetailRecords } from './dualSyncPublishJobDetailDomain';
import {
  DualSyncPublishJobDetailEmptyState,
  DualSyncPublishJobDetailErrorState,
  DualSyncPublishJobDetailLoadingState,
  DualSyncPublishJobDetailMissingState,
  DualSyncPublishJobDetailStaleState,
} from './DualSyncPublishJobDetailStates';
import { DualSyncPublishOperationGroupsTable } from './DualSyncPublishOperationGroupsTable';
import { DualSyncPublishOperationsTable } from './DualSyncPublishOperationsTable';
import { getDualSyncErrorMessage } from '../../dualSyncShellActionDomain';

import type { GetDualSyncPublishJobDetailResponse } from '@/services/ops/dual-sync';
import type { UseQueryResult } from '@tanstack/react-query';

export interface DualSyncPublishJobDetailContentProps {
  readonly jobId: string;
  readonly publishJobDetailQuery?: UseQueryResult<GetDualSyncPublishJobDetailResponse, Error>;
}

export function DualSyncPublishJobDetailContent({
  jobId,
  publishJobDetailQuery,
}: DualSyncPublishJobDetailContentProps) {
  if (!publishJobDetailQuery) {
    return <DualSyncPublishJobDetailMissingState />;
  }

  const isThisJob = publishJobDetailQuery.data?.rollup.publishJobId === jobId;
  if (publishJobDetailQuery.isLoading || (!isThisJob && publishJobDetailQuery.isFetching)) {
    return <DualSyncPublishJobDetailLoadingState />;
  }

  if (publishJobDetailQuery.isError) {
    return (
      <DualSyncPublishJobDetailErrorState
        message={getDualSyncErrorMessage(
          publishJobDetailQuery.error,
          'Publish job detail could not be loaded.',
        )}
        onRetry={() => publishJobDetailQuery.refetch()}
      />
    );
  }

  const detail = isThisJob ? publishJobDetailQuery.data : undefined;
  if (!detail) {
    return <DualSyncPublishJobDetailStaleState />;
  }

  if (!hasDualSyncPublishJobDetailRecords(detail)) {
    return <DualSyncPublishJobDetailEmptyState />;
  }

  return (
    <div className="flex flex-col gap-2 p-3">
      {detail.batch ? <DualSyncPublishBatchSummary batch={detail.batch} /> : null}
      <DualSyncPublishOperationGroupsTable groups={detail.operationGroups} />
      <DualSyncPublishOperationsTable operations={detail.operations} />
    </div>
  );
}
