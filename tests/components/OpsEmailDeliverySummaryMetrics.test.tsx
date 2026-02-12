import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { OpsEmailDeliverySummaryMetrics } from '@/components/features/email-delivery/components/OpsEmailDeliverySummaryMetrics';

describe('OpsEmailDeliverySummaryMetrics', () => {
  it('renders KPI values and shows secondary metrics after expanding', async () => {
    const user = userEvent.setup();

    render(
      <OpsEmailDeliverySummaryMetrics
        summary={{
          total: 10,
          sent: 2,
          delivered: 5,
          deliveryDelayed: 1,
          bounced: 1,
          complained: 0,
          failed: 1,
          deliveredRate: 0.5,
          failureRate: 0.2,
          uniqueRecipients: 7,
          uniqueBookings: 6,
          p50DeliverySeconds: 42,
          p95DeliverySeconds: 120,
          topFailedTemplates: [{ templateType: 'booking_confirmation', count: 2 }],
          topFailedEmailTypes: [{ emailType: 'booking_confirmation', count: 2 }],
        }}
        isLoading={false}
        isUpdating={false}
      />,
    );

    expect(screen.getByText('Deliverability')).toBeInTheDocument();
    expect(screen.getByTestId('email-metric-total')).toHaveTextContent('10');
    expect(screen.getByTestId('email-metric-delivered')).toHaveTextContent('5');
    expect(screen.getByTestId('email-metric-delayed')).toHaveTextContent('1');
    expect(screen.getByTestId('email-metric-failures')).toHaveTextContent('2');

    // Secondary metrics are hidden until expanded.
    expect(screen.queryByText('Unique recipients')).toBeNull();
    await user.click(screen.getByRole('button', { name: /more metrics/i }));

    expect(screen.getByText('Unique recipients')).toBeInTheDocument();
    expect(screen.getByTestId('email-metric-uniqueRecipients')).toHaveTextContent('7');
    expect(screen.getByText('Unique bookings')).toBeInTheDocument();
    expect(screen.getByTestId('email-metric-uniqueBookings')).toHaveTextContent('6');
    expect(screen.getByText('p50 delivery time')).toBeInTheDocument();
    expect(screen.getByTestId('email-metric-p50DeliverySeconds')).toHaveTextContent(/s|m/);
    expect(screen.getByText('Top failed templates')).toBeInTheDocument();
    expect(screen.getAllByText('booking_confirmation').length).toBeGreaterThan(0);
  });

  it('shows a non-blocking message when summary is unavailable', () => {
    render(<OpsEmailDeliverySummaryMetrics summary={null} isLoading={false} isUpdating={false} />);
    expect(screen.getByText('Metrics unavailable')).toBeInTheDocument();
    expect(screen.getByText(/attempt list is still available/i)).toBeInTheDocument();
  });
});
