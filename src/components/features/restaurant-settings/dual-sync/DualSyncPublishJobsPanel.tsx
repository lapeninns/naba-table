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

import {
  AlertCircle,
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  XCircle,
} from 'lucide-react';
import { useMemo } from 'react';

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

import type { DualSyncPublishJobRollup } from '@/server/dual-sync/publish/operations';
import type {
  GetDualSyncPublishJobDetailResponse,
  ListDualSyncPublishJobsResponse,
} from '@/services/ops/dual-sync';
import type { UseQueryResult } from '@tanstack/react-query';

const SECTION_LABEL: Record<string, string> = {
  profile: 'Profile',
  operatingHours: 'Hours',
  servicePeriods: 'Periods',
  'businessContext.categories': 'Categories',
  'businessContext.serviceAreas': 'Areas',
  'businessContext.attributes': 'Attributes',
  'businessContext.serviceItems': 'Items',
};

function shortenJobId(id: string): string {
  return id.slice(0, 8);
}

function formatTimestamp(value: string | null): string {
  if (!value) return '—';
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleString();
  } catch {
    return value;
  }
}

function durationMs(job: DualSyncPublishJobRollup): number | null {
  if (!job.startedAt || !job.finishedAt) return null;
  const start = Date.parse(job.startedAt);
  const end = Date.parse(job.finishedAt);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return Math.max(0, end - start);
}

