import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { OpsEmailDeliveryAnalyticsFailureSection } from '@/components/features/email-delivery/components/OpsEmailDeliveryAnalyticsFailureSection';

describe('OpsEmailDeliveryAnalyticsFailureSection', () => {
  it('@smoke renders the section title with one row per failure entry', () => {
    render(
      <OpsEmailDeliveryAnalyticsFailureSection
        section={{
          key: 'templates',
          title: 'Top failed templates',
          emptyLabel: 'No failed templates in this range.',
          entries: [
            { key: 'booking_confirmation', label: 'booking_confirmation', count: 4 },
            { key: 'review_request', label: 'review_request', count: 1 },
          ],
        }}
      />,
    );

    expect(screen.getByText('Top failed templates')).toBeInTheDocument();
    expect(screen.getByText('booking_confirmation')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('review_request')).toBeInTheDocument();
    expect(screen.queryByText('No failed templates in this range.')).not.toBeInTheDocument();
  });

  it('@smoke falls back to the empty label when there are no entries', () => {
    render(
      <OpsEmailDeliveryAnalyticsFailureSection
        section={{
          key: 'emailTypes',
          title: 'Top failed email types',
          emptyLabel: 'No failed email types in this range.',
          entries: [],
        }}
      />,
    );

    expect(screen.getByText('No failed email types in this range.')).toBeInTheDocument();
  });
});
