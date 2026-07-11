import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  OpsEmailDeliverySummaryLoadingState,
  OpsEmailDeliverySummaryUnavailableState,
} from '@/components/features/email-delivery/components/OpsEmailDeliverySummaryStates';

describe('OpsEmailDeliverySummaryStates', () => {
  it('@smoke @a11y renders the loading state as a labeled metrics section with skeleton tiles', () => {
    render(<OpsEmailDeliverySummaryLoadingState />);

    expect(screen.getByLabelText('Email delivery metrics')).toBeInTheDocument();
    expect(screen.getByText('Deliverability')).toBeInTheDocument();
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('@smoke renders the unavailable state with reassurance that the attempt list still works', () => {
    render(<OpsEmailDeliverySummaryUnavailableState />);

    expect(screen.getByText('Metrics unavailable')).toBeInTheDocument();
    expect(screen.getByText(/attempt list is still available/i)).toBeInTheDocument();
  });
});
