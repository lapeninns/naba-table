import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { GuestsSummaryMetrics } from '@/components/features/customers/GuestsSummaryMetrics';

describe('GuestsSummaryMetrics', () => {
  it('renders KPI values and shows secondary metrics after expanding', async () => {
    const user = userEvent.setup();

    render(
      <GuestsSummaryMetrics
        summary={{
          total: 10,
          returning: 3,
          vip: 1,
          optedIn: 4,
          optedOut: 6,
          neverVisited: 2,
        }}
        isLoading={false}
        isUpdating={false}
      />,
    );

    expect(screen.getByText('Guest metrics')).toBeInTheDocument();
    expect(screen.getByText('Total guests')).toBeInTheDocument();
    expect(screen.getByTestId('guest-metric-total')).toHaveTextContent('10');
    expect(screen.getByTestId('guest-metric-returning')).toHaveTextContent('3');
    expect(screen.getByTestId('guest-metric-vip')).toHaveTextContent('1');
    expect(screen.getByTestId('guest-metric-optedIn')).toHaveTextContent('4');

    // Secondary metrics are hidden until expanded.
    expect(screen.queryByText('Opted out')).toBeNull();
    await user.click(screen.getByRole('button', { name: /more metrics/i }));

    expect(screen.getByText('Opted out')).toBeInTheDocument();
    expect(screen.getByTestId('guest-metric-optedOut')).toHaveTextContent('6');
    expect(screen.getByText('Never visited')).toBeInTheDocument();
    expect(screen.getByTestId('guest-metric-neverVisited')).toHaveTextContent('2');
  });

  it('shows a non-blocking message when summary is unavailable', () => {
    render(<GuestsSummaryMetrics summary={null} isLoading={false} isUpdating={false} />);
    expect(screen.getByText('Metrics unavailable')).toBeInTheDocument();
    expect(
      screen.getByText(/guest metrics couldn’t be calculated/i),
    ).toBeInTheDocument();
  });
});

