import { CheckCircle2, CircleDashed, XCircle } from 'lucide-react';

import { Badge } from '@/components/ui/badge';

import type { DualSyncPublishResponse } from '@/services/ops/dual-sync';

type DualSyncPublishResultSummaryBadgesProps = {
  result: DualSyncPublishResponse;
};

export function DualSyncPublishResultSummaryBadges({
  result,
}: DualSyncPublishResultSummaryBadgesProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <Badge variant="status-confirmed">
        <CheckCircle2 className="size-3" />
        {result.succeededCount} succeeded
      </Badge>
      <Badge variant={result.failedCount > 0 ? 'status-cancelled' : 'secondary'}>
        <XCircle className="size-3" />
        {result.failedCount} failed
      </Badge>
      <Badge variant="status-pending">
        <CircleDashed className="size-3" />
        {result.skippedCount} skipped
      </Badge>
    </div>
  );
}
