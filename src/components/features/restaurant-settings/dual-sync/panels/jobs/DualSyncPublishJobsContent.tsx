import { cn } from '@/lib/utils';

import { DualSyncPublishJobsTable } from './DualSyncPublishJobsTable';

import type { DualSyncPublishJobRollup } from '@/server/dual-sync/publish/operations';
import type { GetDualSyncPublishJobDetailResponse } from '@/services/ops/dual-sync';
import type { UseQueryResult } from '@tanstack/react-query';

export function DualSyncPublishJobsContent({
  className,
  jobs,
  onSelectJob,
  publishJobDetailQuery,
  selectedJobId,
}: {
  readonly className?: string;
  readonly jobs: ReadonlyArray<DualSyncPublishJobRollup>;
  readonly selectedJobId?: string | null;
  readonly onSelectJob?: (jobId: string | null) => void;
  readonly publishJobDetailQuery?: UseQueryResult<GetDualSyncPublishJobDetailResponse, Error>;
}) {
  return (
    <div className={cn('rounded-md border', className)}>
      <DualSyncPublishJobsTable
        jobs={jobs}
        selectedJobId={selectedJobId}
        onSelectJob={onSelectJob}
        publishJobDetailQuery={publishJobDetailQuery}
      />
    </div>
  );
}
