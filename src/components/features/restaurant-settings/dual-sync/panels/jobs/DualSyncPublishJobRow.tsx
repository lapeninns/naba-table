'use client';

import { TableCell, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

import {
  DualSyncPublishJobCountsCell,
  DualSyncPublishJobIdentityCell,
  DualSyncPublishJobSectionsCell,
  DualSyncPublishJobStatusCell,
} from './DualSyncPublishJobCells';
import { DualSyncPublishJobDetailRow } from './DualSyncPublishJobDetailRow';
import { DualSyncPublishJobExpandCell } from './DualSyncPublishJobExpandCell';
import { buildDualSyncPublishJobRowViewModel } from './dualSyncPublishJobRowDomain';

import type { DualSyncPublishJobRollup } from '@/server/dual-sync/publish/operations';
import type { GetDualSyncPublishJobDetailResponse } from '@/services/ops/dual-sync';
import type { UseQueryResult } from '@tanstack/react-query';

export interface DualSyncPublishJobRowProps {
  readonly job: DualSyncPublishJobRollup;
  readonly isSelected: boolean;
  readonly detailEnabled: boolean;
  readonly onSelectJob?: (jobId: string | null) => void;
  readonly publishJobDetailQuery?: UseQueryResult<GetDualSyncPublishJobDetailResponse, Error>;
  readonly colSpan: number;
}

export function DualSyncPublishJobRow({
  job,
  isSelected,
  detailEnabled,
  onSelectJob,
  publishJobDetailQuery,
  colSpan,
}: DualSyncPublishJobRowProps) {
  const viewModel = buildDualSyncPublishJobRowViewModel(job);
  const handleToggle = () => {
    if (!onSelectJob) return;
    onSelectJob(isSelected ? null : viewModel.id);
  };

  return (
    <>
      <TableRow
        className={cn(
          'text-xs',
          isSelected ? 'bg-muted/40' : undefined,
          detailEnabled ? 'cursor-pointer' : undefined,
        )}
        onClick={detailEnabled ? handleToggle : undefined}
      >
        {detailEnabled ? (
          <DualSyncPublishJobExpandCell isSelected={isSelected} onToggle={handleToggle} />
        ) : null}
        <DualSyncPublishJobStatusCell viewModel={viewModel} />
        <DualSyncPublishJobIdentityCell viewModel={viewModel} />
        <TableCell className="font-mono text-[10px]">{viewModel.startedAtLabel}</TableCell>
        <TableCell className="text-right font-mono text-[10px]">
          {viewModel.durationLabel}
        </TableCell>
        <DualSyncPublishJobCountsCell viewModel={viewModel} />
        <DualSyncPublishJobSectionsCell viewModel={viewModel} />
      </TableRow>
      {isSelected ? (
        <DualSyncPublishJobDetailRow
          jobId={viewModel.id}
          colSpan={colSpan}
          publishJobDetailQuery={publishJobDetailQuery}
        />
      ) : null}
    </>
  );
}
