import type { WorkspaceReviewProgress } from './workspace-progress';

export interface DualSyncShellHeaderProgressState {
  readonly hasReview: boolean;
  readonly leadLabel: string;
  readonly body: string;
  readonly matchPercent: number;
  readonly draftPercent: number;
  readonly value: number;
  readonly ariaLabel: string;
}

export function getDualSyncShellHeaderProgressState(
  progress: WorkspaceReviewProgress,
): DualSyncShellHeaderProgressState {
  const hasReview = progress.needsReviewCount > 0;
  return {
    hasReview,
    leadLabel: hasReview ? 'Review queue: ' : 'Up to date: ',
    body: hasReview
      ? `${progress.draftedForReviewCount} of ${progress.needsReviewCount} fields that differ from Google have a draft action. Finish choices in each section, then Publish.`
      : 'No visible fields currently need a sync direction (drift, conflict, or failure).',
    matchPercent: Math.round(progress.syncHealthPercent),
    draftPercent: Math.round(progress.draftCoveragePercent),
    value: hasReview ? progress.draftCoveragePercent : progress.syncHealthPercent,
    ariaLabel: hasReview
      ? 'Progress drafting decisions for fields that differ from Google'
      : 'Share of visible fields in sync with Google',
  };
}
