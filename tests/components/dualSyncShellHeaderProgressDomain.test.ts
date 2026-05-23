import { describe, expect, it } from 'vitest';

import { getDualSyncShellHeaderProgressState } from '@/components/features/restaurant-settings/dual-sync/dualSyncShellHeaderProgressDomain';

import type { WorkspaceReviewProgress } from '@/components/features/restaurant-settings/dual-sync/workspace-progress';

function progress(overrides: Partial<WorkspaceReviewProgress> = {}): WorkspaceReviewProgress {
  return {
    totalFields: 4,
    inSyncCount: 2,
    needsReviewCount: 2,
    draftedForReviewCount: 1,
    syncHealthPercent: 50,
    draftCoveragePercent: 50,
    ...overrides,
  };
}

describe('dualSyncShellHeaderProgressDomain', () => {
  it('builds progress copy for review and no-review states', () => {
    expect(getDualSyncShellHeaderProgressState(progress())).toMatchObject({
      hasReview: true,
      leadLabel: 'Review queue: ',
      body: '1 of 2 fields that differ from Google have a draft action. Finish choices in each section, then Publish.',
      matchPercent: 50,
      draftPercent: 50,
      value: 50,
      ariaLabel: 'Progress drafting decisions for fields that differ from Google',
    });

    expect(
      getDualSyncShellHeaderProgressState(
        progress({
          needsReviewCount: 0,
          draftedForReviewCount: 0,
          syncHealthPercent: 100,
          draftCoveragePercent: 100,
        }),
      ),
    ).toMatchObject({
      hasReview: false,
      leadLabel: 'Up to date: ',
      value: 100,
      ariaLabel: 'Share of visible fields in sync with Google',
    });
  });
});
