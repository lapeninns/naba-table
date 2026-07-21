import { Progress } from '@/components/ui/progress';
import { Text } from '@/components/ui/typography';

import { getDualSyncShellHeaderProgressState } from './dualSyncShellHeaderProgressDomain';

import type { WorkspaceReviewProgress } from './workspace-progress';

export interface DualSyncShellHeaderProgressProps {
  readonly workspaceProgress: WorkspaceReviewProgress;
}

export function DualSyncShellHeaderProgress({
  workspaceProgress,
}: DualSyncShellHeaderProgressProps) {
  const progress = getDualSyncShellHeaderProgressState(workspaceProgress);

  return (
    <div className="flex w-full flex-col gap-2 border-t border-border/60 pt-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <Text variant="caption" className="max-w-3xl">
          <span className="text-foreground font-medium">{progress.leadLabel}</span>
          {progress.body}
        </Text>
        <div className="text-muted-foreground flex shrink-0 flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[10px] tabular-nums">
          <span title="Share of visible fields whose snapshot matches Google">
            Match {progress.matchPercent}%
          </span>
          {progress.hasReview ? (
            <span title="Draft actions covering fields that still differ">
              . Draft {progress.draftPercent}%
            </span>
          ) : null}
        </div>
      </div>
      <Progress value={progress.value} className="h-2" aria-label={progress.ariaLabel} />
    </div>
  );
}
