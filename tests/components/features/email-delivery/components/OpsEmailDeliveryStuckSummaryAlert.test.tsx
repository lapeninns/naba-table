import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { OpsEmailDeliveryStuckSummaryAlert } from '@/components/features/email-delivery/components/OpsEmailDeliveryStuckSummaryAlert';

describe('OpsEmailDeliveryStuckSummaryAlert', () => {
  it('@smoke renders nothing when there are no stuck in-flight emails', () => {
    const { container } = render(<OpsEmailDeliveryStuckSummaryAlert stuckInFlight={null} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('@smoke pluralizes and surfaces the stale threshold when emails are stuck', () => {
    render(
      <OpsEmailDeliveryStuckSummaryAlert stuckInFlight={{ count: 3, thresholdHours: 12 }} />,
    );

    expect(
      screen.getByText('3 emails stuck without a delivery receipt'),
    ).toBeInTheDocument();
    expect(screen.getByText(/more than 12h ago/i)).toBeInTheDocument();
  });

  it('@smoke uses the singular form for a single stuck email', () => {
    render(
      <OpsEmailDeliveryStuckSummaryAlert stuckInFlight={{ count: 1, thresholdHours: 12 }} />,
    );

    expect(
      screen.getByText('1 email stuck without a delivery receipt'),
    ).toBeInTheDocument();
  });
});
