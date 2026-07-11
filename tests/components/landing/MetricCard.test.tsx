import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MetricCard } from '@/components/landing/shared/MetricCard';

describe('MetricCard', () => {
  it('@smoke renders the label, value, and detail line', () => {
    render(
      <MetricCard
        metric={{
          label: 'Booking Window',
          value: 24,
          suffix: '/7',
          detail: 'Capture demand after the phone quiets down',
          icon: 'chart',
        }}
      />,
    );

    expect(screen.getByText('24/7')).toBeInTheDocument();
    expect(screen.getByText('Booking Window')).toBeInTheDocument();
    expect(screen.getByText('Capture demand after the phone quiets down')).toBeInTheDocument();
  });

  it('@contract formats thousands with en-GB grouping and applies the prefix', () => {
    render(
      <MetricCard
        metric={{
          label: 'Covers protected',
          value: 12500,
          prefix: '+',
          detail: 'Per year',
          icon: 'zap',
        }}
      />,
    );

    expect(screen.getByText('+12,500')).toBeInTheDocument();
  });
});
