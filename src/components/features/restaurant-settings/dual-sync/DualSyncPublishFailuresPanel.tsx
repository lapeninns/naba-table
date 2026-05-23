import { AlertCircle } from 'lucide-react';

import type { DualSyncPublishResponse } from '@/services/ops/dual-sync';

type DualSyncPublishFailuresPanelProps = {
  failures: DualSyncPublishResponse['failures'];
};

export function DualSyncPublishFailuresPanel({ failures }: DualSyncPublishFailuresPanelProps) {
  if (failures.length === 0) return null;

  return (
    <div className="rounded-md border border-destructive/40 p-3">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-destructive">
        <AlertCircle className="size-4" />
        Failure codes
      </div>
      <div className="flex flex-col gap-2">
        {failures.map(({ fieldKey, failure }) => (
          <div key={`${fieldKey}-${failure.code}`} className="text-xs">
            <span className="font-mono">{fieldKey}</span>
            <span className="text-muted-foreground">
              {' '}
              / {failure.code}: {failure.message}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
