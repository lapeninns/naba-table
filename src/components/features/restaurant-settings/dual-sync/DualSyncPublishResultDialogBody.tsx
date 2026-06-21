import { DualSyncPublishFailuresPanel } from './DualSyncPublishFailuresPanel';
import { DualSyncPublishOperationsTable } from './DualSyncPublishOperationsTable';
import { DualSyncPublishResultSummaryBadges } from './DualSyncPublishResultSummaryBadges';

import type { DualSyncPublishResponse } from '@/services/ops/dual-sync';

interface DualSyncPublishResultDialogBodyProps {
  readonly result: DualSyncPublishResponse | null;
}

export function DualSyncPublishResultDialogBody({ result }: DualSyncPublishResultDialogBodyProps) {
  if (!result) {
    return (
      <div className="rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground">
        No publish result is loaded.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <DualSyncPublishResultSummaryBadges result={result} />
      <DualSyncPublishFailuresPanel failures={result.failures} />
      <DualSyncPublishOperationsTable operations={result.operations} />
    </div>
  );
}
