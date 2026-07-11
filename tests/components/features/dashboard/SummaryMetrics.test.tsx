import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { SummaryMetrics } from '@/components/features/dashboard/SummaryMetrics';

import { makeTotals } from '@tests/components/features/dashboard/__fixtures__/dashboardFixtures';

describe('SummaryMetrics', () => {
  it('@contract renders primary KPI tiles with their raw values, including zero', () => {
    render(
      <SummaryMetrics totals={makeTotals({ upcoming: 7, pending: 0, noShow: 2 })} primaryOnly />,
    );

    const upcoming = screen.getByText('Upcoming').closest('[class*="rounded"]');
    expect(upcoming).not.toBeNull();
    expect(screen.getByText('Upcoming')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
    // Zero is rendered, not hidden.
    expect(screen.getByText('No shows')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    const zeroes = screen.getAllByText('0');
    expect(zeroes.length).toBeGreaterThanOrEqual(1);
  });

  it('@contract primaryOnly hides the secondary metric grid', () => {
    render(
      <SummaryMetrics
        totals={makeTotals({ total: 11, covers: 42, confirmed: 5 })}
        primaryOnly
      />,
    );

    expect(screen.queryByText('Bookings')).not.toBeInTheDocument();
    expect(screen.queryByText('Covers')).not.toBeInTheDocument();
    expect(screen.queryByText('Confirmed')).not.toBeInTheDocument();
  });

  it('@contract renders secondary metrics inline with large values intact', () => {
    render(
      <SummaryMetrics
        totals={makeTotals({ total: 1250, covers: 98765, confirmed: 3, completed: 1, cancelled: 0 })}
      />,
    );

    expect(screen.getByText('Bookings')).toBeInTheDocument();
    expect(screen.getByText('1250')).toBeInTheDocument();
    expect(screen.getByText('Covers')).toBeInTheDocument();
    // No thousands formatting is applied; the raw number is shown.
    expect(screen.getByText('98765')).toBeInTheDocument();
    expect(screen.getByText('Shows')).toBeInTheDocument();
    expect(screen.getByText('Cancelled')).toBeInTheDocument();
  });

  it('@contract collapsibleSecondary hides secondary metrics behind the More metrics toggle', async () => {
    const user = userEvent.setup();
    render(
      <SummaryMetrics
        totals={makeTotals({ total: 9, covers: 31 })}
        collapsibleSecondary
      />,
    );

    const trigger = screen.getByRole('button', { name: 'Toggle more metrics' });
    expect(screen.queryByText('Covers')).not.toBeInTheDocument();

    await user.click(trigger);

    expect(screen.getByText('Covers')).toBeInTheDocument();
    expect(screen.getByText('31')).toBeInTheDocument();
    expect(within(screen.getByText('Covers').parentElement as HTMLElement).getByText('31')).toBeInTheDocument();
  });
});
