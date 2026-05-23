import { TableCell, TableRow } from '@/components/ui/table';

import { DualSyncPublishJobDetailContent } from './DualSyncPublishJobDetailContent';

import type { GetDualSyncPublishJobDetailResponse } from '@/services/ops/dual-sync';
import type { UseQueryResult } from '@tanstack/react-query';

interface DualSyncPublishJobDetailRowProps {
  readonly jobId: string;
  readonly colSpan: number;
  readonly publishJobDetailQuery?: UseQueryResult<GetDualSyncPublishJobDetailResponse, Error>;
}

export function DualSyncPublishJobDetailRow({
  jobId,
  colSpan,
  publishJobDetailQuery,
}: DualSyncPublishJobDetailRowProps) {
  return (
    <TableRow className="bg-muted/20">
      <TableCell colSpan={colSpan} className="p-0">
        <DualSyncPublishJobDetailContent
          jobId={jobId}
          publishJobDetailQuery={publishJobDetailQuery}
        />
      </TableCell>
    </TableRow>
  );
}
