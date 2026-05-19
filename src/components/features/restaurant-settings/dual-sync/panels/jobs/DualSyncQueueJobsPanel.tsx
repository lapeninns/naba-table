/**
 * Durable queue recovery panel for unified dual-sync.
 *
 * Uses the lazy `jobsQuery` and `retryJobMutation` exposed by
 * `useOpsDualSync` so operators can see retry/dead-letter state without
 * leaving the settings workspace.
 */

'use client';

import { AlertCircle, CheckCircle2, Clock, RotateCcw, XCircle } from 'lucide-react';
import { useMemo } from 'react';
import { toast } from 'sonner';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

import type { DualSyncJob, DualSyncJobKind, DualSyncJobStatus } from '@/server/dual-sync';
import type { ListDualSyncJobsResponse } from '@/services/ops/dual-sync';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';

const STATUS_LABEL: Record<DualSyncJobStatus, string> = {
  queued: 'Queued',
  running: 'Running',
  succeeded: 'Succeeded',
  failed: 'Failed',
  retrying: 'Retrying',
  dead_letter: 'Dead letter',
  cancelled: 'Cancelled',
};

const STATUS_VARIANT: Record<
  DualSyncJobStatus,
  'status-confirmed' | 'status-pending' | 'status-cancelled' | 'status-completed'
> = {
  queued: 'status-pending',
  running: 'status-pending',
  succeeded: 'status-confirmed',
  failed: 'status-cancelled',
  retrying: 'status-pending',
  dead_letter: 'status-cancelled',
  cancelled: 'status-completed',
};

const JOB_KIND_LABEL: Record<DualSyncJobKind, string> = {
  google_refresh_manual: 'Manual refresh',
  google_refresh_scheduled: 'Scheduled refresh',
  core_write_recompute: 'Core recompute',
  publish_batch: 'Publish batch',
  auto_export: 'Auto-export',
  mirror_refresh_after_publish: 'Mirror refresh',
};

const RETRYABLE_STATUSES: ReadonlyArray<DualSyncJobStatus> = ['failed', 'dead_letter', 'cancelled'];

function formatTimestamp(value: string | null): string {
  if (!value) return '-';
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleString();
  } catch {
    return value;
  }
}

function statusIcon(status: DualSyncJobStatus) {
  const className = 'size-3';
  if (status === 'succeeded') return <CheckCircle2 className={className} />;
  if (status === 'failed' || status === 'dead_letter' || status === 'cancelled') {
    return <XCircle className={className} />;
  }
  if (status === 'retrying') return <RotateCcw className={className} />;
  return <Clock className={className} />;
}

function canRetry(job: DualSyncJob): boolean {
  return RETRYABLE_STATUSES.includes(job.status);
}

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
  const jobs = useMemo(() => jobsQuery.data?.jobs ?? [], [jobsQuery.data]);

  if (jobsQuery.isLoading) {
    return (
      <div className={cn('flex flex-col gap-2', className)}>
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (jobsQuery.isError) {
    return (
      <Alert variant="destructive" className={className}>
        <AlertCircle className="size-4" />
        <AlertTitle>Couldn&apos;t load queue jobs.</AlertTitle>
        <AlertDescription className="flex flex-col gap-2">
          <span>{jobsQuery.error?.message ?? 'Unknown error.'}</span>
          <Button variant="outline" size="sm" className="w-fit" onClick={() => jobsQuery.refetch()}>
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (jobs.length === 0) {
    return (
      <div
        className={cn(
          'rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground',
          className,
        )}
      >
        No durable queue jobs recorded for this restaurant yet.
      </div>
    );
  }

  const onRetry = async (job: DualSyncJob) => {
    try {
      await retryJobMutation.mutateAsync(job.id);
      toast.success('Queue job requeued.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Queue job retry failed.');
    }
  };

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
          {jobs.map((job) => {
            const retryable = canRetry(job);
            const retryingThisJob =
              retryJobMutation.isPending && retryJobMutation.variables === job.id;
            return (
              <TableRow key={job.id} className="text-xs">
                <TableCell>
                  <Badge
                    variant={STATUS_VARIANT[job.status]}
                    className="inline-flex items-center gap-1 font-mono text-[10px]"
                  >
                    {statusIcon(job.status)}
                    {STATUS_LABEL[job.status]}
                  </Badge>
                  <div className="mt-1 font-mono text-[10px] text-muted-foreground">
                    {job.priority} priority
                  </div>
                </TableCell>
                <TableCell>
                  <div className="font-medium">{JOB_KIND_LABEL[job.jobKind]}</div>
                  <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                    {job.id.slice(0, 8)}
                    {job.idempotencyKey ? ` / ${job.idempotencyKey}` : ''}
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono text-[10px]">
                  {job.attemptCount} / {job.maxAttempts}
                </TableCell>
                <TableCell className="font-mono text-[10px]">
                  {formatTimestamp(job.availableAt)}
                </TableCell>
                <TableCell>
                  {job.lastErrorCode ? (
                    <span className="font-mono text-[10px] text-destructive">
                      {job.lastErrorCode}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                  {job.lastErrorMessage ? (
                    <div
                      className="mt-0.5 text-[10px] text-muted-foreground"
                      title={job.lastErrorMessage}
                    >
                      {job.lastErrorMessage.length > 96
                        ? `${job.lastErrorMessage.slice(0, 96)}...`
                        : job.lastErrorMessage}
                    </div>
                  ) : null}
                </TableCell>
                <TableCell className="text-right">
                  {retryable ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onRetry(job)}
                      disabled={retryJobMutation.isPending}
                    >
                      <RotateCcw data-icon="inline-start" />
                      {retryingThisJob ? 'Retrying' : 'Retry'}
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">-</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
