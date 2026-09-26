import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  DialogSaveError,
  Field,
  FieldDisclosure,
  MultiCheckboxGroup,
  NutritionRangeInputs,
  SwitchField,
} from '@/components/features/menu/menuHierarchyFormControls';
import { Input } from '@/components/ui/input';
import { HttpError } from '@/lib/http/errors';

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

  it('@a11y SwitchField names its switch from the visible label', () => {
    render(<SwitchField label="Item active" checked onCheckedChange={vi.fn()} />);

    expect(screen.getByRole('switch', { name: 'Item active' })).toBeInTheDocument();
  });

  it('@a11y Field links its label to a single text control', () => {
    render(
      <Field label="Menu name">
        <Input />
      </Field>,
    );

    expect(screen.getByRole('textbox', { name: 'Menu name' })).toBeInTheDocument();
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

  it('@a11y Field links a hint to its control', () => {
    render(
      <Field label="Price" hint="Needed for Google">
        <Input />
      </Field>,
    );

    expect(screen.getByRole('textbox', { name: 'Price' })).toHaveAccessibleDescription(
      'Needed for Google',
    );
  });

  it('@contract @a11y FieldDisclosure toggles its content and reports aria-expanded', async () => {
    const user = userEvent.setup();
    render(
      <FieldDisclosure title="Advanced" hint="Rarely needed">
        <p>Hidden content</p>
      </FieldDisclosure>,
    );

    const trigger = screen.getByRole('button', { name: /Advanced/ });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Hidden content')).not.toBeInTheDocument();

    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Hidden content')).toBeInTheDocument();
  });

  it('@contract DialogSaveError shows only the safe reason code', () => {
    const { rerender } = render(<DialogSaveError error={null} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    rerender(
      <DialogSaveError
        error={new HttpError({ message: 'Guest Jane', status: 429, code: 'RATE_LIMITED' })}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Not saved. Your edits are still in this dialog. Reason code RATE_LIMITED.',
    );
    expect(screen.queryByText(/Jane/)).not.toBeInTheDocument();
  });
});
