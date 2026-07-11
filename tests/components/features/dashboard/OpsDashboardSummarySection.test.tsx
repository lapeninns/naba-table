import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const { summaryCardSpy } = vi.hoisted(() => ({
  summaryCardSpy: vi.fn(() => <div data-testid="summary-card" />),
}));

vi.mock('@/components/features/dashboard/DashboardSummaryCard', () => ({
  DashboardSummaryCard: summaryCardSpy,
}));

import { OpsDashboardSummarySection } from '@/components/features/dashboard/OpsDashboardSummarySection';

import {
  PINNED_NOW_ISO,
  makeSummary,
} from '@tests/components/features/dashboard/__fixtures__/dashboardFixtures';

import type { OpsDashboardSummarySectionProps } from '@/components/features/dashboard/OpsDashboardSummarySection';

function makeProps(
  overrides: Partial<OpsDashboardSummarySectionProps> = {},
): OpsDashboardSummarySectionProps {
  return {
    summary: makeSummary(),
    restaurantName: 'Old Crown',
    controls: {} as OpsDashboardSummarySectionProps['controls'],
    bookingActions: {} as OpsDashboardSummarySectionProps['bookingActions'],
    initialNowIso: PINNED_NOW_ISO,
    allowTableAssignments: true,
    restaurantSlug: 'old-crown',
    isStale: false,
    ...overrides,
  };
}

describe('OpsDashboardSummarySection', () => {
  it('@contract renders the summary card without the lock badge when assignments are allowed', () => {
    render(<OpsDashboardSummarySection {...makeProps()} />);

    expect(screen.getByTestId('summary-card')).toBeInTheDocument();
    expect(screen.queryByText('Past date · Assignments locked')).not.toBeInTheDocument();
  });

  it('@contract surfaces the assignments-locked badge for past dates', () => {
    render(<OpsDashboardSummarySection {...makeProps({ allowTableAssignments: false })} />);

    expect(screen.getByText('Past date · Assignments locked')).toBeInTheDocument();
    expect(screen.getByTestId('summary-card')).toBeInTheDocument();
  });

  it('@contract forwards summary, controls, and stale flag to the summary card', () => {
    const props = makeProps({ isStale: true });
    render(<OpsDashboardSummarySection {...props} />);

    const forwarded = summaryCardSpy.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    expect(forwarded.summary).toBe(props.summary);
    expect(forwarded.restaurantName).toBe('Old Crown');
    expect(forwarded.isStale).toBe(true);
    expect(forwarded.allowTableAssignments).toBe(true);
    expect(forwarded.restaurantSlug).toBe('old-crown');
  });
});
