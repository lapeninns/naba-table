import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';

import { WizardProgress } from '../WizardProgress';

describe('WizardProgress', () => {
  it('announces the current step for screen readers', () => {
    render(
      <WizardProgress
        steps={[
          { id: 1, label: 'Plan' },
          { id: 2, label: 'Details' },
          { id: 3, label: 'Review' },
        ]}
        currentStep={2}
        summary={{
          primary: 'Dinner booking',
          details: ['2 guests', '19:00', '12 May 2025'],
          srLabel: 'Dinner booking. 2 guests, 19:00, 12 May 2025',
        }}
      />,
    );

    const liveRegion = screen.getByText(
      'Step 2 of 3. Dinner booking. 2 guests, 19:00, 12 May 2025',
    );
    expect(liveRegion).toHaveAttribute('aria-live', 'polite');

    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).toHaveAttribute('aria-valuenow', '50');
  });
});
