import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { OpsEmailDeliveryAnalytics } from '@/components/features/email-delivery/components/OpsEmailDeliveryAnalytics';

describe('OpsEmailDeliveryAnalytics', () => {
  it('renders analytics KPI tiles, distribution, secondary metrics, and top failures', async () => {
    const user = userEvent.setup();
    const onRangeChange = vi.fn();

    render(
      <OpsEmailDeliveryAnalytics
        summary={{
          total: 20,
          sent: 2,
          delivered: 12,
          deliveryDelayed: 3,
          bounced: 1,
          complained: 1,
          failed: 1,
          deliveredRate: 0.6,
          failureRate: 0.15,
          uniqueRecipients: 14,
          uniqueBookings: 11,
          p50DeliverySeconds: 35,
          p95DeliverySeconds: 180,
          topFailedTemplates: [{ templateType: 'booking_confirmation', count: 2 }],
          topFailedEmailTypes: [{ emailType: 'confirmation', count: 2 }],
        }}
        isLoading={false}
        isUpdating={false}
        range="7d"
        onRangeChange={onRangeChange}
      />,
    );

    expect(screen.getByText('Delivery analytics')).toBeInTheDocument();
    expect(screen.getByText('Total Attempts')).toBeInTheDocument();
    expect(screen.getByText('Delivered')).toBeInTheDocument();
    expect(screen.getByText('Delayed')).toBeInTheDocument();
    expect(screen.getByText('Failures')).toBeInTheDocument();
    expect(screen.getByTestId('analytics-p50')).toHaveTextContent('35s');
    expect(screen.getByTestId('analytics-p95')).toHaveTextContent('3m 0s');
    expect(screen.getByTestId('analytics-unique-recipients')).toHaveTextContent('14');
    expect(screen.getByTestId('analytics-unique-bookings')).toHaveTextContent('11');
    expect(screen.getByTestId('analytics-distribution-bar')).toBeInTheDocument();
    expect(screen.getByText('Top failed templates')).toBeInTheDocument();
    expect(screen.getByText('Top failed email types')).toBeInTheDocument();
    expect(screen.getByText('booking_confirmation')).toBeInTheDocument();
    expect(screen.getByText('confirmation')).toBeInTheDocument();

    await user.click(screen.getByText('30d'));
    expect(onRangeChange).toHaveBeenCalledWith('30d');
  });

  it('renders loading and unavailable states', () => {
    const { rerender } = render(
      <OpsEmailDeliveryAnalytics
        summary={null}
        isLoading
        isUpdating={false}
        range="24h"
        onRangeChange={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('Email delivery analytics')).toBeInTheDocument();
    expect(document.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);

    rerender(
      <OpsEmailDeliveryAnalytics
        summary={null}
        isLoading={false}
        isUpdating={false}
        range="24h"
        onRangeChange={vi.fn()}
      />,
    );

    expect(screen.getByText('Analytics unavailable')).toBeInTheDocument();
  });
});
