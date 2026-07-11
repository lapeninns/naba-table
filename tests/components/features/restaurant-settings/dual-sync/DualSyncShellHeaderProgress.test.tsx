import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DualSyncShellHeaderProgress } from '@/components/features/restaurant-settings/dual-sync/DualSyncShellHeaderProgress';

import type { WorkspaceReviewProgress } from '@/components/features/restaurant-settings/dual-sync/workspace-progress';

function makeProgress(over: Partial<WorkspaceReviewProgress> = {}): WorkspaceReviewProgress {
  return {
    totalFields: 10,
    inSyncCount: 8,
    needsReviewCount: 2,
    draftedForReviewCount: 1,
    syncHealthPercent: 80,
    draftCoveragePercent: 50,
    ...over,
  };
}

describe('DualSyncShellHeaderProgress', () => {
  it('@contract @a11y renders match and draft percentages with a labelled progress bar', () => {
    render(<DualSyncShellHeaderProgress workspaceProgress={makeProgress()} />);

    expect(screen.getByText('Match 80%')).toBeInTheDocument();
    expect(screen.getByText(/Draft 50%/)).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAccessibleName(expect.any(String));
  });

  it('@contract hides the draft share when nothing needs review', () => {
    render(
      <DualSyncShellHeaderProgress
        workspaceProgress={makeProgress({
          needsReviewCount: 0,
          draftedForReviewCount: 0,
          syncHealthPercent: 100,
          draftCoveragePercent: 100,
        })}
      />,
    );

    expect(screen.getByText('Match 100%')).toBeInTheDocument();
    expect(screen.queryByText(/Draft/)).not.toBeInTheDocument();
  });
});
