import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

import { DualSyncPendingCandidateRow } from './DualSyncPendingCandidateRow';

import type { DualSyncPendingCandidateRowModel } from './dualSyncPendingCandidatesDomain';

export function DualSyncPendingCandidatesContent({
  cancelDisabled,
  candidateRows,
  className,
  onCancel,
}: {
  readonly cancelDisabled: boolean;
  readonly candidateRows: ReadonlyArray<DualSyncPendingCandidateRowModel>;
  readonly className?: string;
  readonly onCancel: (candidateId: string) => void;
}) {
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
          {candidateRows.map((row) => (
            <DualSyncPendingCandidateRow
              key={row.id}
              row={row}
              cancelDisabled={cancelDisabled}
              onCancel={onCancel}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
