import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  Field,
  MultiCheckboxGroup,
  NutritionRangeInputs,
  SwitchField,
} from '@/components/features/menu/menuHierarchyFormControls';

describe('menuHierarchyFormControls', () => {
  it('@smoke Field renders the label above its control', () => {
    render(
      <Field label="Item name">
        <input aria-label="Item name input" />
      </Field>,
    );

    expect(screen.getByText('Item name')).toBeInTheDocument();
    expect(screen.getByLabelText('Item name input')).toBeInTheDocument();
  });

  it('@contract @a11y SwitchField reflects checked state and reports toggles', async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(<SwitchField label="Item active" checked={false} onCheckedChange={onCheckedChange} />);

    const control = screen.getByRole('switch');
    expect(control).not.toBeChecked();
    expect(screen.getByText('Item active')).toBeInTheDocument();

    await user.click(control);
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it('@a11y KNOWN-ISSUE: SwitchField switch has no accessible name (label not associated)', () => {
    // The Label is rendered as a sibling without htmlFor/id wiring, so the
    // switch cannot be queried by role+name. Pinning current behavior; fixing
    // it belongs to product source, out of scope for this spec.
    render(<SwitchField label="Item active" checked onCheckedChange={vi.fn()} />);

    const control = screen.getByRole('switch');
    expect(control).not.toHaveAccessibleName();
  });

  it('@contract NutritionRangeInputs reports lower and upper edits separately', async () => {
    const user = userEvent.setup();
    const onLowerChange = vi.fn();
    const onUpperChange = vi.fn();
    render(
      <NutritionRangeInputs
        lowerValue=""
        upperValue=""
        unit="CALORIE"
        onLowerChange={onLowerChange}
        onUpperChange={onUpperChange}
      />,
    );

    await user.type(screen.getByPlaceholderText('Lower CALORIE'), '2');
    expect(onLowerChange).toHaveBeenCalledWith('2');

    await user.type(screen.getByPlaceholderText('Upper CALORIE'), '9');
    expect(onUpperChange).toHaveBeenCalledWith('9');
  });

  it('@contract @a11y MultiCheckboxGroup checks selected values and toggles both directions', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <MultiCheckboxGroup
        label="Allergens"
        options={['MILK', 'GLUTEN']}
        values={['MILK']}
        onChange={onChange}
        getOptionLabel={(value) => `Label ${value}`}
      />,
    );

    expect(screen.getByText('Allergens')).toBeInTheDocument();
    const milk = screen.getByRole('checkbox', { name: 'Label MILK' });
    const gluten = screen.getByRole('checkbox', { name: 'Label GLUTEN' });
    expect(milk).toBeChecked();
    expect(gluten).not.toBeChecked();

    await user.click(gluten);
    expect(onChange).toHaveBeenCalledWith('GLUTEN', true);

    await user.click(milk);
    expect(onChange).toHaveBeenCalledWith('MILK', false);
  });
});
