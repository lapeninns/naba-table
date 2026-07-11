import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { AvailabilityOccasionDialog } from '@/components/features/restaurant-settings/AvailabilityOccasionDialog';
import { createEmptyOccasionForm } from '@/components/features/restaurant-settings/availabilityOccasionsModel';

function renderDialog(overrides: Partial<Parameters<typeof AvailabilityOccasionDialog>[0]> = {}) {
  const onSubmit = vi.fn((event: React.FormEvent<HTMLFormElement>) => event.preventDefault());
  const onOpenChange = vi.fn();
  render(
    <AvailabilityOccasionDialog
      availabilityPreview="Available anytime"
      editingKey={null}
      form={createEmptyOccasionForm()}
      formErrors={{}}
      open
      showTurnBands={false}
      onFormChange={vi.fn()}
      onOpenChange={onOpenChange}
      onSubmit={onSubmit}
      {...overrides}
    />,
  );
  return { onSubmit, onOpenChange };
}

describe('AvailabilityOccasionDialog', () => {
  it('@contract @a11y presents the create dialog with its title and submit label', () => {
    renderDialog();

    expect(screen.getByRole('dialog', { name: 'New booking type' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add occasion' })).toBeInTheDocument();
  });

  it('@contract switches to edit copy for a service window occasion', () => {
    renderDialog({
      editingKey: 'lunch',
      form: { ...createEmptyOccasionForm(), label: 'Lunch' },
    });

    expect(screen.getByRole('dialog', { name: 'Edit booking type' })).toBeInTheDocument();
    expect(screen.getByText(/also defines a service window/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Update occasion' })).toBeInTheDocument();
  });

  it('@contract submits the form through onSubmit', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderDialog();

    await user.click(screen.getByRole('button', { name: 'Add occasion' }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('@contract cancels by requesting close through onOpenChange', async () => {
    const user = userEvent.setup();
    const { onOpenChange, onSubmit } = renderDialog();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
