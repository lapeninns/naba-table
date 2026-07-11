import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { OpsEmailDeliverySummaryMetricCards } from '@/components/features/email-delivery/components/OpsEmailDeliverySummaryMetricCards';

import type { OpsEmailPrimaryMetric } from '@/components/features/email-delivery/opsEmailDeliverySummaryMetricsDomain';

const metrics: OpsEmailPrimaryMetric[] = [
  {
    key: 'total',
    label: 'Total attempts',
    value: '10',
    tone: 'neutral',
    filterStatus: null,
    testId: 'email-metric-total',
  },
  {
    key: 'delivered',
    label: 'Delivered',
    value: '7',
    hint: '70% delivered',
    tone: 'good',
    filterStatus: 'delivered',
    testId: 'email-metric-delivered',
  },
  {
    key: 'failures',
    label: 'Failures',
    value: '3',
    hint: '30% failure rate',
    tone: 'bad',
    testId: 'email-metric-failures',
  },
];

describe('OpsEmailDeliverySummaryMetricCards', () => {
  it('@smoke renders every metric tile with value and hint', () => {
    render(<OpsEmailDeliverySummaryMetricCards metrics={metrics} />);

    expect(screen.getByTestId('email-metric-total')).toHaveTextContent('10');
    expect(screen.getByTestId('email-metric-delivered')).toHaveTextContent('7');
    expect(screen.getByText('70% delivered')).toBeInTheDocument();
    expect(screen.getByTestId('email-metric-failures')).toHaveTextContent('3');
  });

  it('@contract renders tiles as buttons only when a filter handler is wired', () => {
    const { rerender } = render(<OpsEmailDeliverySummaryMetricCards metrics={metrics} />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);

    rerender(<OpsEmailDeliverySummaryMetricCards metrics={metrics} onFilterStatus={vi.fn()} />);
    // Only metrics carrying a filterStatus key become clickable.
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });

  it('@contract reports the metric filter status (or null for total) when a tile is clicked', async () => {
    const onFilterStatus = vi.fn();
    const user = userEvent.setup();
    render(<OpsEmailDeliverySummaryMetricCards metrics={metrics} onFilterStatus={onFilterStatus} />);

    await user.click(screen.getByRole('button', { name: /delivered/i }));
    expect(onFilterStatus).toHaveBeenCalledWith('delivered');

    await user.click(screen.getByRole('button', { name: /total attempts/i }));
    expect(onFilterStatus).toHaveBeenCalledWith(null);
  });
});
