/**
 * Phase 3m of the unified dual-sync engine.
 *
 * "Recent publishes" panel. Renders one row per `publish_job_id`,
 * aggregating its operations into succeeded / failed / skipped counts,
 * the affected sections, and the unique error codes seen on failure.
 *
 * Powered by the lazy `publishJobsQuery` from `useOpsDualSync`.
 */

'use client';

import { useMemo } from 'react';

import { DualSyncPublishJobsContent } from './DualSyncPublishJobsContent';
import { buildDualSyncPublishJobsPanelModel } from './dualSyncPublishJobsDomain';
import {
  DualSyncPublishJobsEmptyState,
  DualSyncPublishJobsErrorState,
  DualSyncPublishJobsLoadingState,
} from './DualSyncPublishJobsStates';
import { getDualSyncErrorMessage } from '../../dualSyncShellActionDomain';

import type {
  GetDualSyncPublishJobDetailResponse,
  ListDualSyncPublishJobsResponse,
} from '@/services/ops/dual-sync';
import type { UseQueryResult } from '@tanstack/react-query';

export interface DualSyncPublishJobsPanelProps {
  readonly publishJobsQuery: UseQueryResult<ListDualSyncPublishJobsResponse, Error>;
  /**
   * Optional inline detail expansion. When `selectedJobId` is set, the
   * matching row is highlighted and expanded with the full operation
   * list sourced from `publishJobDetailQuery`.
   */
  readonly selectedJobId?: string | null;
  readonly onSelectJob?: (jobId: string | null) => void;
  readonly publishJobDetailQuery?: UseQueryResult<GetDualSyncPublishJobDetailResponse, Error>;
  readonly className?: string;
}

export function DualSyncPublishJobsPanel({
  publishJobsQuery,
  selectedJobId,
  onSelectJob,
  publishJobDetailQuery,
  className,
}: DualSyncPublishJobsPanelProps) {
  const model = useMemo(
    () => buildDualSyncPublishJobsPanelModel(publishJobsQuery.data),
    [publishJobsQuery.data],
  );

  if (publishJobsQuery.isLoading) {
    return <DualSyncPublishJobsLoadingState className={className} />;
  }

  if (publishJobsQuery.isError) {
    return (
      <DualSyncPublishJobsErrorState
        className={className}
        message={getDualSyncErrorMessage(
          publishJobsQuery.error,
          'Recent publishes could not be loaded.',
        )}
        onRetry={() => publishJobsQuery.refetch()}
      />
    );
  }

  if (model.jobs.length === 0) {
    return <DualSyncPublishJobsEmptyState className={className} />;
  }

  return (
    <DualSyncPublishJobsContent
      className={className}
      jobs={model.jobs}
      selectedJobId={selectedJobId}
      onSelectJob={onSelectJob}
      publishJobDetailQuery={publishJobDetailQuery}
    />
  );
}
