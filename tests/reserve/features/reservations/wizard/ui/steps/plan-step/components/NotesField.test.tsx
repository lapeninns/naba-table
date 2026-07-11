import { render as renderDom, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { useForm } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';

import { Form, FormField } from '@/components/ui/form';
import { NotesField } from '@features/reservations/wizard/ui/steps/plan-step/components/NotesField';

// The field renders shadcn Form primitives, which require a FormProvider and
// FormField context — the same shell PlanStepForm provides in the product.
function Harness({ children }: { children: React.ReactNode }) {
  const form = useForm({ defaultValues: { notes: '' } });
  return (
    <Form {...form}>
      <FormField control={form.control} name="notes" render={() => <>{children}</>} />
    </Form>
  );
}

function render(ui: React.ReactElement) {
  return renderDom(<Harness>{ui}</Harness>);
}

describe('NotesField', () => {
  it('renders the label, helper copy, and character counter @smoke', () => {
    render(<NotesField value="Birthday dinner" onChange={vi.fn()} />);

    expect(screen.getByLabelText('Notes')).toHaveValue('Birthday dinner');
    expect(screen.getByText('Optional. Share anything we should know before you arrive.')).toBeInTheDocument();
    expect(screen.getByText('15 / 500')).toBeInTheDocument();
  });

  it('emits changes while typing @contract', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<NotesField value="" onChange={onChange} />);

    await user.type(screen.getByLabelText('Notes'), 'Hi');

    expect(onChange).toHaveBeenCalledWith('H');
    // Controlled value stays '' in this harness, so each keystroke emits its own char.
    expect(onChange).toHaveBeenCalledWith('i');
  });

  it('commits the final value on blur @contract', async () => {
    const user = userEvent.setup();
    const onBlur = vi.fn();
    render(<NotesField value="Window seat" onChange={vi.fn()} onBlur={onBlur} />);

    await user.click(screen.getByLabelText('Notes'));
    await user.tab();

    expect(onBlur).toHaveBeenCalledWith('Window seat');
  });

  it('flags the counter near the 500-character limit @contract', () => {
    const nearLimit = 'x'.repeat(471);
    render(<NotesField value={nearLimit} onChange={vi.fn()} />);

    expect(screen.getByText('471 / 500')).toHaveClass('text-destructive');
  });

  it('shows a validation error when provided @contract', () => {
    render(<NotesField value="" onChange={vi.fn()} error="Too long" />);
    expect(screen.getByText('Too long')).toBeInTheDocument();
  });
});
