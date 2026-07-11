import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { AvailabilityOccasionRulesSection } from '@/components/features/restaurant-settings/AvailabilityOccasionRulesSection';
import { createEmptyOccasionForm } from '@/components/features/restaurant-settings/availabilityOccasionsModel';

import type { OccasionFormState } from '@/components/features/restaurant-settings/availabilityOccasionsModel';

function renderSection(form: OccasionFormState = createEmptyOccasionForm(), formErrors = {}) {
  const onFormChange = vi.fn();
  render(
    <AvailabilityOccasionRulesSection
      availabilityPreview="Available anytime"
      form={form}
      formErrors={formErrors}
      onFormChange={onFormChange}
    />,
  );
  return { form, onFormChange };
}

describe('AvailabilityOccasionRulesSection', () => {
  it('@smoke renders the section header, one rule editor per draft, and the guest preview', () => {
    renderSection();

    expect(screen.getByText('Availability rules')).toBeInTheDocument();
    expect(screen.getByText('Rule 1')).toBeInTheDocument();
    expect(screen.getByText('Guest-facing summary')).toBeInTheDocument();
    expect(screen.getByText('Available anytime')).toBeInTheDocument();
  });

  it('@contract appends a rule draft when Add rule is clicked', async () => {
    const user = userEvent.setup();
    const { form, onFormChange } = renderSection();

    await user.click(screen.getByRole('button', { name: /Add rule/ }));

    const updater = onFormChange.mock.calls.at(-1)?.[0] as (prev: OccasionFormState) => OccasionFormState;
    expect(updater(form).availabilityRules).toHaveLength(form.availabilityRules.length + 1);
  });

  it('@contract removes a rule draft through the rule editor', async () => {
    const user = userEvent.setup();
    const base = createEmptyOccasionForm();
    const form: OccasionFormState = {
      ...base,
      availabilityRules: [
        base.availabilityRules[0],
        { ...base.availabilityRules[0], id: 'rule-2' },
      ],
    };
    const { onFormChange } = renderSection(form);

    await user.click(screen.getAllByRole('button', { name: /Remove/ })[0]);

    const updater = onFormChange.mock.calls.at(-1)?.[0] as (prev: OccasionFormState) => OccasionFormState;
    expect(updater(form).availabilityRules).toHaveLength(1);
    expect(updater(form).availabilityRules[0]?.id).toBe('rule-2');
  });

  it('@contract surfaces the availability validation error', () => {
    renderSection(createEmptyOccasionForm(), { availability: 'Complete every rule' });

    expect(screen.getByText('Complete every rule')).toBeInTheDocument();
  });
});
