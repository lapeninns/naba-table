import { render as renderDom, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { useForm } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';

import { Form, FormField } from '@/components/ui/form';
import { PartySizeField } from '@features/reservations/wizard/ui/steps/plan-step/components/PartySizeField';
import { MAX_ONLINE_PARTY_SIZE, MIN_ONLINE_PARTY_SIZE } from '@/lib/bookings/partySize';

// The field renders shadcn Form primitives, which require a FormProvider and
// FormField context — the same shell PlanStepForm provides in the product.
function Harness({ children }: { children: React.ReactNode }) {
  const form = useForm({ defaultValues: { party: 2 } });
  return (
    <Form {...form}>
      <FormField control={form.control} name="party" render={() => <>{children}</>} />
    </Form>
  );
}

function render(ui: React.ReactElement) {
  return renderDom(<Harness>{ui}</Harness>);
}

describe('PartySizeField', () => {
  it('shows the current value with pluralized copy @smoke', () => {
    const plural = render(<PartySizeField value={4} onChange={vi.fn()} />);
    expect(screen.getByLabelText('4 guests')).toBeInTheDocument();
    plural.unmount();

    render(<PartySizeField value={1} onChange={vi.fn()} />);
    expect(screen.getByLabelText('1 guest')).toBeInTheDocument();
  });

  it('increments and decrements through the stepper buttons @contract', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<PartySizeField value={4} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: 'Increase guests' }));
    expect(onChange).toHaveBeenCalledWith('increment');

    await user.click(screen.getByRole('button', { name: 'Decrease guests' }));
    expect(onChange).toHaveBeenCalledWith('decrement');
  });

  it('blocks decrementing below the online minimum @contract', () => {
    const onChange = vi.fn();
    render(<PartySizeField value={MIN_ONLINE_PARTY_SIZE} onChange={onChange} />);

    expect(screen.getByRole('button', { name: 'Decrease guests' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Increase guests' })).toBeEnabled();
  });

  it('blocks incrementing above the online maximum @contract', () => {
    const onChange = vi.fn();
    render(<PartySizeField value={MAX_ONLINE_PARTY_SIZE} onChange={onChange} />);

    expect(screen.getByRole('button', { name: 'Increase guests' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Decrease guests' })).toBeEnabled();
  });

  it('renders the large-party assistance copy and errors @contract', () => {
    render(<PartySizeField value={4} onChange={vi.fn()} error="Party too large" />);

    expect(screen.getByText("Tables for 12+? Give us a call and we'll help you out.")).toBeInTheDocument();
    expect(screen.getByText('Party too large')).toBeInTheDocument();
  });
});
