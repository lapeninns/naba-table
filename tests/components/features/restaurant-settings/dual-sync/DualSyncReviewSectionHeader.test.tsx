import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DualSyncReviewSectionHeader } from '@/components/features/restaurant-settings/dual-sync/DualSyncReviewSectionHeader';

import type { DualSyncReviewSectionState } from '@/components/features/restaurant-settings/dual-sync/dualSyncReviewSectionDomain';

const sectionState: DualSyncReviewSectionState = {
  sectionLabel: 'Profile',
  displayedFields: [],
  countLabel: '2 differences',
  progressLabel: '1 of 2 chosen',
  emptyMessage: 'Nabatable and Google match for this section.',
};

describe('DualSyncReviewSectionHeader', () => {
  it('@contract @a11y renders the section heading with difference and choice counts', () => {
    render(<DualSyncReviewSectionHeader headingId="section-profile" sectionState={sectionState} />);

    expect(screen.getByRole('heading', { name: 'Profile', level: 3 })).toHaveAttribute(
      'id',
      'section-profile',
    );
    expect(screen.getByText('2 differences · 1 of 2 chosen')).toBeInTheDocument();
  });

  it('@contract omits the choice count when nothing needs a choice', () => {
    render(
      <DualSyncReviewSectionHeader
        headingId="section-profile"
        sectionState={{ ...sectionState, progressLabel: null, countLabel: '0 differences' }}
      />,
    );

    expect(screen.getByText('0 differences')).toBeInTheDocument();
  });
});
