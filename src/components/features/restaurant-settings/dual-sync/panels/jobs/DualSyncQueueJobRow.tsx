import { RotateCcw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { TableCell, TableRow } from '@/components/ui/table';

import {
  DUAL_SYNC_QUEUE_JOB_KIND_LABEL,
  canRetryQueueJob,
  formatQueueJobErrorPreview,
  formatQueueJobShortId,
  formatQueueJobTimestamp,
} from './dualSyncQueueJobsDomain';
import { DualSyncQueueJobStatusBadge } from './DualSyncQueueJobStatusBadge';

import type { DualSyncJob } from '@/server/dual-sync';

type DualSyncQueueJobRowProps = {
  job: DualSyncJob;
  retryDisabled: boolean;
  retrying: boolean;
  onRetry: (job: DualSyncJob) => void;
};

export function DualSyncQueueJobRow({
  job,
  retryDisabled,
  retrying,
  onRetry,
}: DualSyncQueueJobRowProps) {
  const retryable = canRetryQueueJob(job);

  return (
    <TableRow className="text-xs">
      <TableCell>
        <DualSyncQueueJobStatusBadge status={job.status} />
        <div className="mt-1 font-mono text-[10px] text-muted-foreground">
          {job.priority} priority
        </div>
      </TableCell>
      <TableCell>
        <div className="font-medium">{DUAL_SYNC_QUEUE_JOB_KIND_LABEL[job.jobKind]}</div>
        <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">
          {formatQueueJobShortId(job)}
          {job.idempotencyKey ? ` / ${job.idempotencyKey}` : ''}
        </div>
      </TableCell>
      <TableCell className="text-right font-mono text-[10px]">
        {job.attemptCount} / {job.maxAttempts}
      </TableCell>
      <TableCell className="font-mono text-[10px]">
        {formatQueueJobTimestamp(job.availableAt)}
      </TableCell>
      <TableCell>
        {job.lastErrorCode ? (
          <span className="font-mono text-[10px] text-destructive">{job.lastErrorCode}</span>
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
        {job.lastErrorMessage ? (
          <div className="mt-0.5 text-[10px] text-muted-foreground" title={job.lastErrorMessage}>
            {formatQueueJobErrorPreview(job.lastErrorMessage)}
          </div>
        ) : null}
      </TableCell>
      <TableCell className="text-right">
        {retryable ? (
          <Button variant="outline" size="sm" onClick={() => onRetry(job)} disabled={retryDisabled}>
            <RotateCcw data-icon="inline-start" />
            {retrying ? 'Retrying' : 'Retry'}
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">-</span>
        )}
      </TableCell>
    </TableRow>
  );
}
