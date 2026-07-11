import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { OpsEmailDeliverySummaryDistribution } from '@/components/features/email-delivery/components/OpsEmailDeliverySummaryDistribution';

import type { OpsEmailDistributionSegment } from '@/components/features/email-delivery/opsEmailDeliverySummaryMetricsDomain';

const segments: OpsEmailDistributionSegment[] = [
  {
    status: 'delivered',
    label: 'Delivered',
    count: 6,
    className: 'bg-primary/10',
    widthPercent: 60,
    title: 'Delivered: 6 (60%)',
    screenReaderText: 'Delivered: 6 of 10',
  },
  {
    status: 'failed',
    label: 'Failed',
    count: 0,
    className: 'bg-destructive/10',
    widthPercent: 0,
    title: 'Failed: 0 (0%)',
    screenReaderText: 'Failed: 0 of 10',
  },
];

describe('OpsEmailDeliverySummaryDistribution', () => {
  it('@smoke @a11y renders the summary line, visible bar segments, and screen-reader text', () => {
    render(
      <OpsEmailDeliverySummaryDistribution
        distributionSegments={segments}
        distributionSummary="Delivered: 6 · Failed: 0"
      />,
    );

    const wrapper = screen.getByTestId('email-delivery-distribution');
    expect(screen.getByText('Delivered: 6 · Failed: 0')).toBeInTheDocument();
    expect(screen.getByText('Delivered: 6 of 10')).toBeInTheDocument();

    const visible = wrapper.querySelector('[title="Delivered: 6 (60%)"]') as HTMLElement;
    expect(visible).not.toBeNull();
    expect(visible.style.width).toBe('60%');
  });

  it('@smoke skips zero-width segments in the visible bar but keeps their screen-reader text', () => {
    render(
      <OpsEmailDeliverySummaryDistribution
        distributionSegments={segments}
        distributionSummary="Delivered: 6"
      />,
    );

    const wrapper = screen.getByTestId('email-delivery-distribution');
    expect(wrapper.querySelector('[title="Failed: 0 (0%)"]')).toBeNull();
    expect(screen.getByText('Failed: 0 of 10')).toBeInTheDocument();
  });
});
