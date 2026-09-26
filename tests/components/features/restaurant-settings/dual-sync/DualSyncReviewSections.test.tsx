import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// Section internals carry their own suites; this test pins the grouping and filtering.
vi.mock('@/components/features/restaurant-settings/dual-sync/DualSyncReviewSection', () => ({
  DualSyncReviewSection: ({ sectionKey }: { sectionKey: string }) => (
    <div data-testid={`review-section-${sectionKey}`} />
  ),
}));

import { DualSyncReviewSections } from '@/components/features/restaurant-settings/dual-sync/DualSyncReviewSections';

import { makeDualSyncFieldSummary } from '../testUtils';

import type { DualSyncFieldSummary } from '@/services/ops/dual-sync';

function makeWorkspace() {
  const profile = [makeDualSyncFieldSummary({ state: 'conflict' }) as DualSyncFieldSummary];
  const hours = [
    makeDualSyncFieldSummary({
      fieldKey: 'hours.weekly',
      sectionKey: 'operatingHours',
      state: 'in_sync',
    }) as DualSyncFieldSummary,
  ];
  return {
    orderedSectionKeys: ['profile', 'operatingHours'] as const,
    fieldsBySection: new Map<string, DualSyncFieldSummary[]>([
      ['profile', profile],
      ['operatingHours', hours],
    ]),
    decisions: {},
    getSectionProgress: vi.fn(),
    onBulkSelectSection: vi.fn(),
    onClearSection: vi.fn(),
    onSelectAction: vi.fn(),
  } as unknown as Parameters<typeof DualSyncReviewSections>[0]['workspace'];
}

describe('DualSyncReviewSections', () => {
  it('@contract renders every ordered section in the All fields view', () => {
    render(
      <DualSyncReviewSections
        workspace={makeWorkspace()}
        showDriftOnly={false}
        writeBlocked={false}
      />,
    );

    expect(screen.getByTestId('review-section-profile')).toBeInTheDocument();
    expect(screen.getByTestId('review-section-operatingHours')).toBeInTheDocument();
  });

  it('@contract leaves out matching sections in the Differences only view', () => {
    render(
      <DualSyncReviewSections workspace={makeWorkspace()} showDriftOnly writeBlocked={false} />,
    );

    expect(screen.getByTestId('review-section-profile')).toBeInTheDocument();
    expect(screen.queryByTestId('review-section-operatingHours')).not.toBeInTheDocument();
  });

  it('@contract says there is nothing to review when every section matches', () => {
    const workspace = makeWorkspace();
    render(
      <DualSyncReviewSections
        workspace={{ ...workspace, orderedSectionKeys: ['operatingHours'] }}
        showDriftOnly
        writeBlocked={false}
      />,
    );

    expect(
      screen.getByText('Nabatable and Google match. There is nothing to review.'),
    ).toBeInTheDocument();
  });
});
