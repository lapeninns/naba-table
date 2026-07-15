import { act, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WizardContainer } from '@features/reservations/wizard/ui/WizardContainer';
import {
  WizardPanel,
  WizardPanelContent,
  WizardPanelHeader,
} from '@features/reservations/wizard/ui/WizardPanel';
import { WizardStep } from '@features/reservations/wizard/ui/WizardStep';

// WizardNavigation (rendered by WizardContainer) reads matchMedia; the global
// setup mock is emptied by mockReset between tests, so stub it plainly here.
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

afterEach(() => {
  vi.useRealTimers();
});

const steps = [
  { id: 1, label: 'Plan' },
  { id: 2, label: 'Details' },
];

function renderInContainer(currentStep: number, step: number) {
  return render(
    <WizardContainer
      steps={steps}
      currentStep={currentStep}
      actions={[]}
      summary={{ primary: 'Dinner' }}
    >
      <WizardStep step={step} title="Plan your table" description="Pick date and time.">
        <p>step body</p>
      </WizardStep>
    </WizardContainer>,
  );
}

describe('WizardStep', () => {
  it('renders the heading, description, and content @smoke', () => {
    render(
      <WizardStep step={1} title="Plan your table" description="Pick date and time.">
        <p>step body</p>
      </WizardStep>,
    );

    expect(screen.getByRole('heading', { level: 2, name: 'Plan your table' })).toBeInTheDocument();
    expect(screen.getByText('Pick date and time.')).toBeInTheDocument();
    expect(screen.getByText('step body')).toBeInTheDocument();
  });

  it('marks the section active when it matches the container step @contract', () => {
    renderInContainer(1, 1);
    const section = document.querySelector('section[data-step="1"]');
    expect(section).toHaveAttribute('data-state', 'active');
    expect(section?.firstElementChild).toHaveClass('ring-1');
  });

  it('marks the section inactive when another step is current @contract', () => {
    renderInContainer(2, 1);
    const section = document.querySelector('section[data-step="1"]');
    expect(section).toHaveAttribute('data-state', 'inactive');
  });

  it('announces step position when the flow has multiple steps @contract @a11y', () => {
    renderInContainer(1, 1);
    expect(screen.getByText('Step 1 of 2.')).toBeInTheDocument();
  });

  it('omits the position announcement outside a multi-step container @contract', () => {
    render(
      <WizardStep step={1} title="Solo step">
        <p>body</p>
      </WizardStep>,
    );
    expect(screen.queryByText(/Step 1 of/)).not.toBeInTheDocument();
  });

  it('renders one edge-elevated primary surface without undefined shadow aliases @contract', () => {
    render(
      <WizardStep step={1} title="Plan your table">
        <p>body</p>
      </WizardStep>,
    );

    const surface = document.querySelector('[data-slot="wizard-step-surface"]');
    expect(surface).toHaveClass('shadow-[var(--pg-shadow-edge)]');
    expect(surface?.className).not.toContain('--pg-shadow-floating');
    expect(surface?.className).not.toContain('--pg-shadow-soft');
  });

  it('provides a type-safe ops density hook inherited by nested panels @contract', () => {
    render(
      <WizardStep step={1} title="Plan your table" surface="ops">
        <WizardPanel aria-label="Availability section">
          <WizardPanelHeader title="Availability" />
          <WizardPanelContent>Open tables</WizardPanelContent>
        </WizardPanel>
      </WizardStep>,
    );

    const step = document.querySelector('section[data-step="1"]');
    const panel = screen.getByRole('group', { name: 'Availability section' });
    expect(step).toHaveAttribute('data-surface', 'ops');
    expect(panel).toHaveAttribute('data-surface', 'ops');
    expect(panel.querySelector('[data-slot="wizard-panel-header"]')).toHaveClass('p-3', 'sm:p-4');
    expect(panel.querySelector('[data-slot="wizard-panel-content"]')).toHaveClass('p-3', 'sm:p-4');
  });

  it('keeps the active step programmatically focusable with a visible focus treatment @a11y', () => {
    vi.useFakeTimers();
    renderInContainer(1, 1);

    const surface = document.querySelector<HTMLElement>('[data-slot="wizard-step-surface"]');
    expect(surface).toHaveAttribute('tabindex', '-1');
    expect(surface).toHaveClass('focus-visible:ring-2');

    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(surface).toHaveFocus();
  });
});
