import { Clock, Trash2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TableCell, TableRow } from '@/components/ui/table';

import type { DualSyncPendingCandidateRowModel } from './dualSyncPendingCandidatesDomain';

export interface DualSyncPendingCandidateRowProps {
  readonly row: DualSyncPendingCandidateRowModel;
  readonly cancelDisabled: boolean;
  readonly onCancel: (candidateId: string) => void;
}

export function DualSyncPendingCandidateRow({
  row,
  cancelDisabled,
  onCancel,
}: DualSyncPendingCandidateRowProps) {
  return (
    <TableRow className="text-xs">
      <TableCell>
        <Badge
          variant={row.statusVariant}
          className="inline-flex items-center gap-1 font-mono text-[10px]"
        >
          <Clock className="size-3" />
          {row.statusLabel}
        </Badge>
      </TableCell>
      <TableCell>
        <div className="max-w-[280px] truncate font-mono text-[10px]">{row.fieldKey}</div>
        <div className="mt-0.5 max-w-[280px] truncate text-[10px] text-muted-foreground">
          {row.sectionKey}
        </div>
      </TableCell>
      <TableCell className="font-mono text-[10px]">{row.source}</TableCell>
      <TableCell className="font-mono text-[10px]">{row.baselineHashLabel}</TableCell>
      <TableCell className="font-mono text-[10px]">{row.updatedAtLabel}</TableCell>
      <TableCell className="text-right">
        {row.canCancel ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onCancel(row.id)}
            disabled={cancelDisabled}
          >
            <Trash2 data-icon="inline-start" />
            {row.isCancelling ? 'Cancelling' : 'Cancel'}
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">-</span>
        )}
      </TableCell>
    </TableRow>
  );
}
