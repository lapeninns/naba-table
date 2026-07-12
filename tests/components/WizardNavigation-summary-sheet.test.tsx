import { fireEvent, render, screen } from '@testing-library/react';
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

  it('renders the collapsed peek with the primary action and a collapsed disclosure', () => {
    render(<WizardNavigation {...baseProps} />);
    expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
    expect(disclosure()).toHaveAttribute('aria-expanded', 'false');
  });

  it('toggles the sheet open and closed on activation', () => {
    render(<WizardNavigation {...baseProps} />);
    fireEvent.click(disclosure());
    expect(disclosure()).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(disclosure());
    expect(disclosure()).toHaveAttribute('aria-expanded', 'false');
  });

  it('collapses when Escape is pressed', () => {
    render(<WizardNavigation {...baseProps} />);
    fireEvent.click(disclosure());
    expect(disclosure()).toHaveAttribute('aria-expanded', 'true');
    fireEvent.keyDown(disclosure(), { key: 'Escape' });
    expect(disclosure()).toHaveAttribute('aria-expanded', 'false');
  });

  it('collapses when the current step changes', () => {
    const { rerender } = render(<WizardNavigation {...baseProps} />);
    fireEvent.click(disclosure());
    expect(disclosure()).toHaveAttribute('aria-expanded', 'true');
    rerender(<WizardNavigation {...baseProps} currentStep={3} />);
    expect(disclosure()).toHaveAttribute('aria-expanded', 'false');
  });

  it('exposes the booking facts in a labeled region when expanded', () => {
    render(<WizardNavigation {...baseProps} />);
    fireEvent.click(disclosure());
    expect(screen.getByRole('region', { name: /booking summary/i })).toBeInTheDocument();
    expect(screen.getByText('Dinner')).toBeInTheDocument();
  });

  it('marks the collapsed summary panel inert so its controls leave the tab order', () => {
    render(<WizardNavigation {...baseProps} />);
    const panel = document.getElementById('wizard-summary-sheet');
    expect(panel).toHaveAttribute('inert');
    fireEvent.click(disclosure());
    expect(panel).not.toHaveAttribute('inert');
  });

  it('omits the disclosure and region when there are no facts', () => {
    render(<WizardNavigation {...baseProps} summary={{ primary: 'Dinner' }} />);
    expect(screen.queryByRole('button', { name: /booking summary/i })).toBeNull();
    expect(screen.queryByRole('region', { name: /booking summary/i })).toBeNull();
  });
});
