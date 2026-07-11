import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { OpsEmailDeliverySummaryDetails } from '@/components/features/email-delivery/components/OpsEmailDeliverySummaryDetails';

import type {
  OpsEmailFailureList,
  OpsEmailSecondaryMetric,
} from '@/components/features/email-delivery/opsEmailDeliverySummaryMetricsDomain';

const secondaryMetrics: OpsEmailSecondaryMetric[] = [
  { key: 'sent', label: 'Sent-only', value: '2', testId: 'email-metric-sent' },
  { key: 'bounced', label: 'Bounced', value: '1', testId: 'email-metric-bounced' },
];

const failureLists: OpsEmailFailureList[] = [
  {
    key: 'templates',
    title: 'Top failed templates',
    emptyLabel: 'No failures in this range.',
    entries: [{ key: 'review_request', label: 'review_request', count: 1 }],
  },
  {
    key: 'emailTypes',
    title: 'Top failed email types',
    emptyLabel: 'No failures in this range.',
    entries: [],
  },
];

describe('OpsEmailDeliverySummaryDetails', () => {
  it('@contract @a11y keeps the detail metrics collapsed until the labeled toggle is expanded', async () => {
    const user = userEvent.setup();
    render(
      <OpsEmailDeliverySummaryDetails
        failureLists={failureLists}
        secondaryMetrics={secondaryMetrics}
      />,
    );

    const toggle = screen.getByRole('button', { name: 'Toggle more metrics' });
    expect(screen.queryByTestId('email-metric-sent')).not.toBeInTheDocument();

    await user.click(toggle);

    expect(screen.getByTestId('email-metric-sent')).toHaveTextContent('2');
    expect(screen.getByTestId('email-metric-bounced')).toHaveTextContent('1');
    expect(screen.getByText('Top failed templates')).toBeInTheDocument();
    expect(screen.getByText('review_request')).toBeInTheDocument();
    // The empty list falls back to its empty label.
    expect(screen.getByText('No failures in this range.')).toBeInTheDocument();
  });

  it('@contract collapses the details again on a second toggle', async () => {
    const user = userEvent.setup();
    render(
      <OpsEmailDeliverySummaryDetails
        failureLists={failureLists}
        secondaryMetrics={secondaryMetrics}
      />,
    );

    const toggle = screen.getByRole('button', { name: 'Toggle more metrics' });
    await user.click(toggle);
    expect(screen.getByTestId('email-metric-sent')).toBeInTheDocument();

    await user.click(toggle);
    expect(screen.queryByTestId('email-metric-sent')).not.toBeInTheDocument();
  });
});
