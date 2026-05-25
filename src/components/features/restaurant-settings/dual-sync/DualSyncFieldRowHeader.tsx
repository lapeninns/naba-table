import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';

import { DualSyncFieldFreshnessIndicator } from './DualSyncFieldFreshnessIndicator';
import { DualSyncStateBadge } from './DualSyncStateBadge';

import type { DualSyncFieldRowModel } from './dualSyncFieldRowDomain';

export function DualSyncFieldRowHeader({ model }: { readonly model: DualSyncFieldRowModel }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Label className="text-sm font-semibold">{model.label}</Label>
          <DualSyncStateBadge state={model.state} />
          {model.hasOpenCandidate ? (
            <Badge variant="outline" className="text-xs">
              Pending export queued
            </Badge>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-1">
          {model.policyLabels.map((label) => (
            <Badge key={label} variant="secondary" className="text-[11px] font-medium">
              {label}
            </Badge>
          ))}
        </div>
        {model.helpText ? (
          <p className="text-muted-foreground text-xs leading-snug">{model.helpText}</p>
        ) : null}
      </div>
      <DualSyncFieldFreshnessIndicator freshness={model.freshness} />
    </div>
  );
}
