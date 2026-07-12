import { render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  WizardContainer,
  useWizardContext,
} from '@features/reservations/wizard/ui/WizardContainer';

// WizardNavigation reads matchMedia; the global setup mock is emptied by
// mockReset between tests, so install a plain (non-mock) stub per test.
beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
});

const steps = [
  { id: 1, label: 'Plan' },
  { id: 2, label: 'Details' },
  { id: 3, label: 'Review' },
  { id: 4, label: 'Done' },
];

function ContextProbe() {
  const context = useWizardContext();
  return (
    <p>{`probe:${context.currentStep}/${context.totalSteps}:${context.steps.length} steps`}</p>
  );
}

describe('WizardContainer', () => {
  it('provides step context to children @contract @smoke', () => {
    render(
      <WizardContainer steps={steps} currentStep={2} actions={[]} summary={{ primary: 'Dinner' }}>
        <ContextProbe />
      </WizardContainer>,
    );

    expect(screen.getByText('probe:2/4:4 steps')).toBeInTheDocument();
  });

  it('clamps the current step into the declared range @contract', () => {
    render(
      <WizardContainer steps={steps} currentStep={99} actions={[]} summary={{ primary: 'Dinner' }}>
        <ContextProbe />
      </WizardContainer>,
    );

    expect(screen.getByText('probe:4/4:4 steps')).toBeInTheDocument();
  });

  it('announces the step and summary for screen readers @contract @a11y', () => {
    const { container } = render(
      <WizardContainer
        steps={steps}
        currentStep={2}
        actions={[]}
        summary={{ primary: 'Dinner', details: ['4 guests', '19:00'] }}
      >
        <p>content</p>
      </WizardContainer>,
    );

    expect(screen.getByText('Step 2 of 4. Dinner. 4 guests, 19:00')).toBeInTheDocument();
    expect(container.querySelectorAll('[aria-live="polite"]')).toHaveLength(1);
  });

  it('renders the banner slot and restaurant name @smoke', () => {
    render(
      <WizardContainer
        steps={steps}
        currentStep={1}
        actions={[]}
        summary={{ primary: 'Dinner' }}
        restaurantName="The Old Crown"
        banner={<p>offline banner</p>}
      >
        <p>content</p>
      </WizardContainer>,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'The Old Crown' })).toBeInTheDocument();
    expect(screen.getByText('offline banner')).toBeInTheDocument();
  });

  it('falls back to a single-step context outside the provider @contract', () => {
    render(<ContextProbe />);
    expect(screen.getByText('probe:1/1:0 steps')).toBeInTheDocument();
  });
});
