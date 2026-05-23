import { DualSyncFreshnessChip } from './DualSyncFreshnessChip';

import type { DualSyncFieldFreshnessDescriptor } from './dualSyncFieldRowDomain';

export interface DualSyncFieldFreshnessIndicatorProps {
  readonly freshness: DualSyncFieldFreshnessDescriptor | null;
}

export function DualSyncFieldFreshnessIndicator({
  freshness,
}: DualSyncFieldFreshnessIndicatorProps) {
  if (!freshness) return null;

  return (
    <DualSyncFreshnessChip
      timestamp={freshness.timestamp}
      prefix={freshness.prefix}
      neverLabel={freshness.neverLabel}
    />
  );
}
