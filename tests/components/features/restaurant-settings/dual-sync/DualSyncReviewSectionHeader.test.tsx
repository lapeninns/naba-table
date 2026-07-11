import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DualSyncReviewSectionHeader } from '@/components/features/restaurant-settings/dual-sync/DualSyncReviewSectionHeader';

import type { DualSyncReviewSectionState } from '@/components/features/restaurant-settings/dual-sync/dualSyncReviewAccordionDomain';

const sectionState = {
  sectionLabel: 'Profile',
  displayedFields: [],
  countBadgeLabel: '2 of 4',
  hasSectionReview: true,
  progressLeadLabel: 'Review coverage',
  progressCountLabel: '1/2 drafted',
  progressValue: 50,
  progressAriaLabel: 'Profile review coverage 50%',
  emptyMessage: 'Everything in this section matches Google.',
} as unknown as DualSyncReviewSectionState;

describe('DualSyncReviewSectionHeader', () => {
  it('@contract @a11y renders section label, count badge, and labelled progress', () => {
    render(<DualSyncReviewSectionHeader sectionState={sectionState} />);

    expect(screen.getByText('Profile')).toBeInTheDocument();
    expect(screen.getByText('2 of 4')).toBeInTheDocument();
    expect(screen.getByText('1/2 drafted')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAccessibleName('Profile review coverage 50%');
  });
});
