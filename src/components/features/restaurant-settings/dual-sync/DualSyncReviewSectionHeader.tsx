import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

import type { DualSyncReviewSectionState } from './dualSyncReviewAccordionDomain';

interface DualSyncReviewSectionHeaderProps {
  readonly sectionState: DualSyncReviewSectionState;
}

export function DualSyncReviewSectionHeader({ sectionState }: DualSyncReviewSectionHeaderProps) {
  return (
    <div className="flex w-full flex-col gap-2 pr-2 sm:flex-row sm:items-center sm:justify-between">
      <span className="flex items-center gap-2 text-left">
        <span>{sectionState.sectionLabel}</span>
        <Badge variant="outline" className="h-4 px-1.5 py-0 font-mono text-[10px] font-normal">
          {sectionState.countBadgeLabel}
        </Badge>
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1 sm:max-w-56">
        <div className="flex items-center justify-between gap-2 font-mono text-[10px] font-normal tabular-nums text-muted-foreground">
          <span>{sectionState.progressLeadLabel}</span>
          <span>{sectionState.progressCountLabel}</span>
        </div>
        <Progress
          value={sectionState.progressValue}
          className="h-1.5"
          aria-label={sectionState.progressAriaLabel}
        />
      </div>
    </div>
  );
}
