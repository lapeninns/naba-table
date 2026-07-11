import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { AvailabilityRuleEditor } from '@/components/features/restaurant-settings/AvailabilityRuleEditor';
import { createRuleDraft } from '@/components/features/restaurant-settings/availabilityOccasionsModel';

import type { AvailabilityRuleEditorProps } from '@/components/features/restaurant-settings/AvailabilityRuleEditor';
import type { RuleDraft } from '@/components/features/restaurant-settings/availabilityOccasionsModel';

function renderEditor(rule: RuleDraft, overrides: Partial<AvailabilityRuleEditorProps> = {}) {
  const handlers = {
    onAddSpecificDate: vi.fn(),
    onRemove: vi.fn(),
    onRemoveSpecificDate: vi.fn(),
    onReplaceKind: vi.fn(),
    onToggleMonth: vi.fn(),
    onUpdate: vi.fn(),
  };
  render(
    <AvailabilityRuleEditor
      canRemove
      index={0}
      rule={rule}
      {...handlers}
      {...overrides}
    />,
  );
  return handlers;
}

describe('AvailabilityRuleEditor', () => {
  it('@smoke describes an anytime rule with its preview line', () => {
    renderEditor(createRuleDraft('anytime'));

    expect(screen.getByText('Rule 1')).toBeInTheDocument();
    expect(
      screen.getByText(/Guests can choose this occasion at any time/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Preview:/)).toBeInTheDocument();
  });

  it('@contract @a11y replaces the rule kind through the labelled select', async () => {
    const user = userEvent.setup();
    const rule = createRuleDraft('anytime');
    const { onReplaceKind } = renderEditor(rule);

    await user.click(screen.getByRole('combobox', { name: 'Rule 1 type' }));
    await user.click(await screen.findByRole('option', { name: 'Only in selected months' }));

    expect(onReplaceKind).toHaveBeenCalledWith(rule.id, 'month_only');
  });

  it('@contract updates the start time for a time window rule', () => {
    const rule: RuleDraft = { ...createRuleDraft('time_window'), start: '', end: '' };
    const { onUpdate } = renderEditor(rule);

    // jsdom needs a whole-value change event for <input type="time">.
    const [start] = screen.getAllByDisplayValue('');
    fireEvent.change(start, { target: { value: '18:00' } });

    expect(onUpdate).toHaveBeenCalledWith(rule.id, { start: '18:00' });
  });

  it('@contract toggles months for a month-only rule', async () => {
    const user = userEvent.setup();
    const rule: RuleDraft = { ...createRuleDraft('month_only'), months: [12] };
    const { onToggleMonth } = renderEditor(rule);

    await user.click(screen.getByRole('button', { name: 'Jun' }));

    expect(onToggleMonth).toHaveBeenCalledWith(rule.id, 6);
  });

  it('@contract adds and removes specific dates', async () => {
    const user = userEvent.setup();
    const rule: RuleDraft = {
      ...createRuleDraft('specific_dates'),
      specificDates: ['2026-12-24'],
      pendingDate: '2026-12-31',
    };
    const { onAddSpecificDate, onRemoveSpecificDate } = renderEditor(rule);

    // Both the picker trigger (labelled "Add date") and the action button share the
    // accessible name; the action button is the last match in DOM order.
    const addButtons = screen.getAllByRole('button', { name: 'Add date' });
    await user.click(addButtons[addButtons.length - 1]);
    expect(onAddSpecificDate).toHaveBeenCalledWith(rule.id);

    await user.click(screen.getByRole('button', { name: '2026-12-24' }));
    expect(onRemoveSpecificDate).toHaveBeenCalledWith(rule.id, '2026-12-24');
  });

  it('@contract disables removal when this is the only rule', () => {
    renderEditor(createRuleDraft('anytime'), { canRemove: false });

    expect(screen.getByRole('button', { name: /Remove/ })).toBeDisabled();
  });
});
