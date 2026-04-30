/**
 * Phase 3k of the unified dual-sync engine.
 *
 * Recent-operations dashboard panel. Renders a compact table of the
 * latest `dual_sync_publish_operations` rows so operators can audit
 * the publish history without leaving the settings shell.
 *
 * Uses the lazy `operationsQuery` exposed by `useOpsDualSync`. Render
 * this component only when the parent shell wants the panel — keeping
 * the main shell render path cheap.
 */

'use client';

import {
  AlertCircle,
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle2,
  CircleDashed,
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

import type {
  DualSyncPublishOperation,
  DualSyncPublishOperationStatus,
} from '@/server/dual-sync';
import type { ListDualSyncOperationsResponse } from '@/services/ops/dual-sync';
import type { UseQueryResult } from '@tanstack/react-query';

const STATUS_LABEL: Record<DualSyncPublishOperationStatus, string> = {
  pending: 'Pending',
  running: 'Running',
  succeeded: 'Succeeded',
  failed: 'Failed',
  skipped: 'Skipped',
  retrying: 'Retrying',
};

const STATUS_VARIANT: Record<
  DualSyncPublishOperationStatus,
  'status-confirmed' | 'status-pending' | 'status-cancelled' | 'status-completed'
> = {
  pending: 'status-pending',
  running: 'status-pending',
  succeeded: 'status-confirmed',
  failed: 'status-cancelled',
  skipped: 'status-completed',
  retrying: 'status-pending',
};

function StatusIcon({ status }: { status: DualSyncPublishOperationStatus }) {
  const cls = 'h-3.5 w-3.5';
  switch (status) {
    case 'succeeded':
      return <CheckCircle2 className={cn(cls, 'text-green-600')} />;
    case 'failed':
      return <XCircle className={cn(cls, 'text-red-600')} />;
    case 'skipped':
      return <CircleDashed className={cn(cls, 'text-muted-foreground')} />;
    case 'retrying':
    case 'running':
    case 'pending':
    default:
      return <Clock className={cn(cls, 'text-amber-600')} />;
  }
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

function durationMs(op: DualSyncPublishOperation): number | null {
  if (!op.startedAt || !op.finishedAt) return null;
  const start = Date.parse(op.startedAt);
  const end = Date.parse(op.finishedAt);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return end - start;
}

function formatDuration(ms: number | null): string {
  if (ms === null) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export interface DualSyncOperationsPanelProps {
  readonly operationsQuery: UseQueryResult<ListDualSyncOperationsResponse, Error>;
  readonly className?: string;
}

export function DualSyncOperationsPanel({
  operationsQuery,
  className,
}: DualSyncOperationsPanelProps) {
  const operations = useMemo(
    () => operationsQuery.data?.operations ?? [],
    [operationsQuery.data],
  );

  if (operationsQuery.isLoading) {
    return (
      <div className={cn('space-y-2', className)}>
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (operationsQuery.isError) {
    return (
      <div
        className={cn(
          'flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive',
          className,
        )}
      >
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="space-y-1">
          <div className="font-semibold">
            Couldn&apos;t load the operation history.
          </div>
          <div className="text-xs opacity-80">
            {operationsQuery.error?.message ?? 'Unknown error.'}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => operationsQuery.refetch()}
            className="mt-1"
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (operations.length === 0) {
    return (
      <div
        className={cn(
          'rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground',
          className,
        )}
      >
        No publish operations recorded for this restaurant yet.
      </div>
    );
  }

  return (
    <div className={cn('rounded-md border', className)}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[120px]">Status</TableHead>
            <TableHead>Field</TableHead>
            <TableHead className="w-[110px]">Direction</TableHead>
            <TableHead className="w-[160px]">Started</TableHead>
            <TableHead className="w-[80px] text-right">Duration</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {operations.map((op) => (
            <TableRow key={op.id} className="text-xs">
              <TableCell>
                <Badge
                  variant={STATUS_VARIANT[op.status]}
                  className="inline-flex items-center gap-1 font-mono text-[10px]"
                >
                  <StatusIcon status={op.status} />
                  {STATUS_LABEL[op.status]}
                </Badge>
                {op.errorCode ? (
                  <div className="mt-0.5 font-mono text-[10px] text-destructive">
                    {op.errorCode}
                  </div>
                ) : null}
              </TableCell>
              <TableCell className="font-mono text-[11px]">
                {op.fieldKey}
                {op.errorMessage ? (
                  <div className="mt-0.5 font-sans text-[10px] text-muted-foreground">
                    {op.errorMessage}
                  </div>
                ) : null}
              </TableCell>
              <TableCell>
                <span className="inline-flex items-center gap-1 font-mono text-[10px]">
                  {op.direction === 'import_from_google' ? (
                    <>
                      <ArrowDownToLine className="h-3 w-3" />
                      Import
                    </>
                  ) : (
                    <>
                      <ArrowUpFromLine className="h-3 w-3" />
                      Export
                    </>
                  )}
                </span>
              </TableCell>
              <TableCell className="font-mono text-[10px]">
                {formatTimestamp(op.startedAt ?? op.createdAt)}
              </TableCell>
              <TableCell className="text-right font-mono text-[10px]">
                {formatDuration(durationMs(op))}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
