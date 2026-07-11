import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MetricsSection } from '@/components/landing/sections/MetricsSection';

describe('MetricsSection', () => {
  it('@smoke renders the heading and both metric cards', () => {
    render(<MetricsSection reduceMotion={false} />);

    expect(
      screen.getByRole('heading', { name: 'The point is fewer exposed moments.' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Booking Window')).toBeInTheDocument();
    expect(screen.getByText('24/7')).toBeInTheDocument();
    expect(screen.getByText('Setup Spots')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('@smoke renders identically with reduced motion requested', () => {
    render(<MetricsSection reduceMotion />);

    expect(screen.getByText('Operational proof, not dashboard theatre')).toBeInTheDocument();
  });
});
