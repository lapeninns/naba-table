import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { AvailabilityOccasionDetailsFields } from '@/components/features/restaurant-settings/AvailabilityOccasionDetailsFields';
import { createEmptyOccasionForm } from '@/components/features/restaurant-settings/availabilityOccasionsModel';

import type {
  OccasionFormErrors,
  OccasionFormState,
} from '@/components/features/restaurant-settings/availabilityOccasionsModel';

function renderFields({
  editingKey = null,
  form = createEmptyOccasionForm(),
  formErrors = {},
}: {
  editingKey?: string | null;
  form?: OccasionFormState;
  formErrors?: OccasionFormErrors;
} = {}) {
  const onFormChange = vi.fn();
  render(
    <AvailabilityOccasionDetailsFields
      editingKey={editingKey}
      form={form}
      formErrors={formErrors}
      onFormChange={onFormChange}
    />,
  );
  return { form, onFormChange };
}

describe('AvailabilityOccasionDetailsFields', () => {
  it('@smoke @a11y renders all labelled fields for a new occasion', () => {
    renderFields();

    expect(screen.getByLabelText('Key')).toBeInTheDocument();
    expect(screen.getByLabelText('Label')).toBeInTheDocument();
    expect(screen.getByLabelText('Short label')).toBeInTheDocument();
    expect(screen.getByLabelText('Description')).toBeInTheDocument();
    expect(screen.getByLabelText('Default table time (minutes)')).toBeInTheDocument();
    expect(screen.getByLabelText('Display order')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Active' })).toBeChecked();
  });

  it('@contract hides the key field when editing an existing occasion', () => {
    renderFields({ editingKey: 'lunch' });

    expect(screen.queryByLabelText('Key')).not.toBeInTheDocument();
  });

  it('@contract propagates label edits through onFormChange', async () => {
    const user = userEvent.setup();

    // Stateful harness: the component expects a live Dispatch<SetStateAction>.
    function Harness() {
      const [form, setForm] = useState(createEmptyOccasionForm);
      return (
        <AvailabilityOccasionDetailsFields
          editingKey={null}
          form={form}
          formErrors={{}}
          onFormChange={setForm}
        />
      );
    }
    render(<Harness />);

    await user.type(screen.getByLabelText('Label'), 'Birthday');

    expect(screen.getByLabelText('Label')).toHaveValue('Birthday');
  });

  it('@contract toggles the active switch through onFormChange', async () => {
    const user = userEvent.setup();
    const { form, onFormChange } = renderFields();

    await user.click(screen.getByRole('switch', { name: 'Active' }));

    const updater = onFormChange.mock.calls.at(-1)?.[0] as (prev: OccasionFormState) => OccasionFormState;
    expect(updater(form)).toMatchObject({ isActive: false });
  });

  it('@contract @a11y flags invalid key and label fields with error text', () => {
    renderFields({
      formErrors: { key: 'Key is required', label: 'Label is required' },
    });

    expect(screen.getByLabelText('Key')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Key is required')).toBeInTheDocument();
    expect(screen.getByLabelText('Label')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Label is required')).toBeInTheDocument();
  });
});
