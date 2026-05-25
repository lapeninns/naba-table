'use client';

import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';

import { DualSyncPublishJobRow } from './DualSyncPublishJobRow';

import type { DualSyncPublishJobRollup } from '@/server/dual-sync/publish/operations';
import type { GetDualSyncPublishJobDetailResponse } from '@/services/ops/dual-sync';
import type { UseQueryResult } from '@tanstack/react-query';

export interface DualSyncPublishJobsTableProps {
  readonly jobs: readonly DualSyncPublishJobRollup[];
  readonly selectedJobId?: string | null;
  readonly onSelectJob?: (jobId: string | null) => void;
  readonly publishJobDetailQuery?: UseQueryResult<GetDualSyncPublishJobDetailResponse, Error>;
}

export function DualSyncPublishJobsTable({
  jobs,
  selectedJobId,
  onSelectJob,
  publishJobDetailQuery,
}: DualSyncPublishJobsTableProps) {
  const detailEnabled = typeof onSelectJob === 'function';

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {detailEnabled ? <TableHead className="w-[28px]" /> : null}
          <TableHead className="w-[110px]">Status</TableHead>
          <TableHead className="w-[110px]">Job</TableHead>
          <TableHead className="w-[140px]">Started</TableHead>
          <TableHead className="w-[80px] text-right">Duration</TableHead>
          <TableHead className="w-[150px] text-right">Counts</TableHead>
          <TableHead>Sections</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {jobs.map((job) => {
          const isSelected = detailEnabled && selectedJobId === job.publishJobId;
          const colSpan = detailEnabled ? 7 : 6;

          return (
            <DualSyncPublishJobRow
              key={job.publishJobId}
              job={job}
              isSelected={isSelected}
              detailEnabled={detailEnabled}
              onSelectJob={onSelectJob}
              publishJobDetailQuery={publishJobDetailQuery}
              colSpan={colSpan}
            />
          );
        })}
      </TableBody>
    </Table>
  );
}
