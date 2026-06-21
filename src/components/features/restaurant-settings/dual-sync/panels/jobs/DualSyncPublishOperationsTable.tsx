import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { buildDualSyncPublishOperationViewModels } from './dualSyncPublishJobDetailDomain';
import { DualSyncDirectionIcon } from '../../DualSyncDirectionIcon';

import type { DualSyncPublishOperation } from '@/server/dual-sync';

export interface DualSyncPublishOperationsTableProps {
  readonly operations: ReadonlyArray<DualSyncPublishOperation>;
}

export function DualSyncPublishOperationsTable({
  operations,
}: DualSyncPublishOperationsTableProps) {
  const rows = buildDualSyncPublishOperationViewModels(operations);

  return (
    <>
      <div className="text-[11px] font-semibold text-muted-foreground">
        Operations ({rows.length})
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
            {rows.map((operation) => (
              <TableRow key={operation.id} className="text-xs">
                <TableCell>
                  <Badge variant={operation.statusVariant} className="font-mono text-[10px]">
                    {operation.status}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono text-[10px]">{operation.fieldKey}</TableCell>
                <TableCell className="font-mono text-[10px]">
                  <span className="inline-flex items-center gap-0.5">
                    <DualSyncDirectionIcon
                      iconKey={operation.directionIconKey}
                      className="size-3"
                    />
                    {operation.directionLabel}
                  </span>
                </TableCell>
                <TableCell className="font-mono text-[10px]">{operation.startedAtLabel}</TableCell>
                <TableCell className="text-[11px]">
                  {operation.errorCode ? (
                    <span className="font-mono text-destructive">{operation.errorCode}</span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                  {operation.errorPreview ? (
                    <div
                      className="mt-0.5 text-[10px] text-muted-foreground"
                      title={operation.errorMessage ?? undefined}
                    >
                      {operation.errorPreview}
                    </div>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
