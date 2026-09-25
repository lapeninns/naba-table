import { Badge } from '@/components/ui/badge';
import { Text } from '@/components/ui/typography';

import { DualSyncFieldFreshnessIndicator } from './DualSyncFieldFreshnessIndicator';
import { DualSyncStateBadge } from './DualSyncStateBadge';

import type { DualSyncFieldRowModel } from './dualSyncFieldRowDomain';

export function DualSyncFieldRowHeader({ model }: { readonly model: DualSyncFieldRowModel }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <Text as="h4" variant="subheading" className="text-sm leading-5">
        {model.label}
      </Text>
      <div className="flex flex-wrap items-center gap-1">
        <DualSyncStateBadge state={model.state} />
        {model.hasOpenCandidate ? (
          <Badge variant="outline" className="text-xs">
            Pending export queued
          </Badge>
        ) : null}
        {model.policyLabels.map((label) => (
          <Badge key={label} variant="secondary" className="text-[11px] font-medium">
            {label}
          </Badge>
        ))}
      </div>
      {model.helpText ? <Text variant="caption">{model.helpText}</Text> : null}
      <DualSyncFieldFreshnessIndicator freshness={model.freshness} />
    </div>
  );
}
