import { Badge } from '@/components/ui/badge';

import {
  buildDualSyncPublishBatchViewModel,
  type DualSyncPublishBatchViewModel,
} from './dualSyncPublishJobDetailDomain';

import type { DualSyncPublishBatch } from '@/server/dual-sync';

export interface DualSyncPublishBatchSummaryProps {
  readonly batch: DualSyncPublishBatch;
}

export function DualSyncPublishBatchSummary({ batch }: DualSyncPublishBatchSummaryProps) {
  return <DualSyncPublishBatchSummaryView batch={buildDualSyncPublishBatchViewModel(batch)} />;
}

function DualSyncPublishBatchSummaryView({
  batch,
}: {
  readonly batch: DualSyncPublishBatchViewModel;
}) {
  return (
    <div className="rounded-md border bg-background p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-[11px] font-semibold text-muted-foreground">Publish batch</div>
          <div className="mt-1 font-mono text-[10px]" title={batch.id}>
            {batch.id}
          </div>
        </div>
        <Badge variant="outline" className="font-mono text-[10px]">
          {batch.status}
        </Badge>
      </div>
      <div className="mt-2 grid gap-2 text-[10px] text-muted-foreground md:grid-cols-4">
        <div>
          <span className="font-semibold text-foreground">{batch.acceptedCount}</span> accepted
        </div>
        <div>
          <span className="font-semibold text-foreground">{batch.rejectedCount}</span> rejected
        </div>
        <div>
          <span className="font-semibold text-foreground">{batch.ignoredCount}</span> ignored
        </div>
        <div className="font-mono">{batch.clientRequestLabel}</div>
      </div>
    </div>
  );
}
