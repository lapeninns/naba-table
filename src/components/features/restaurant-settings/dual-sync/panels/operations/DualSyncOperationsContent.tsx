import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

import { DualSyncOperationRow } from './DualSyncOperationRow';

import type { DualSyncPublishOperation } from '@/server/dual-sync';

export function DualSyncOperationsContent({
  className,
  operations,
}: {
  readonly className?: string;
  readonly operations: ReadonlyArray<DualSyncPublishOperation>;
}) {
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
            <DualSyncOperationRow key={op.id} operation={op} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
