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
    <p>{`probe:${context.currentStep}/${context.totalSteps}:${context.steps.length} steps:${context.mode}:${context.layoutSurface}`}</p>
  );
}

describe('WizardContainer', () => {
  it('provides step context to children @contract @smoke', () => {
    render(
      <WizardContainer steps={steps} currentStep={2} actions={[]} summary={{ primary: 'Dinner' }}>
        <ContextProbe />
      </WizardContainer>,
    );

    expect(screen.getByText('probe:2/4:4 steps:customer:guest')).toBeInTheDocument();
  });

  it('clamps the current step into the declared range @contract', () => {
    render(
      <WizardContainer steps={steps} currentStep={99} actions={[]} summary={{ primary: 'Dinner' }}>
        <ContextProbe />
      </WizardContainer>,
    );

    expect(screen.getByText('probe:4/4:4 steps:customer:guest')).toBeInTheDocument();
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

    const liveRegion = container.querySelector('[aria-live="polite"]');
    expect(liveRegion).toHaveTextContent('Step 2 of 4. Dinner. 4 guests, 19:00');
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

  it('renders exactly one normal-flow progress presentation before step content @contract @a11y', () => {
    // Given / When
    const { container } = render(
      <WizardContainer
        steps={steps}
        currentStep={2}
        actions={[]}
        summary={{ primary: 'Dinner' }}
        stickyVisible
      >
        <p>step content</p>
      </WizardContainer>,
    );

    // Then
    const progress = container.querySelector('[data-wizard-progress]');
    const progressSlot = container.querySelector('[data-booking-wizard-progress-slot]');
    const navigation = container.querySelector('[data-booking-wizard-navigation]');
    const stepContent = screen.getByText('step content');

    expect(container.querySelectorAll('[data-wizard-progress]')).toHaveLength(1);
    expect(progressSlot).toContainElement(progress);
    expect(navigation?.querySelector('[data-wizard-progress]')).toBeNull();
    expect(progress?.compareDocumentPosition(stepContent) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it('provides the explicit ops surface and mode to shared descendants @contract', () => {
    // Given / When
    render(
      <WizardContainer
        steps={steps}
        currentStep={1}
        actions={[]}
        summary={{ primary: 'Dinner' }}
        layoutSurface="ops"
        mode="ops"
      >
        <ContextProbe />
      </WizardContainer>,
    );

    // Then
    expect(screen.getByText('probe:1/4:4 steps:ops:ops')).toBeInTheDocument();
  });

  it('keeps one polite announcement source while the sticky rail is visible @contract @a11y', () => {
    // Given / When
    const { container } = render(
      <WizardContainer
        steps={steps}
        currentStep={2}
        actions={[]}
        summary={{ primary: 'Dinner' }}
        stickyVisible
      >
        <p>content</p>
      </WizardContainer>,
    );

    // Then
    expect(container.querySelectorAll('[aria-live="polite"]')).toHaveLength(1);
  });

  it('integrates measured navigation height into layout padding @contract', () => {
    // Given / When
    render(
      <WizardContainer
        steps={steps}
        currentStep={1}
        actions={[]}
        summary={{ primary: 'Dinner' }}
        stickyHeight={72}
        stickyVisible
      >
        <p>content</p>
      </WizardContainer>,
    );

    // Then
    const main = screen.getByRole('main');
    expect(main.style.paddingBottom).toContain('72px');
    expect(main.style.scrollPaddingBottom).toContain('72px');
  });

  it('falls back to a single-step context outside the provider @contract', () => {
    render(<ContextProbe />);
    expect(screen.getByText('probe:1/1:0 steps:customer:guest')).toBeInTheDocument();
  });
});
