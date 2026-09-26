import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import {
  AvailabilityOccasionDetailsFields,
  suggestOccasionKey,
} from '@/components/features/restaurant-settings/AvailabilityOccasionDetailsFields';
import {
  createEmptyOccasionForm,
  type OccasionFormErrors,
  type OccasionFormState,
} from '@/components/features/restaurant-settings/availabilityOccasionsModel';

function Harness({
  editingKey = null,
  formErrors = {},
  initial = createEmptyOccasionForm(),
}: {
  editingKey?: string | null;
  formErrors?: OccasionFormErrors;
  initial?: OccasionFormState;
}) {
  const [form, setForm] = useState(initial);
  return (
    <>
      <AvailabilityOccasionDetailsFields
        part="essentials"
        editingKey={editingKey}
        form={form}
        formErrors={formErrors}
        onFormChange={setForm}
      />
      <AvailabilityOccasionDetailsFields
        part="advanced"
        editingKey={editingKey}
        form={form}
        formErrors={formErrors}
        onFormChange={setForm}
      />
    </>
  );
}

describe('AvailabilityOccasionDetailsFields', () => {
  it('@smoke @a11y labels every field', () => {
    render(<Harness />);

    for (const label of ['Name', /Short name/, /Description/, 'Key', 'Display order']) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
  });

  it('@contract suggests a key from the name until one is typed', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(screen.getByLabelText('Name'), 'Christmas party');
    expect(screen.getByLabelText('Key')).toHaveValue('christmas_party');

    await user.clear(screen.getByLabelText('Key'));
    await user.type(screen.getByLabelText('Key'), 'xmas');
    await user.type(screen.getByLabelText('Name'), '!');
    expect(screen.getByLabelText('Key')).toHaveValue('xmas');
  });

  it('@contract makes the key read-only once the booking type exists', () => {
    render(
      <Harness
        editingKey="lunch"
        initial={{ ...createEmptyOccasionForm(), key: 'lunch', label: 'Lunch' }}
      />,
    );

    expect(screen.getByLabelText('Key')).toHaveAttribute('readonly');
    expect(screen.getByText('Can’t be changed.')).toBeInTheDocument();
  });

  it('@contract @a11y links errors to their fields', () => {
    render(<Harness formErrors={{ label: 'Label is required', key: 'Key is required' }} />);

    expect(screen.getByLabelText('Name')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Name')).toHaveAccessibleDescription('Label is required');
    expect(screen.getByLabelText('Key')).toHaveAttribute('aria-invalid', 'true');
  });

  it('builds keys from the characters keys allow', () => {
    expect(suggestOccasionKey('  Sunday Roast! ')).toBe('sunday_roast');
  });
});
