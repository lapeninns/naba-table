import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SetupProgressPanel } from '@/components/features/restaurant-settings/overview/SetupProgressPanel';

import type { RequiredSetupSummary } from '@/components/features/restaurant-settings/overview/buildSetupCards';

const requiredSetup = {
  complete: 2,
  total: 3,
  percent: 67,
  next: null,
  title: 'Next up: Availability',
  description: 'Set the weekly schedule before go-live.',
  footer: 'Availability needs attention',
} as unknown as RequiredSetupSummary;

describe('SetupProgressPanel', () => {
  it('@contract @a11y renders the onboarding progress with a labelled progress bar', () => {
    render(<SetupProgressPanel requiredSetup={requiredSetup} />);

    expect(screen.getByText('Onboarding progress')).toBeInTheDocument();
    expect(screen.getByText('Next up: Availability')).toBeInTheDocument();
    expect(screen.getByText('67%')).toBeInTheDocument();
    expect(screen.getByText('2 of 3 required steps complete')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAccessibleName('Required setup completion');
  });
});
