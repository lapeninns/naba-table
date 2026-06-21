import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

import { DualSyncQueueJobRow } from './DualSyncQueueJobRow';

import type { DualSyncJob } from '@/server/dual-sync';

export function DualSyncQueueJobsContent({
  className,
  jobs,
  onRetry,
  retryDisabled,
  retryingJobId,
}: {
  readonly className?: string;
  readonly jobs: ReadonlyArray<DualSyncJob>;
  readonly onRetry: (job: DualSyncJob) => void;
  readonly retryDisabled: boolean;
  readonly retryingJobId?: string;
}) {
  return (
    <div className={cn('rounded-md border', className)}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[128px]">Status</TableHead>
            <TableHead>Job</TableHead>
            <TableHead className="w-[112px] text-right">Attempts</TableHead>
            <TableHead className="w-[172px]">Available</TableHead>
            <TableHead>Error</TableHead>
            <TableHead className="w-[96px] text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {jobs.map((job) => (
            <DualSyncQueueJobRow
              key={job.id}
              job={job}
              retryDisabled={retryDisabled}
              retrying={retryDisabled && retryingJobId === job.id}
              onRetry={onRetry}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
