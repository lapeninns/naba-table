import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DualSyncPublishPreviewSummaryBadges } from '@/components/features/restaurant-settings/dual-sync/DualSyncPublishPreviewSummaryBadges';

import type { DualSyncPublishPlan } from '@/server/dual-sync/publish/types';

describe('DualSyncPublishPreviewSummaryBadges', () => {
  it('@contract summarises accepted, rejected, ignored, and write groups', () => {
    const plan = {
      acceptedCount: 3,
      rejectedCount: 1,
      ignoredCount: 2,
      groups: [{ groupId: 'g1' }],
    } as unknown as Pick<
      DualSyncPublishPlan,
      'acceptedCount' | 'groups' | 'ignoredCount' | 'rejectedCount'
    >;
    render(<DualSyncPublishPreviewSummaryBadges plan={plan} />);

    expect(screen.getByText('3 accepted')).toBeInTheDocument();
    expect(screen.getByText('1 rejected')).toBeInTheDocument();
    expect(screen.getByText('2 ignored')).toBeInTheDocument();
  });
});
