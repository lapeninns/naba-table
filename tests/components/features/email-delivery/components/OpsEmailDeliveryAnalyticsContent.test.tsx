import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { OpsEmailDeliveryAnalyticsContent } from '@/components/features/email-delivery/components/OpsEmailDeliveryAnalyticsContent';
import { buildOpsEmailDeliveryAnalyticsModel } from '@/components/features/email-delivery/opsEmailDeliveryAnalyticsDomain';

import type { OpsEmailDeliverySummary } from '@/types/emailDelivery';

const summary: OpsEmailDeliverySummary = {
  total: 10,
  sent: 1,
  delivered: 7,
  deliveryDelayed: 1,
  bounced: 1,
  complained: 0,
  failed: 0,
  deliveredRate: 0.7,
  failureRate: 0.1,
  uniqueRecipients: 9,
  uniqueBookings: 8,
  p50DeliverySeconds: 30,
  p95DeliverySeconds: 90,
  topFailedTemplates: [{ templateType: 'booking_confirmation', count: 1 }],
  topFailedEmailTypes: [],
};

describe('OpsEmailDeliveryAnalyticsContent', () => {
  it('@smoke composes tiles, distribution, secondary metrics, and both failure sections from the model', () => {
    render(<OpsEmailDeliveryAnalyticsContent model={buildOpsEmailDeliveryAnalyticsModel(summary)} />);

    // Primary tiles
    expect(screen.getByText('Total Attempts')).toBeInTheDocument();
    expect(screen.getByText('10 total attempts')).toBeInTheDocument();
    // Secondary metrics
    expect(screen.getByTestId('analytics-p50')).toHaveTextContent('30s');
    expect(screen.getByTestId('analytics-unique-bookings')).toHaveTextContent('8');
    // Failure sections (one with entries, one empty)
    expect(screen.getByText('Top failed templates')).toBeInTheDocument();
    expect(screen.getByText('booking_confirmation')).toBeInTheDocument();
    expect(screen.getByText('No failed email types in this range.')).toBeInTheDocument();
  });
});
