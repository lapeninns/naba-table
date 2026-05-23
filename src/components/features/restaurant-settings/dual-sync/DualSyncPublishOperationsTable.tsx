import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { buildDualSyncPublishOperationTableRows } from './dualSyncPublishResultDomain';

import type { DualSyncPublishResponse } from '@/services/ops/dual-sync';

type DualSyncPublishOperationsTableProps = {
  operations: DualSyncPublishResponse['operations'];
};

export function DualSyncPublishOperationsTable({
  operations,
}: DualSyncPublishOperationsTableProps) {
  if (operations.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground">
        No operation rows were returned for this publish.
      </div>
    );
  }

  const rows = buildDualSyncPublishOperationTableRows(operations);

  return (
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
          {rows.map((row) => (
            <TableRow key={row.id} className="text-xs">
              <TableCell>
                <Badge variant={row.statusVariant} className="font-mono text-[10px]">
                  {row.status}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="font-mono text-[10px]">{row.fieldKey}</div>
                {row.errorCode ? (
                  <div className="mt-0.5 font-mono text-[10px] text-destructive">
                    {row.errorCode}
                  </div>
                ) : null}
              </TableCell>
              <TableCell className="font-mono text-[10px]">{row.direction}</TableCell>
              <TableCell className="font-mono text-[10px]">{row.maskLabel}</TableCell>
              <TableCell className="font-mono text-[10px]">{row.finishedAtLabel}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
