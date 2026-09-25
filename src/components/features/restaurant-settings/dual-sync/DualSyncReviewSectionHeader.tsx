import { Text } from '@/components/ui/typography';

import type { DualSyncReviewSectionState } from './dualSyncReviewSectionDomain';

interface DualSyncReviewSectionHeaderProps {
  readonly headingId: string;
  readonly sectionState: DualSyncReviewSectionState;
}

export function DualSyncReviewSectionHeader({
  headingId,
  sectionState,
}: DualSyncReviewSectionHeaderProps) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
      <Text as="h3" variant="subheading" id={headingId} className="text-sm">
        {sectionState.sectionLabel}
      </Text>
      <Text variant="caption" as="span" className="tabular-nums">
        {sectionState.countLabel}
        {sectionState.progressLabel ? ` · ${sectionState.progressLabel}` : ''}
      </Text>
    </div>
  );
}
