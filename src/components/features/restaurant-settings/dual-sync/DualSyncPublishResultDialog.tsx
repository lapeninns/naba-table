/**
 * Immediate publish result summary for unified dual-sync.
 */

'use client';

import { AlertCircle, CheckCircle2, CircleDashed, XCircle } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import type { DualSyncPublishResponse } from '@/services/ops/dual-sync';

const STATUS_VARIANT: Record<string, 'status-confirmed' | 'status-pending' | 'status-cancelled'> = {
  succeeded: 'status-confirmed',
  failed: 'status-cancelled',
  skipped: 'status-pending',
  retrying: 'status-pending',
  pending: 'status-pending',
  running: 'status-pending',
};

function formatTimestamp(value: string | null | undefined): string {
  if (!value) return '-';
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleString();
  } catch {
    return value;
  }
}

function titleForResult(result: DualSyncPublishResponse | null): string {
  if (!result) return 'Publish result';
  if (result.failedCount > 0) return 'Publish completed with failures';
  if (result.succeededCount > 0) return 'Publish completed';
  return 'No fields were published';
}

export interface DualSyncPublishResultDialogProps {
  readonly open: boolean;
  readonly result: DualSyncPublishResponse | null;
  readonly onOpenChange: (open: boolean) => void;
}

export function DualSyncPublishResultDialog({
  open,
  result,
  onOpenChange,
}: DualSyncPublishResultDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{titleForResult(result)}</DialogTitle>
          <DialogDescription>
            Review the operation outcome and any stable failure codes from this publish.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="status-confirmed">
                <CheckCircle2 className="size-3" />
                {result.succeededCount} succeeded
              </Badge>
              <Badge variant={result.failedCount > 0 ? 'status-cancelled' : 'secondary'}>
                <XCircle className="size-3" />
                {result.failedCount} failed
              </Badge>
              <Badge variant="status-pending">
                <CircleDashed className="size-3" />
                {result.skippedCount} skipped
              </Badge>
            </div>

            {result.failures.length > 0 ? (
              <div className="rounded-md border border-destructive/40 p-3">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-destructive">
                  <AlertCircle className="size-4" />
                  Failure codes
                </div>
                <div className="flex flex-col gap-2">
                  {result.failures.map(({ fieldKey, failure }) => (
                    <div key={`${fieldKey}-${failure.code}`} className="text-xs">
                      <span className="font-mono">{fieldKey}</span>
                      <span className="text-muted-foreground">
                        {' '}
                        / {failure.code}: {failure.message}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {result.operations.length > 0 ? (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[112px]">Status</TableHead>
                      <TableHead>Field</TableHead>
                      <TableHead className="w-[136px]">Direction</TableHead>
                      <TableHead className="w-[144px]">Mask</TableHead>
                      <TableHead className="w-[168px]">Finished</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.operations.map((operation) => (
                      <TableRow key={operation.id} className="text-xs">
                        <TableCell>
                          <Badge
                            variant={STATUS_VARIANT[operation.status] ?? 'status-pending'}
                            className="font-mono text-[10px]"
                          >
                            {operation.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="font-mono text-[10px]">{operation.fieldKey}</div>
                          {operation.errorCode ? (
                            <div className="mt-0.5 font-mono text-[10px] text-destructive">
                              {operation.errorCode}
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell className="font-mono text-[10px]">
                          {operation.direction}
                        </TableCell>
                        <TableCell className="font-mono text-[10px]">
                          {operation.googleUpdateMask ?? '-'}
                        </TableCell>
                        <TableCell className="font-mono text-[10px]">
                          {formatTimestamp(operation.finishedAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground">
                No operation rows were returned for this publish.
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground">
            No publish result is loaded.
          </div>
        )}

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
