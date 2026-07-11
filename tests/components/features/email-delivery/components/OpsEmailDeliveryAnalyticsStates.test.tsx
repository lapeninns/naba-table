import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  OpsEmailDeliveryAnalyticsErrorState,
  OpsEmailDeliveryAnalyticsLoadingState,
  OpsEmailDeliveryAnalyticsUnavailableState,
} from '@/components/features/email-delivery/components/OpsEmailDeliveryAnalyticsStates';

describe('OpsEmailDeliveryAnalyticsStates', () => {
  it('@smoke renders the loading state without throwing', () => {
    const { container } = render(<OpsEmailDeliveryAnalyticsLoadingState />);

    expect(container.firstElementChild).not.toBeNull();
  });

  it('@smoke renders the unavailable state copy', () => {
    render(<OpsEmailDeliveryAnalyticsUnavailableState />);

    expect(screen.getByText('Analytics unavailable')).toBeInTheDocument();
    expect(
      screen.getByText('Summary metrics could not be calculated for this range right now.'),
    ).toBeInTheDocument();
  });

  it('@smoke renders the error state with the provided message', () => {
    render(<OpsEmailDeliveryAnalyticsErrorState message="Range query timed out" />);

    expect(screen.getByText('Unable to load analytics')).toBeInTheDocument();
    expect(screen.getByText('Range query timed out')).toBeInTheDocument();
  });
});
