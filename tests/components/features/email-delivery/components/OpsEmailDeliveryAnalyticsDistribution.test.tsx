import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { OpsEmailDeliveryAnalyticsDistribution } from '@/components/features/email-delivery/components/OpsEmailDeliveryAnalyticsDistribution';

import type { OpsEmailAnalyticsDistributionSegment } from '@/components/features/email-delivery/opsEmailDeliveryAnalyticsDomain';

const segments: OpsEmailAnalyticsDistributionSegment[] = [
  {
    key: 'delivered',
    label: 'Delivered',
    count: 8,
    toneClass: 'bg-primary',
    widthPercent: 80,
    title: 'Delivered: 8',
  },
  {
    key: 'failed',
    label: 'Failed',
    count: 2,
    toneClass: 'bg-destructive',
    widthPercent: 20,
    title: 'Failed: 2',
  },
];

describe('OpsEmailDeliveryAnalyticsDistribution', () => {
  it('@smoke renders the total attempts badge and one legend chip per segment', () => {
    render(<OpsEmailDeliveryAnalyticsDistribution segments={segments} total={10} />);

    expect(screen.getByText('10 total attempts')).toBeInTheDocument();
    expect(screen.getByText('Status distribution')).toBeInTheDocument();
    expect(screen.getByText('Delivered: 8')).toBeInTheDocument();
    expect(screen.getByText('Failed: 2')).toBeInTheDocument();
  });

  it('@smoke sizes each distribution bar segment by its width percent', () => {
    render(<OpsEmailDeliveryAnalyticsDistribution segments={segments} total={10} />);

    const bar = screen.getByTestId('analytics-distribution-bar');
    const delivered = bar.querySelector('[title="Delivered: 8"]') as HTMLElement;
    expect(delivered).not.toBeNull();
    expect(delivered.style.width).toBe('80%');
  });
});
