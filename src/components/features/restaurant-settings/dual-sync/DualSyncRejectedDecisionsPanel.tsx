import { AlertTriangle } from 'lucide-react';

import type { DualSyncPublishPlan } from '@/server/dual-sync/publish/types';

type DualSyncRejectedDecisionsPanelProps = {
  rejected: DualSyncPublishPlan['rejected'];
};

export function DualSyncRejectedDecisionsPanel({ rejected }: DualSyncRejectedDecisionsPanelProps) {
  if (rejected.length === 0) return null;

  return (
    <div className="rounded-md border border-destructive/40 p-3">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-destructive">
        <AlertTriangle className="size-4" />
        Rejected decisions
      </div>
      <div className="flex flex-col gap-2">
        {rejected.map((decision) => (
          <div key={`${decision.fieldKey}-${decision.action}`} className="text-xs">
            <span className="font-mono">{decision.fieldKey}</span>
            <span className="text-muted-foreground">
              {' '}
              / {decision.failure.code}: {decision.failure.message}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
