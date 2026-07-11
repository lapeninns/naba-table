import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// Section and lazy-panel internals carry their own suites; this test pins the
// accordion composition (paused alert + single/multi accordion wiring).
vi.mock('@/components/features/restaurant-settings/dual-sync/DualSyncReviewSection', () => ({
  DualSyncReviewSection: ({ sectionKey }: { sectionKey: string }) => (
    <div data-testid={`review-section-${sectionKey}`} />
  ),
}));
vi.mock('@/components/features/restaurant-settings/dual-sync/DualSyncLazyPanels', () => ({
  DualSyncLazyPanels: () => <div data-testid="lazy-panels" />,
}));

import { DualSyncReviewAccordion } from '@/components/features/restaurant-settings/dual-sync/DualSyncReviewAccordion';

import type { useDualSyncWorkspace } from '@/components/features/restaurant-settings/dual-sync/hooks/useDualSyncWorkspace';

function makeWorkspace() {
  return {
    orderedSectionKeys: ['profile', 'operatingHours'],
    fieldsBySection: new Map(),
    decisions: {},
    getSectionProgress: vi.fn(),
    onBulkSelectSection: vi.fn(),
    onClearSection: vi.fn(),
    onSelectAction: vi.fn(),
    openSection: undefined,
    setOpenSection: vi.fn(),
    orderedAccordionValues: ['profile', 'operatingHours'],
  } as unknown as ReturnType<typeof useDualSyncWorkspace>;
}

describe('DualSyncReviewAccordion', () => {
  it('@contract renders a review section per ordered section plus the lazy panels', () => {
    render(
      <DualSyncReviewAccordion
        workspace={makeWorkspace()}
        showDriftOnly={false}
        writeBlocked={false}
        syncPaused={false}
        pauseReason=""
        singleOpenSections={false}
      />,
    );

    expect(screen.getByTestId('review-section-profile')).toBeInTheDocument();
    expect(screen.getByTestId('review-section-operatingHours')).toBeInTheDocument();
    expect(screen.getByTestId('lazy-panels')).toBeInTheDocument();
    expect(screen.queryByText('Dual-sync is paused.')).not.toBeInTheDocument();
  });

  it('@contract shows the paused alert while sync is paused', () => {
    render(
      <DualSyncReviewAccordion
        workspace={makeWorkspace()}
        showDriftOnly={false}
        writeBlocked
        syncPaused
        pauseReason="Paused by owner."
        singleOpenSections
      />,
    );

    expect(screen.getByText('Dual-sync is paused.')).toBeInTheDocument();
  });
});
