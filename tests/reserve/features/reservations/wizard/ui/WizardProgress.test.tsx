import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { WizardProgress } from '@features/reservations/wizard/ui/WizardProgress';

import type { WizardStepMeta } from '@features/reservations/wizard/ui/WizardProgress';

const steps: WizardStepMeta[] = [
  { id: 1, label: 'Plan', helper: 'Date and time' },
  { id: 2, label: 'Details' },
  { id: 3, label: 'Review' },
  { id: 4, label: 'Done' },
];

const summary = { primary: 'Dinner', details: ['4 guests', '19:00'] };

describe('WizardProgress', () => {
  it('renders an accessible normal-flow progress region and live summary @contract @a11y', () => {
    render(<WizardProgress steps={steps} currentStep={2} summary={summary} />);

    expect(screen.getByRole('region', { name: 'Booking steps' })).toHaveAttribute(
      'data-wizard-progress',
    );
    expect(screen.getByText('Step 2 of 4. Dinner. 4 guests, 19:00')).toHaveTextContent(
      'Step 2 of 4. Dinner. 4 guests, 19:00',
    );
  });

  it('shows the current step label and completion percentage @contract @smoke', () => {
    render(<WizardProgress steps={steps} currentStep={2} summary={summary} />);

    expect(screen.getByText('Details')).toBeInTheDocument();
    expect(screen.getByText('2 of 4')).toBeInTheDocument();
    // Step 2 of 4 → (2-1)/(4-1) = 33%
    expect(screen.getByText('33%')).toBeInTheDocument();
    const bar = screen.getByLabelText('Booking progress');
    expect(bar).toHaveAttribute('aria-valuenow', '33');
    expect(bar).toHaveAttribute('aria-valuetext', 'Step 2 of 4');
  });

  it('clamps out-of-range steps into the valid window @contract', () => {
    render(<WizardProgress steps={steps} currentStep={9} summary={summary} />);
    expect(screen.getByText('4 of 4')).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();

    render(<WizardProgress steps={steps} currentStep={0} summary={summary} />);
    expect(screen.getByText('1 of 4')).toBeInTheDocument();
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('announces the step summary to screen readers @contract @a11y', () => {
    render(
      <WizardProgress
        steps={steps}
        currentStep={2}
        summary={{ ...summary, srLabel: 'Dinner. 4 guests, 19:00' }}
      />,
    );

    expect(screen.getByText('Step 2 of 4. Dinner. 4 guests, 19:00')).toBeInTheDocument();
  });

  it('renders the full step list with the current step marked @contract @a11y', () => {
    render(<WizardProgress steps={steps} currentStep={3} summary={summary} showStepList />);

    const list = screen.getByRole('list', { name: 'Steps' });
    expect(list).toBeInTheDocument();
    expect(list).toHaveClass('grid-cols-4');
    const current = screen.getByLabelText('Review (3 of 4)');
    expect(current).toHaveAttribute('aria-current', 'step');
    expect(screen.getByLabelText('Plan (1 of 4)')).not.toHaveAttribute('aria-current');
    expect(screen.getByText('Date and time')).toHaveClass('hidden');
  });

  it('navigates through completed steps while current and future steps stay inert @contract', async () => {
    const user = userEvent.setup();
    const onStepSelect = vi.fn();
    render(
      <WizardProgress
        steps={steps}
        currentStep={3}
        summary={summary}
        showStepList
        onStepSelect={onStepSelect}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Plan (1 of 4)' }));
    expect(onStepSelect).toHaveBeenCalledWith(1);
    expect(screen.queryByRole('button', { name: 'Review (3 of 4)' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Done (4 of 4)' })).not.toBeInTheDocument();
  });

  it('treats an empty step list as a single-step flow @contract', () => {
    render(<WizardProgress steps={[]} currentStep={1} summary={summary} />);
    expect(screen.getByText('1 of 1')).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.getByText('Step 1')).toBeInTheDocument();
  });
});
