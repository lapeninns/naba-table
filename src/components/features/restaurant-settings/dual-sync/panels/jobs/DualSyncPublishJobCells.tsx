import { ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { TableCell } from '@/components/ui/table';

import { DualSyncPublishJobStatusBadge } from './DualSyncPublishJobStatusBadge';

import type { DualSyncPublishJobRowViewModel } from './dualSyncPublishJobRowDomain';

interface DualSyncPublishJobCellProps {
  readonly viewModel: DualSyncPublishJobRowViewModel;
}

export function DualSyncPublishJobStatusCell({ viewModel }: DualSyncPublishJobCellProps) {
  return (
    <TableCell>
      <DualSyncPublishJobStatusBadge status={viewModel.status} />
      {viewModel.hasErrorCodes ? (
        <div className="mt-1 flex flex-wrap gap-1">
          {viewModel.errorCodes.map((code) => (
            <span key={code} className="font-mono text-[10px] text-destructive">
              {code}
            </span>
          ))}
        </div>
      ) : null}
    </TableCell>
  );
}

export function DualSyncPublishJobIdentityCell({ viewModel }: DualSyncPublishJobCellProps) {
  return (
    <TableCell>
      <span className="font-mono text-[10px]" title={viewModel.id}>
        {viewModel.shortId}
      </span>
      <div className="mt-0.5 flex gap-2 text-[10px] text-muted-foreground">
        {viewModel.hasImportCount ? (
          <span className="inline-flex items-center gap-0.5">
            <ArrowDownToLine className="size-3" />
            {viewModel.importCount}
          </span>
        ) : null}
        {viewModel.hasExportCount ? (
          <span className="inline-flex items-center gap-0.5">
            <ArrowUpFromLine className="size-3" />
            {viewModel.exportCount}
          </span>
        ) : null}
      </div>
    </TableCell>
  );
}

export function DualSyncPublishJobCountsCell({ viewModel }: DualSyncPublishJobCellProps) {
  return (
    <TableCell className="text-right font-mono text-[10px]">
      <span className="text-primary">{viewModel.succeededCount}✓</span>
      {' / '}
      <span className="text-destructive">{viewModel.failedCount}✗</span>
      {viewModel.hasSkippedCount ? (
        <span className="text-muted-foreground">
          {' / '}
          {viewModel.skippedCount}–
        </span>
      ) : null}
    </TableCell>
  );
}

export function DualSyncPublishJobSectionsCell({ viewModel }: DualSyncPublishJobCellProps) {
  return (
    <TableCell>
      <div className="flex flex-wrap gap-1">
        {viewModel.sectionLabels.map((section) => (
          <Badge key={section.key} variant="outline" className="font-mono text-[10px]">
            {section.label}
          </Badge>
        ))}
      </div>
    </TableCell>
  );
}
