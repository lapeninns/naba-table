import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { itemInitialState } from '@/components/features/menu/menuHierarchyDomain';
import { DrinkDetailsFields } from '@/components/features/menu/menuHierarchyDrinkDetailsFields';

import { applySetterCalls, switchByLabel } from './__fixtures__/menuHierarchy';

describe('DrinkDetailsFields', () => {
  it('@smoke renders drink profile inputs and switches', () => {
    render(<DrinkDetailsFields state={itemInitialState()} setState={vi.fn()} />);

    expect(screen.getByText('Drink details')).toBeInTheDocument();
    for (const labelText of ['ABV %', 'Volume ml', 'Serving size', 'Style', 'Region', 'Grape']) {
      expect(screen.getByText(labelText)).toBeInTheDocument();
    }
    expect(switchByLabel('Contains dairy')).not.toBeChecked();
    expect(switchByLabel('Non-alcoholic')).not.toBeChecked();
  });

  it('@contract patches text inputs into drink profile state', async () => {
    const user = userEvent.setup();
    const setState = vi.fn();
    const initial = itemInitialState();
    render(<DrinkDetailsFields state={initial} setState={setState} />);

    await user.type(screen.getByPlaceholderText('Pint, 175ml, bottle'), 'P');
    await user.type(screen.getByPlaceholderText('Lager, IPA, Merlot'), 'L');

    const patched = applySetterCalls(setState, initial);
    expect(patched.servingSize).toBe('P');
    expect(patched.drinkStyle).toBe('L');
  });

  it('@contract toggling drink flags patches the matching booleans', async () => {
    const user = userEvent.setup();
    const setState = vi.fn();
    const initial = itemInitialState();
    render(<DrinkDetailsFields state={initial} setState={setState} />);

    await user.click(switchByLabel('Contains gluten'));
    await user.click(switchByLabel('Decaf available'));

    const patched = applySetterCalls(setState, initial);
    expect(patched.containsGluten).toBe(true);
    expect(patched.decafAvailable).toBe(true);
    expect(patched.containsDairy).toBe(false);
  });
});
