import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ReadinessRing } from '@/components/features/restaurant-settings/profile/ReadinessRing';

describe('ReadinessRing', () => {
  it('@contract @a11y exposes the readiness as an accessible image with caption', () => {
    render(<ReadinessRing value={60} total={10} completed={6} />);

    expect(
      screen.getByRole('img', { name: 'Profile readiness 60%, 6 of 10 fields complete' }),
    ).toBeInTheDocument();
    expect(screen.getByText('60')).toBeInTheDocument();
    expect(screen.getByText('6/10')).toBeInTheDocument();
  });

  it('@contract clamps out-of-range values into the 0-100 window', () => {
    render(<ReadinessRing value={250} total={4} completed={4} />);

    expect(
      screen.getByRole('img', { name: 'Profile readiness 100%, 4 of 4 fields complete' }),
    ).toBeInTheDocument();
  });

  it('@contract treats non-finite values as zero', () => {
    render(<ReadinessRing value={Number.NaN} total={4} completed={0} />);

    expect(
      screen.getByRole('img', { name: 'Profile readiness 0%, 0 of 4 fields complete' }),
    ).toBeInTheDocument();
  });
});
