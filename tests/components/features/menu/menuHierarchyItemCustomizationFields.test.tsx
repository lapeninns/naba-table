import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { itemInitialState } from '@/components/features/menu/menuHierarchyDomain';
import { CustomizationFields } from '@/components/features/menu/menuHierarchyItemCustomizationFields';

import { applySetterCalls, switchByLabel } from './__fixtures__/menuHierarchy';

describe('CustomizationFields', () => {
  it('@smoke renders customisation controls with allow-customisations on by default', () => {
    render(<CustomizationFields state={itemInitialState()} setState={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Customisation' })).toBeInTheDocument();
    expect(switchByLabel('Allow customisations')).toBeChecked();
    expect(screen.getByText('Max selections')).toBeInTheDocument();
    expect(screen.getByText('Modifier group IDs')).toBeInTheDocument();
  });

  it('@contract disabling customisations patches the flag', async () => {
    const user = userEvent.setup();
    const setState = vi.fn();
    const initial = itemInitialState();
    render(<CustomizationFields state={initial} setState={setState} />);

    await user.click(switchByLabel('Allow customisations'));

    expect(applySetterCalls(setState, initial).allowCustomizations).toBe(false);
  });

  it('@contract patches max selections, modifier groups, and the note', async () => {
    const user = userEvent.setup();
    const setState = vi.fn();
    const initial = itemInitialState();
    render(<CustomizationFields state={initial} setState={setState} />);

    await user.type(screen.getByRole('spinbutton'), '3');
    const [modifierGroups, note] = screen.getAllByRole('textbox');
    await user.type(modifierGroups, 'g');
    await user.type(note, 'x');

    const patched = applySetterCalls(setState, initial);
    expect(patched.maxSelections).toBe('3');
    expect(patched.modifierGroupIds).toBe('g');
    expect(patched.customizationNote).toBe('x');
  });
});
