import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  WizardNavigation,
  type WizardNavigationProps,
} from '@reserve/features/reservations/wizard/ui/WizardNavigation';

const steps = [
  { id: 1, label: 'Plan' },
  { id: 2, label: 'Details' },
  { id: 3, label: 'Review' },
  { id: 4, label: 'Done' },
];

const facts = [
  { label: 'Date', value: 'Apr 14 2026' },
  { label: 'Time', value: '19:00' },
  { label: 'Party', value: '4 guests' },
  { label: 'Service', value: 'Dinner' },
];

const baseProps: WizardNavigationProps = {
  steps,
  currentStep: 2,
  summary: {
    primary: 'Dinner',
    details: ['4 guests', '19:00', 'Apr 14 2026'],
    facts,
  },
  actions: [
    { id: 'back', label: 'Back', role: 'secondary', onClick: () => {} },
    { id: 'continue', label: 'Continue', role: 'primary', onClick: () => {} },
  ],
};

describe('WizardNavigation summary sheet', () => {
  beforeEach(() => {
    // jsdom lacks matchMedia; provide a stub so usePrefersReducedMotion works.
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const disclosure = () => screen.getByRole('button', { name: /booking summary/i });

  it('@contract renders the collapsed peek with the primary action and a collapsed disclosure', () => {
    render(<WizardNavigation {...baseProps} />);
    expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
    expect(disclosure()).toHaveAttribute('aria-expanded', 'false');
  });

  it('@contract keeps progress out of the sticky summary and action rail', () => {
    render(<WizardNavigation {...baseProps} />);

    const navigation = screen.getByRole('navigation', { name: 'Booking wizard navigation' });
    expect(navigation.querySelector('circle')).toBeNull();
    expect(navigation).not.toHaveTextContent('2/4');
  });

  it('@contract wraps the mobile primary action at full width with 44px targets', () => {
    render(
      <WizardNavigation
        {...baseProps}
        actions={[
          ...baseProps.actions,
          { id: 'help', label: 'Get help', role: 'support', onClick: () => {} },
        ]}
      />,
    );

    expect(screen.getByRole('button', { name: 'Back' })).toHaveClass('min-h-11');
    expect(screen.getByRole('button', { name: 'Continue' })).toHaveClass(
      'min-h-11',
      'w-full',
      'sm:w-auto',
    );
    expect(disclosure()).toHaveClass('min-h-11');

    fireEvent.click(disclosure());
    expect(screen.getByRole('button', { name: 'Get help' })).toHaveClass('min-h-11');
  });

  it('@contract keeps the dark primary action on a locally contrasting semantic pair', () => {
    render(<WizardNavigation {...baseProps} />);

    expect(screen.getByRole('button', { name: 'Continue' })).toHaveClass(
      'dark:[--pg-action:var(--pg-cobalt-hover)]',
      'dark:[--pg-action-hover:var(--pg-cobalt)]',
      'dark:[--pg-action-contrast:var(--pg-bg)]',
    );
    expect(screen.getByRole('button', { name: 'Back' })).not.toHaveClass(
      'dark:[--pg-action:var(--pg-cobalt-hover)]',
    );
  });

  it('@contract toggles the sheet open and closed on activation', () => {
    render(<WizardNavigation {...baseProps} />);
    fireEvent.click(disclosure());
    expect(disclosure()).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(disclosure());
    expect(disclosure()).toHaveAttribute('aria-expanded', 'false');
  });

  it('@contract collapses when Escape is pressed', () => {
    render(<WizardNavigation {...baseProps} />);
    fireEvent.click(disclosure());
    expect(disclosure()).toHaveAttribute('aria-expanded', 'true');
    fireEvent.keyDown(disclosure(), { key: 'Escape' });
    expect(disclosure()).toHaveAttribute('aria-expanded', 'false');
  });

  it('@contract collapses on Escape when activation does not move focus into the navigation', () => {
    render(<WizardNavigation {...baseProps} />);
    fireEvent.click(disclosure());
    expect(disclosure()).toHaveAttribute('aria-expanded', 'true');
    expect(document.activeElement).not.toBe(disclosure());

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(disclosure()).toHaveAttribute('aria-expanded', 'false');
  });

  it('@contract collapses when the current step changes', () => {
    const { rerender } = render(<WizardNavigation {...baseProps} />);
    fireEvent.click(disclosure());
    expect(disclosure()).toHaveAttribute('aria-expanded', 'true');
    rerender(<WizardNavigation {...baseProps} currentStep={3} />);
    expect(disclosure()).toHaveAttribute('aria-expanded', 'false');
  });

  it('@contract exposes the booking facts in a labeled region when expanded', () => {
    render(<WizardNavigation {...baseProps} />);
    fireEvent.click(disclosure());
    const summaryRegion = screen.getByRole('region', { name: /booking summary/i });
    expect(summaryRegion).toHaveClass(
      'max-h-[min(60dvh,24rem)]',
      'overflow-y-auto',
      'overscroll-contain',
    );
    expect(within(summaryRegion).getByText('Dinner')).toBeInTheDocument();
  });

  it('@contract marks the collapsed summary panel inert so its controls leave the tab order', () => {
    render(<WizardNavigation {...baseProps} />);
    const panel = document.getElementById('wizard-summary-sheet');
    expect(panel).toHaveAttribute('inert');
    fireEvent.click(disclosure());
    expect(panel).not.toHaveAttribute('inert');
  });

  it('@contract omits the disclosure and region when there are no facts', () => {
    render(<WizardNavigation {...baseProps} summary={{ primary: 'Dinner' }} />);
    expect(screen.queryByRole('button', { name: /booking summary/i })).toBeNull();
    expect(screen.queryByRole('region', { name: /booking summary/i })).toBeNull();
  });

  it('@contract does not expose previous-step wayfinding in the summary sheet', () => {
    render(<WizardNavigation {...baseProps} currentStep={3} />);

    fireEvent.click(disclosure());
    expect(screen.queryByRole('navigation', { name: 'Go to a previous step' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Plan (1 of 4)' })).toBeNull();
  });
});
