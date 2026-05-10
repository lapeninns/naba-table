/**
 * Pending outbound candidate panel for unified dual-sync.
 *
 * Renders the lazy candidate query exposed by `useOpsDualSync` and lets
 * operators cancel open candidates without deleting their audit rows.
 */

'use client';

import { AlertCircle, Clock, Trash2 } from 'lucide-react';
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

import type { DualSyncOutboundCandidate, DualSyncOutboundStatus } from '@/server/dual-sync';
import type { ListDualSyncCandidatesResponse } from '@/services/ops/dual-sync';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';

const STATUS_LABEL: Record<DualSyncOutboundStatus, string> = {
  open: 'Open',
  resolved: 'Resolved',
  superseded: 'Superseded',
  cancelled: 'Cancelled',
};

const STATUS_VARIANT: Record<
  DualSyncOutboundStatus,
  'status-confirmed' | 'status-pending' | 'status-cancelled' | 'status-completed'
> = {
  open: 'status-pending',
  resolved: 'status-confirmed',
  superseded: 'status-completed',
  cancelled: 'status-cancelled',
};

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

function shortHash(value: string | null): string {
  if (!value) return '-';
  return value.length > 12 ? value.slice(0, 12) : value;
}

export interface DualSyncPendingCandidatesPanelProps {
  readonly candidatesQuery: UseQueryResult<ListDualSyncCandidatesResponse, Error>;
  readonly cancelCandidateMutation: UseMutationResult<DualSyncOutboundCandidate, Error, string>;
  readonly className?: string;
}

export function DualSyncPendingCandidatesPanel({
  candidatesQuery,
  cancelCandidateMutation,
  className,
}: DualSyncPendingCandidatesPanelProps) {
  const candidates = useMemo(() => candidatesQuery.data?.candidates ?? [], [candidatesQuery.data]);

  if (candidatesQuery.isLoading) {
    return (
      <div className={cn('flex flex-col gap-2', className)}>
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (candidatesQuery.isError) {
    return (
      <Alert variant="destructive" className={className}>
        <AlertCircle className="size-4" />
        <AlertTitle>Couldn&apos;t load pending changes.</AlertTitle>
        <AlertDescription className="flex flex-col gap-2">
          <span>{candidatesQuery.error?.message ?? 'Unknown error.'}</span>
          <Button
            variant="outline"
            size="sm"
            className="w-fit"
            onClick={() => candidatesQuery.refetch()}
          >
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (candidates.length === 0) {
    return (
      <div
        className={cn(
          'rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground',
          className,
        )}
      >
        No pending Core changes are waiting for Google export.
      </div>
    );
  }

  const onCancel = async (candidate: DualSyncOutboundCandidate) => {
    try {
      await cancelCandidateMutation.mutateAsync(candidate.id);
      toast.success('Pending change cancelled.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Pending change cancellation failed.');
    }
  };

  return (
    <div className={cn('rounded-md border', className)}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[112px]">Status</TableHead>
            <TableHead>Field</TableHead>
            <TableHead className="w-[128px]">Source</TableHead>
            <TableHead className="w-[132px]">Baseline</TableHead>
            <TableHead className="w-[172px]">Updated</TableHead>
            <TableHead className="w-[104px] text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {candidates.map((candidate) => {
            const cancellingThisCandidate =
              cancelCandidateMutation.isPending &&
              cancelCandidateMutation.variables === candidate.id;
            const canCancel = candidate.status === 'open';
            return (
              <TableRow key={candidate.id} className="text-xs">
                <TableCell>
                  <Badge
                    variant={STATUS_VARIANT[candidate.status]}
                    className="inline-flex items-center gap-1 font-mono text-[10px]"
                  >
                    <Clock className="size-3" />
                    {STATUS_LABEL[candidate.status]}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="max-w-[280px] truncate font-mono text-[10px]">
                    {candidate.fieldKey}
                  </div>
                  <div className="mt-0.5 max-w-[280px] truncate text-[10px] text-muted-foreground">
                    {candidate.sectionKey}
                  </div>
                </TableCell>
                <TableCell className="font-mono text-[10px]">{candidate.source}</TableCell>
                <TableCell className="font-mono text-[10px]">
                  {shortHash(candidate.baselineGbpHash)}
                </TableCell>
                <TableCell className="font-mono text-[10px]">
                  {formatTimestamp(candidate.updatedAt)}
                </TableCell>
                <TableCell className="text-right">
                  {canCancel ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onCancel(candidate)}
                      disabled={cancelCandidateMutation.isPending}
                    >
                      <Trash2 data-icon="inline-start" />
                      {cancellingThisCandidate ? 'Cancelling' : 'Cancel'}
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