function formatDuration(ms: number | null): string {
  if (ms === null) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(2)}s`;
  return `${(ms / 60_000).toFixed(1)}m`;
}

function jobStatus(job: DualSyncPublishJobRollup): 'success' | 'partial' | 'failed' | 'in-flight' {
  if (job.otherCount > 0 || !job.finishedAt) return 'in-flight';
  if (job.failedCount === 0) return 'success';
  if (job.succeededCount > 0) return 'partial';
  return 'failed';
}

function StatusBadge({ status }: { status: ReturnType<typeof jobStatus> }) {
  switch (status) {
    case 'success':
      return (
        <Badge
          variant="status-confirmed"
          className="inline-flex items-center gap-1 font-mono text-[10px]"
        >
          <CheckCircle2 className="size-3" /> Success
        </Badge>
      );
    case 'partial':
      return (
        <Badge
          variant="status-pending"
          className="inline-flex items-center gap-1 font-mono text-[10px]"
        >
          <AlertCircle className="size-3" /> Partial
        </Badge>
      );
    case 'failed':
      return (
        <Badge
          variant="status-cancelled"
          className="inline-flex items-center gap-1 font-mono text-[10px]"
        >
          <XCircle className="size-3" /> Failed
        </Badge>
      );
    case 'in-flight':
    default:
      return (
        <Badge
          variant="status-pending"
          className="inline-flex items-center gap-1 font-mono text-[10px]"
        >
          <Clock className="size-3" /> In flight
        </Badge>
      );
  }
}

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
  const jobs = useMemo(() => publishJobsQuery.data?.jobs ?? [], [publishJobsQuery.data]);
  const detailEnabled = typeof onSelectJob === 'function';

  if (publishJobsQuery.isLoading) {
    return (
      <div className={cn('space-y-2', className)}>
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (publishJobsQuery.isError) {
    return (
      <div
        className={cn(
          'flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive',
          className,
        )}
      >
        <AlertCircle className="mt-0.5 size-4 shrink-0" />
        <div className="space-y-1">
          <div className="font-semibold">Couldn&apos;t load publish jobs.</div>
          <div className="text-xs opacity-80">
            {publishJobsQuery.error?.message ?? 'Unknown error.'}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => publishJobsQuery.refetch()}
            className="mt-1"
          >
            Retry
          </Button>
        </div>
      </div>
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
        No publish jobs recorded for this restaurant yet.
      </div>
    );
  }

  return (
    <div className={cn('rounded-md border', className)}>
      <Table>
        <TableHeader>
          <TableRow>
            {detailEnabled ? <TableHead className="w-[28px]" /> : null}
            <TableHead className="w-[110px]">Status</TableHead>
            <TableHead className="w-[110px]">Job</TableHead>
            <TableHead className="w-[140px]">Started</TableHead>
            <TableHead className="w-[80px] text-right">Duration</TableHead>
            <TableHead className="w-[150px] text-right">Counts</TableHead>
            <TableHead>Sections</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {jobs.map((job) => {
            const status = jobStatus(job);
            const isSelected = detailEnabled && selectedJobId === job.publishJobId;
            const colSpan = detailEnabled ? 7 : 6;
            return (
              <PublishJobRow
                key={job.publishJobId}
                job={job}
                status={status}
                isSelected={isSelected}
                detailEnabled={detailEnabled}
                onSelectJob={onSelectJob}
                publishJobDetailQuery={publishJobDetailQuery}
                colSpan={colSpan}
              />
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

interface PublishJobRowProps {
  readonly job: DualSyncPublishJobRollup;
  readonly status: ReturnType<typeof jobStatus>;
  readonly isSelected: boolean;
  readonly detailEnabled: boolean;
  readonly onSelectJob?: (jobId: string | null) => void;
  readonly publishJobDetailQuery?: UseQueryResult<GetDualSyncPublishJobDetailResponse, Error>;
  readonly colSpan: number;
}

function PublishJobRow({
  job,
  status,
  isSelected,
  detailEnabled,
  onSelectJob,
  publishJobDetailQuery,
  colSpan,
}: PublishJobRowProps) {
  const handleToggle = () => {
    if (!onSelectJob) return;
    onSelectJob(isSelected ? null : job.publishJobId);
  };
  return (
    <>
      <TableRow
        className={cn(
          'text-xs',
          isSelected ? 'bg-muted/40' : undefined,
          detailEnabled ? 'cursor-pointer' : undefined,
        )}
        onClick={detailEnabled ? handleToggle : undefined}
      >
        {detailEnabled ? (
          <TableCell className="w-[28px] align-top">
            <Button
              variant="ghost"
              size="sm"
              className="size-6 p-0"
              onClick={(e) => {
                e.stopPropagation();
                handleToggle();
              }}
              aria-label={isSelected ? 'Hide job detail' : 'Show job detail'}
            >
              {isSelected ? (
                <ChevronDown className="size-3.5" />
              ) : (
                <ChevronRight className="size-3.5" />
              )}
            </Button>
          </TableCell>
        ) : null}
        <TableCell>
          <StatusBadge status={status} />
          {job.errorCodes.length > 0 ? (
            <div className="mt-1 flex flex-wrap gap-1">
              {job.errorCodes.map((code) => (
                <span key={code} className="font-mono text-[10px] text-destructive">
                  {code}
                </span>
              ))}
            </div>
          ) : null}
        </TableCell>
        <TableCell>
          <span className="font-mono text-[10px]" title={job.publishJobId}>
            {shortenJobId(job.publishJobId)}
          </span>
          <div className="mt-0.5 flex gap-2 text-[10px] text-muted-foreground">
            {job.importCount > 0 ? (
              <span className="inline-flex items-center gap-0.5">
                <ArrowDownToLine className="size-3" />
                {job.importCount}
              </span>
            ) : null}
            {job.exportCount > 0 ? (
              <span className="inline-flex items-center gap-0.5">
                <ArrowUpFromLine className="size-3" />
                {job.exportCount}
              </span>
            ) : null}
          </div>
        </TableCell>
        <TableCell className="font-mono text-[10px]">{formatTimestamp(job.startedAt)}</TableCell>
        <TableCell className="text-right font-mono text-[10px]">
          {formatDuration(durationMs(job))}
        </TableCell>
        <TableCell className="text-right font-mono text-[10px]">
          <span className="text-primary">{job.succeededCount}✓</span>
          {' / '}
          <span className="text-destructive">{job.failedCount}✗</span>
          {job.skippedCount > 0 ? (
            <span className="text-muted-foreground">
              {' / '}
              {job.skippedCount}–
            </span>
          ) : null}
        </TableCell>
        <TableCell>
          <div className="flex flex-wrap gap-1">
            {job.sections.map((section) => (
              <Badge key={section} variant="outline" className="font-mono text-[10px]">
                {SECTION_LABEL[section] ?? section}
              </Badge>
            ))}
          </div>
        </TableCell>
      </TableRow>
      {isSelected ? (
        <TableRow className="bg-muted/20">
          <TableCell colSpan={colSpan} className="p-0">
            <PublishJobDetailContent
              jobId={job.publishJobId}
              publishJobDetailQuery={publishJobDetailQuery}
            />
          </TableCell>
        </TableRow>
      ) : null}
    </>
  );
}

const OP_STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  succeeded: 'default',
  failed: 'destructive',
  skipped: 'outline',
  pending: 'secondary',
  running: 'secondary',
  retrying: 'secondary',
};

interface PublishJobDetailContentProps {
  readonly jobId: string;
  readonly publishJobDetailQuery?: UseQueryResult<GetDualSyncPublishJobDetailResponse, Error>;
}

function PublishJobDetailContent({ jobId, publishJobDetailQuery }: PublishJobDetailContentProps) {
  if (!publishJobDetailQuery) {
    return <div className="p-3 text-xs text-muted-foreground">Detail loader not configured.</div>;
  }
  const isThisJob = publishJobDetailQuery.data?.rollup.publishJobId === jobId;
  if (publishJobDetailQuery.isLoading || (!isThisJob && publishJobDetailQuery.isFetching)) {
    return (
      <div className="space-y-2 p-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
      </div>
    );
  }
  if (publishJobDetailQuery.isError) {
    return (
      <div className="flex items-start gap-2 p-3 text-xs text-destructive">
        <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
        <div className="space-y-1">
          <div>Couldn&apos;t load job detail.</div>
          <div className="opacity-80">
            {publishJobDetailQuery.error?.message ?? 'Unknown error.'}
          </div>
          <Button variant="outline" size="sm" onClick={() => publishJobDetailQuery.refetch()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }
  const detail = isThisJob ? publishJobDetailQuery.data : undefined;
  if (!detail) {
    return <div className="p-3 text-xs text-muted-foreground">Loading detail…</div>;
  }
  const operations = detail.operations;
  if (operations.length === 0) {
    return (
      <div className="p-3 text-xs text-muted-foreground">No operations recorded for this job.</div>
    );
  }
  return (
    <div className="space-y-2 p-3">
      <div className="text-[11px] font-semibold text-muted-foreground">
        Operations ({operations.length})
      </div>
      <div className="rounded-md border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[110px]">Status</TableHead>
              <TableHead>Field</TableHead>
              <TableHead className="w-[120px]">Direction</TableHead>
              <TableHead className="w-[140px]">Started</TableHead>
              <TableHead>Error</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {operations.map((op) => (
              <TableRow key={op.id} className="text-xs">
                <TableCell>
                  <Badge
                    variant={OP_STATUS_VARIANTS[op.status] ?? 'outline'}
                    className="font-mono text-[10px]"
                  >
                    {op.status}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono text-[10px]">{op.fieldKey}</TableCell>
                <TableCell className="font-mono text-[10px]">
                  {op.direction === 'export_to_google' ? (
                    <span className="inline-flex items-center gap-0.5">
                      <ArrowUpFromLine className="size-3" /> export
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-0.5">
                      <ArrowDownToLine className="size-3" /> import
                    </span>
                  )}
                </TableCell>
                <TableCell className="font-mono text-[10px]">
                  {formatTimestamp(op.startedAt ?? op.createdAt)}
                </TableCell>
                <TableCell className="text-[11px]">
                  {op.errorCode ? (
                    <span className="font-mono text-destructive">{op.errorCode}</span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                  {op.errorMessage ? (
                    <div
                      className="mt-0.5 text-[10px] text-muted-foreground"
                      title={op.errorMessage}
                    >
                      {op.errorMessage.length > 80
                        ? `${op.errorMessage.slice(0, 80)}…`
                        : op.errorMessage}
                    </div>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
