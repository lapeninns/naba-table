import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { OpsEmailDeliveryAnalyticsSecondaryMetrics } from '@/components/features/email-delivery/components/OpsEmailDeliveryAnalyticsSecondaryMetrics';

describe('OpsEmailDeliveryAnalyticsSecondaryMetrics', () => {
  it('@smoke renders each secondary metric with its label, value, and test id', () => {
    render(
      <OpsEmailDeliveryAnalyticsSecondaryMetrics
        metrics={[
          { key: 'p50', label: 'p50 delivery time', value: '12s', testId: 'analytics-p50' },
          {
            key: 'uniqueRecipients',
            label: 'Unique recipients',
            value: '7',
            testId: 'analytics-unique-recipients',
          },
        ]}
      />,
    );

    expect(screen.getByText('Secondary metrics')).toBeInTheDocument();
    expect(screen.getByText('p50 delivery time')).toBeInTheDocument();
    expect(screen.getByTestId('analytics-p50')).toHaveTextContent('12s');
    expect(screen.getByTestId('analytics-unique-recipients')).toHaveTextContent('7');
  });
});
