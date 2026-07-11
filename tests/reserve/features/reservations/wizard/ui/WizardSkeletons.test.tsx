import { render } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';

import {
  BookingWizardShellSkeleton,
  ConfirmationStepSkeleton,
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

  it.each([
    ['PlanStepSkeleton', PlanStepSkeleton],
    ['DetailsStepSkeleton', DetailsStepSkeleton],
    ['ReviewStepSkeleton', ReviewStepSkeleton],
    ['ConfirmationStepSkeleton', ConfirmationStepSkeleton],
  ])('renders %s without crashing @smoke', (_name, Skeleton) => {
    const { container } = render(<Skeleton />);
    // Every step skeleton is a card shell with pulsing placeholders.
    expect(container.firstChild).not.toBeNull();
    expect(container.querySelectorAll('[data-slot="skeleton"], .animate-pulse').length).toBeGreaterThan(0);
  });
});
