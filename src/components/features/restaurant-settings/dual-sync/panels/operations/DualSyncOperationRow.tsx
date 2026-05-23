import { TableCell, TableRow } from '@/components/ui/table';

import { DualSyncOperationDirectionCell } from './DualSyncOperationDirectionCell';
import {
  formatOperationDuration,
  formatOperationTimestamp,
  getOperationDurationMs,
} from './dualSyncOperationsDomain';
import { DualSyncOperationStatusBadge } from './DualSyncOperationStatusBadge';

import type { DualSyncPublishOperation } from '@/server/dual-sync';

type DualSyncOperationRowProps = {
  operation: DualSyncPublishOperation;
};

export function DualSyncOperationRow({ operation }: DualSyncOperationRowProps) {
  return (
    <TableRow className="text-xs">
      <TableCell>
        <DualSyncOperationStatusBadge status={operation.status} />
        {operation.errorCode ? (
          <div className="mt-0.5 font-mono text-[10px] text-destructive">{operation.errorCode}</div>
        ) : null}
      </TableCell>
      <TableCell className="font-mono text-[11px]">
        {operation.fieldKey}
        {operation.errorMessage ? (
          <div className="mt-0.5 font-sans text-[10px] text-muted-foreground">
            {operation.errorMessage}
          </div>
        ) : null}
      </TableCell>
      <TableCell>
        <DualSyncOperationDirectionCell direction={operation.direction} />
      </TableCell>
      <TableCell className="font-mono text-[10px]">
        {formatOperationTimestamp(operation.startedAt ?? operation.createdAt)}
      </TableCell>
      <TableCell className="text-right font-mono text-[10px]">
        {formatOperationDuration(getOperationDurationMs(operation))}
      </TableCell>
    </TableRow>
  );
}
