import { render as renderDom, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { useForm } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';

import { Form, FormField } from '@/components/ui/form';
import { OccasionPicker } from '@features/reservations/wizard/ui/steps/plan-step/components/OccasionPicker';

import type { ServiceAvailability } from '@features/reservations/wizard/services';
import type { OccasionKey } from '@reserve/shared/occasions';

// The field renders shadcn Form primitives, which require a FormProvider and
// FormField context — the same shell PlanStepForm provides in the product.
function Harness({ children }: { children: React.ReactNode }) {
  const form = useForm({ defaultValues: { bookingType: 'dinner' } });
  return (
    <Form {...form}>
      <FormField control={form.control} name="bookingType" render={() => <>{children}</>} />
    </Form>
  );
}

function render(ui: React.ReactElement) {
  return renderDom(<Harness>{ui}</Harness>);
}

const options = [
  { key: 'lunch' as OccasionKey, label: 'Lunch' },
  { key: 'dinner' as OccasionKey, label: 'Dinner' },
];

function makeAvailability(services: Record<string, 'enabled' | 'disabled'>): ServiceAvailability {
  return {
    services,
    labels: { kitchenClosed: false, lunchWindow: true, dinnerWindow: true },
  };
}

describe('OccasionPicker', () => {
  it('renders every option with the selected one pressed @smoke', () => {
    render(
      <OccasionPicker
        value={'dinner' as OccasionKey}
        options={options}
        availability={makeAvailability({ lunch: 'enabled', dinner: 'enabled' })}
        availableOptions={['lunch', 'dinner'] as OccasionKey[]}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('radio', { name: 'Dinner' })).toHaveAttribute('data-state', 'on');
    expect(screen.getByRole('radio', { name: 'Lunch' })).toHaveAttribute('data-state', 'off');
  });

  it('selecting an enabled occasion emits onChange @contract', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <OccasionPicker
        value={'dinner' as OccasionKey}
        options={options}
        availability={makeAvailability({ lunch: 'enabled', dinner: 'enabled' })}
        availableOptions={['lunch', 'dinner'] as OccasionKey[]}
        onChange={onChange}
      />,
    );

    await user.click(screen.getByRole('radio', { name: 'Lunch' }));
    expect(onChange).toHaveBeenCalledWith('lunch');
  });

  it('disables occasions the schedule does not offer @contract', () => {
    render(
      <OccasionPicker
        value={'dinner' as OccasionKey}
        options={options}
        availability={makeAvailability({ lunch: 'enabled', dinner: 'enabled' })}
        availableOptions={['dinner'] as OccasionKey[]}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('radio', { name: 'Lunch' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: 'Dinner' })).toBeEnabled();
  });

  it('disables occasions whose service window is off @contract', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <OccasionPicker
        value={'dinner' as OccasionKey}
        options={options}
        availability={makeAvailability({ lunch: 'disabled', dinner: 'enabled' })}
        availableOptions={['lunch', 'dinner'] as OccasionKey[]}
        onChange={onChange}
      />,
    );

    const lunch = screen.getByRole('radio', { name: 'Lunch' });
    expect(lunch).toBeDisabled();
    await user.click(lunch);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('shows a validation error when provided @contract', () => {
    render(
      <OccasionPicker
        value={'dinner' as OccasionKey}
        options={options}
        availability={makeAvailability({ dinner: 'enabled' })}
        availableOptions={['dinner'] as OccasionKey[]}
        onChange={vi.fn()}
        error="Pick an occasion"
      />,
    );

    expect(screen.getByText('Pick an occasion')).toBeInTheDocument();
  });
});
