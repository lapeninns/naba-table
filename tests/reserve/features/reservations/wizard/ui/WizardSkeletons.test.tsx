import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';

import {
  BookingWizardShellSkeleton,
  DetailsStepSkeleton,
  PlanStepSkeleton,
  ReviewStepSkeleton,
} from '@features/reservations/wizard/ui/WizardSkeletons';

describe('wizard skeletons', () => {
  it('renders the shell skeleton as main or div per layout element @smoke', () => {
    const asMain = render(<BookingWizardShellSkeleton layoutElement="main" />);
    expect(asMain.container.querySelector('main')).not.toBeNull();

    const asDiv = render(<BookingWizardShellSkeleton layoutElement="div" />);
    expect(asDiv.container.querySelector('main')).toBeNull();
  });

  it('announces loading once while hiding decorative skeleton geometry', () => {
    render(<BookingWizardShellSkeleton />);

    const status = screen.getByRole('status', { name: 'Loading booking form' });
    expect(status).toHaveAttribute('aria-busy', 'true');
    expect(status.querySelector('[data-wizard-skeleton-visual]')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
  });

  it('mirrors compact venue, progress, step, and responsive action rail regions', () => {
    const { container } = render(<BookingWizardShellSkeleton />);

    expect(container.querySelector('[data-wizard-skeleton-region="venue"]')).not.toBeNull();
    expect(container.querySelector('[data-wizard-skeleton-region="progress"]')).not.toBeNull();
    expect(container.querySelector('[data-wizard-skeleton-region="step"]')).not.toBeNull();

    const rail = container.querySelector('[data-wizard-skeleton-region="rail"]');
    expect(rail).not.toBeNull();
    expect(rail).toHaveClass('grid-cols-1');
    expect(rail).toHaveClass('sm:grid-cols-[minmax(0,1fr)_auto]');
  });

  it.each([
    ['PlanStepSkeleton', PlanStepSkeleton],
    ['DetailsStepSkeleton', DetailsStepSkeleton],
    ['ReviewStepSkeleton', ReviewStepSkeleton],
  ])('renders %s without crashing @smoke', (_name, Skeleton) => {
    const { container } = render(<Skeleton />);
    expect(container.firstChild).not.toBeNull();
    expect(container.querySelector('[data-wizard-skeleton-region="step"]')).not.toBeNull();
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
  });

  it.each([
    ['PlanStepSkeleton', PlanStepSkeleton],
    ['DetailsStepSkeleton', DetailsStepSkeleton],
    ['ReviewStepSkeleton', ReviewStepSkeleton],
  ])('%s uses defined elevation and reduced-motion-safe placeholders', (_name, Skeleton) => {
    const { container } = render(<Skeleton />);

    expect(container.innerHTML).not.toContain('--pg-shadow-floating');
    expect(container.innerHTML).not.toContain('--pg-shadow-soft');
    for (const placeholder of container.querySelectorAll('[data-slot="skeleton"]')) {
      expect(placeholder).toHaveClass('motion-reduce:animate-none');
    }
  });
});
