import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { AvailabilityOccasionDialog } from '@/components/features/restaurant-settings/AvailabilityOccasionDialog';
import { createEmptyOccasionForm } from '@/components/features/restaurant-settings/availabilityOccasionsModel';

function renderDialog(overrides: Partial<Parameters<typeof AvailabilityOccasionDialog>[0]> = {}) {
  const onSubmit = vi.fn();
  const onOpenChange = vi.fn();
  render(
    <AvailabilityOccasionDialog
      availabilityPreview="Always available"
      editingKey={null}
      form={createEmptyOccasionForm()}
      formErrors={{}}
      open
      onFormChange={vi.fn()}
      onOpenChange={onOpenChange}
      onSubmit={onSubmit}
      {...overrides}
    />,
  );
  return { onSubmit, onOpenChange };
}

describe('AvailabilityOccasionDialog', () => {
  it('@contract @a11y groups essentials first and puts rules and machine fields behind disclosures', () => {
    renderDialog();

    expect(screen.getByRole('dialog', { name: 'Add booking type' })).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toBeVisible();
    expect(screen.getByLabelText('Guests and staff can book this')).toBeVisible();
    expect(screen.getByText('Table time by party size')).toBeVisible();
    expect(screen.getByText('When guests can choose it')).toBeInTheDocument();
    expect(screen.getByText('Available only when every rule matches.')).toBeInTheDocument();
    expect(screen.getByText('Advanced')).toBeInTheDocument();
  });

  it('@contract uses the booking type name when editing and explains a switched-off built-in', () => {
    renderDialog({
      editingKey: 'lunch',
      form: { ...createEmptyOccasionForm(), label: 'Lunch', isActive: false },
    });

    expect(screen.getByRole('dialog', { name: 'Edit Lunch' })).toBeInTheDocument();
    expect(screen.getByText('Lunch is off.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Update booking type' })).toBeInTheDocument();
  });

  it('@contract submits through onSubmit and cancels through onOpenChange', async () => {
    const user = userEvent.setup();
    const { onOpenChange, onSubmit } = renderDialog();

    await user.click(screen.getByRole('button', { name: 'Add booking type' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
