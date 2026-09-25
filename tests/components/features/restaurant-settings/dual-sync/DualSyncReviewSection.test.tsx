import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DualSyncReviewSection } from '@/components/features/restaurant-settings/dual-sync/DualSyncReviewSection';

import { makeDualSyncFieldSummary } from '../testUtils';

import type { DualSyncFieldSummary } from '@/services/ops/dual-sync';

const sectionProgress = {
  needsReviewCount: 1,
  draftedForReviewCount: 0,
  draftCoveragePercent: 0,
};

function renderSection(fields: ReadonlyArray<DualSyncFieldSummary>) {
  const handlers = {
    onBulkSelectSection: vi.fn(),
    onClearSection: vi.fn(),
    onSelectAction: vi.fn(),
  };
  render(
    <DualSyncReviewSection
      sectionKey="profile"
      fields={fields}
      decisions={{}}
      showDriftOnly={false}
      writeBlocked={false}
      getSectionProgress={() => sectionProgress}
      {...handlers}
    />,
  );
  return handlers;
}

describe('DualSyncReviewSection', () => {
  it('@contract renders the section header, bulk bar, and field rows', () => {
    renderSection([makeDualSyncFieldSummary() as DualSyncFieldSummary]);

    expect(screen.getByRole('region', { name: 'Profile' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Profile', level: 3 })).toBeInTheDocument();
    expect(screen.getByText(/0 of 1 chosen/)).toBeInTheDocument();
    expect(
      screen.getByRole('group', { name: /choose for every field in this section/i }),
    ).toBeInTheDocument();
    expect(screen.getByText('Business name')).toBeInTheDocument();
  });

  it('@contract routes per-field action selection with the field key', async () => {
    const user = userEvent.setup();
    const { onSelectAction } = renderSection([makeDualSyncFieldSummary() as DualSyncFieldSummary]);

    await user.click(screen.getByRole('radio', { name: 'Ignore' }));

    expect(onSelectAction).toHaveBeenCalledWith('profile.name', 'ignore');
  });

  it('@contract shows the empty message when no fields need attention', () => {
    renderSection([]);

    expect(screen.getByText(/No fields|match|in sync/i)).toBeInTheDocument();
  });
});
